/**
 * Server-side OAuth 2.1 / OpenID Connect relying party for the able IdP.
 *
 * The upstream ID token is verified with JOSE here. It never enters OpenBook's
 * EdDSA-only identity verifier; instead we mint a short-lived internal assertion
 * with a per-instance Ed25519 key and register only that public key in policy.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload} from 'jose';
import {
  mintIdentityKeypair,
  signIdentity,
  type IdentityClaims,
  type Jwk,
} from '@book.dev/sdk';
import type {PageStore} from './store';

export const ABLE_OIDC_ISSUER = 'https://account.able.online/api/auth';
export const ABLE_OIDC_DISCOVERY_URL =
  'https://account.able.online/api/auth/.well-known/openid-configuration';
export const ABLE_BRIDGE_ISSUER = 'urn:openbook:identity:able';
export const ABLE_OIDC_SCOPES = 'openid profile email offline_access';

const STATE_TTL_MS = 10 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const ASSERTION_TTL_SEC = 60 * 60;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const SAFE_ID_TOKEN_ALG = /^(?:RS|PS|ES)(?:256|384|512)$|^EdDSA$/;

export interface AbleOidcOptions {
  clientId: string;
  clientSecret: string;
  issuer?: string;
  discoveryUrl?: string;
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  now?: () => number;
  discoveryTtlMs?: number;
}

interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  id_token_signing_alg_values_supported?: string[];
}

interface TokenResponse {
  id_token?: unknown;
  refresh_token?: unknown;
}

interface Cached<T> {
  value: T;
  at: number;
}

export class AbleOidcError extends Error {
  constructor(
    readonly status: 400 | 502,
    message: string,
  ) {
    super(message);
    this.name = 'AbleOidcError';
  }
}

const b64u = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const stateHash = (state: string): string => createHash('sha256').update(state).digest('hex');

/** RFC 6749 client_secret_basic applies form encoding before joining the pair. */
const formEncode = (value: string): string => encodeURIComponent(value).replace(/%20/g, '+');

function safeUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new AbleOidcError(502, `able discovery has no valid ${field}`);
  try {
    const url = new URL(value);
    const loopbackHttp = url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
    if (url.protocol !== 'https:' && !loopbackHttp) {
      throw new Error('unsafe scheme');
    }
    return url.toString();
  } catch {
    throw new AbleOidcError(502, `able discovery has no valid ${field}`);
  }
}

function safeStringEqual(left: unknown, right: string): boolean {
  if (typeof left !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeDiscovery(value: unknown, expectedIssuer: string): DiscoveryDocument {
  if (!value || typeof value !== 'object') throw new AbleOidcError(502, 'able discovery document is malformed');
  const raw = value as Partial<DiscoveryDocument>;
  if (raw.issuer !== expectedIssuer) throw new AbleOidcError(502, 'able discovery issuer does not match configuration');
  const algorithms = Array.isArray(raw.id_token_signing_alg_values_supported)
    ? raw.id_token_signing_alg_values_supported.filter((alg): alg is string => typeof alg === 'string')
    : undefined;
  return {
    issuer: raw.issuer,
    authorization_endpoint: safeUrl(raw.authorization_endpoint, 'authorization endpoint'),
    token_endpoint: safeUrl(raw.token_endpoint, 'token endpoint'),
    jwks_uri: safeUrl(raw.jwks_uri, 'JWKS URI'),
    ...(algorithms ? {id_token_signing_alg_values_supported: algorithms} : {}),
  };
}

function normalizeJwks(value: unknown): JSONWebKeySet {
  if (!value || typeof value !== 'object' || !Array.isArray((value as JSONWebKeySet).keys)) {
    throw new AbleOidcError(502, 'able JWKS is malformed');
  }
  return value as JSONWebKeySet;
}

function deriveEncryptionKey(clientSecret: string): Buffer {
  return createHash('sha256')
    .update('OpenBook able OIDC secret-at-rest v1\0')
    .update(clientSecret)
    .digest();
}

function encryptSecret(secret: string, key: Buffer): {ciphertext: string; iv: string} {
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return {ciphertext: body.toString('base64url'), iv: iv.toString('base64url')};
}

function decryptSecret(ciphertext: string, iv: string, key: Buffer): string {
  const bytes = Buffer.from(ciphertext, 'base64url');
  if (bytes.length <= AES_GCM_TAG_BYTES) throw new Error('invalid encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(bytes.subarray(bytes.length - AES_GCM_TAG_BYTES));
  return Buffer.concat([
    decipher.update(bytes.subarray(0, bytes.length - AES_GCM_TAG_BYTES)),
    decipher.final(),
  ]).toString('utf8');
}

function bridgeKeyIsValid(key: Awaited<ReturnType<PageStore['getAbleOidcBridgeKey']>>): key is NonNullable<typeof key> {
  return !!key && key.publicJwk.kty === 'OKP' && key.publicJwk.crv === 'Ed25519' && typeof key.publicJwk.x === 'string';
}

export class AbleOidcService {
  private discoveryCache: Cached<DiscoveryDocument> | null = null;
  private jwksCache: Cached<JSONWebKeySet> | null = null;
  private readonly encryptionKey: Buffer;
  readonly issuer: string;
  readonly discoveryUrl: string;

  constructor(
    private readonly store: PageStore,
    private readonly opts: AbleOidcOptions,
  ) {
    this.issuer = (opts.issuer ?? ABLE_OIDC_ISSUER).replace(/\/+$/, '');
    this.discoveryUrl = opts.discoveryUrl ??
      (opts.issuer ? `${this.issuer}/.well-known/openid-configuration` : ABLE_OIDC_DISCOVERY_URL);
    this.encryptionKey = deriveEncryptionKey(opts.clientSecret);
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private async fetchJson(url: string, init?: RequestInit): Promise<unknown> {
    const response = await (this.opts.fetchImpl ?? fetch)(url, {...init, redirect: 'follow'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  private async discovery(): Promise<DiscoveryDocument> {
    const ttl = this.opts.discoveryTtlMs ?? CACHE_TTL_MS;
    if (this.discoveryCache && this.now() - this.discoveryCache.at < ttl) return this.discoveryCache.value;
    try {
      const value = normalizeDiscovery(await this.fetchJson(this.discoveryUrl), this.issuer);
      this.discoveryCache = {value, at: this.now()};
      return value;
    } catch (error) {
      if (this.discoveryCache) return this.discoveryCache.value;
      if (error instanceof AbleOidcError) throw error;
      throw new AbleOidcError(502, 'able discovery is unavailable');
    }
  }

  private async jwks(discovery: DiscoveryDocument): Promise<JSONWebKeySet> {
    const ttl = this.opts.discoveryTtlMs ?? CACHE_TTL_MS;
    if (this.jwksCache && this.now() - this.jwksCache.at < ttl) return this.jwksCache.value;
    try {
      const value = normalizeJwks(await this.fetchJson(discovery.jwks_uri));
      this.jwksCache = {value, at: this.now()};
      return value;
    } catch (error) {
      if (this.jwksCache) return this.jwksCache.value;
      if (error instanceof AbleOidcError) throw error;
      throw new AbleOidcError(502, 'able signing keys are unavailable');
    }
  }

  async authorizationUrl(origin: string, handoffState = ''): Promise<string> {
    const discovery = await this.discovery();
    const state = b64u(randomBytes(32));
    const verifier = b64u(randomBytes(32));
    const nonce = b64u(randomBytes(32));
    const challenge = b64u(createHash('sha256').update(verifier).digest());
    const redirectUri = new URL('/api/auth/oauth2/callback/able', origin).toString();
    const encryptedVerifier = encryptSecret(verifier, this.encryptionKey);
    await this.store.createAbleOidcState({
      stateHash: stateHash(state),
      codeVerifierCiphertext: encryptedVerifier.ciphertext,
      codeVerifierIv: encryptedVerifier.iv,
      nonce,
      handoffState,
      redirectUri,
      expiresAt: new Date(this.now() + STATE_TTL_MS),
    });

    const target = new URL(discovery.authorization_endpoint);
    target.searchParams.set('client_id', this.opts.clientId);
    target.searchParams.set('response_type', 'code');
    target.searchParams.set('redirect_uri', redirectUri);
    target.searchParams.set('scope', ABLE_OIDC_SCOPES);
    target.searchParams.set('state', state);
    target.searchParams.set('nonce', nonce);
    target.searchParams.set('code_challenge', challenge);
    target.searchParams.set('code_challenge_method', 'S256');
    return target.toString();
  }

  private async exchangeCode(code: string, verifier: string, redirectUri: string): Promise<TokenResponse> {
    const discovery = await this.discovery();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const authorization = Buffer.from(
      `${formEncode(this.opts.clientId)}:${formEncode(this.opts.clientSecret)}`,
      'utf8',
    ).toString('base64');
    try {
      const response = await (this.opts.fetchImpl ?? fetch)(discovery.token_endpoint, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          authorization: `Basic ${authorization}`,
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body,
      });
      if (!response.ok) throw new Error('token endpoint rejected the code');
      return (await response.json()) as TokenResponse;
    } catch {
      throw new AbleOidcError(502, 'able token exchange failed');
    }
  }

  private allowedAlgorithms(discovery: DiscoveryDocument): string[] {
    const advertised = discovery.id_token_signing_alg_values_supported ?? [];
    const safe = advertised.filter((alg) => SAFE_ID_TOKEN_ALG.test(alg));
    if (safe.length === 0) throw new AbleOidcError(502, 'able discovery advertises no supported ID-token algorithm');
    return safe;
  }

  private async verifyIdToken(idToken: string, expectedNonce: string): Promise<JWTPayload> {
    const discovery = await this.discovery();
    const keys = await this.jwks(discovery);
    try {
      const {payload} = await jwtVerify(idToken, createLocalJWKSet(keys), {
        issuer: this.issuer,
        audience: this.opts.clientId,
        algorithms: this.allowedAlgorithms(discovery),
        clockTolerance: 60,
        currentDate: new Date(this.now()),
      });
      if (!payload.sub || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
        throw new Error('missing required claims');
      }
      if (!safeStringEqual(payload.nonce, expectedNonce)) throw new Error('nonce mismatch');
      if (payload.azp !== undefined && payload.azp !== this.opts.clientId) throw new Error('azp mismatch');
      if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== this.opts.clientId) {
        throw new Error('multiple audiences require azp');
      }
      return payload;
    } catch {
      throw new AbleOidcError(400, 'able ID token could not be verified');
    }
  }

  private async newEncryptedBridgeKey(): Promise<{
    publicJwk: Jwk;
    privateKeyCiphertext: string;
    privateKeyIv: string;
  }> {
    const keypair = await mintIdentityKeypair(`able-${randomUUID()}`);
    const encrypted = encryptSecret(keypair.privateKey, this.encryptionKey);
    return {
      publicJwk: keypair.publicJwk,
      privateKeyCiphertext: encrypted.ciphertext,
      privateKeyIv: encrypted.iv,
    };
  }

  private async bridgeKey(): Promise<{publicJwk: Jwk; privateKey: string}> {
    let stored = await this.store.getAbleOidcBridgeKey(ABLE_BRIDGE_ISSUER);
    if (!stored) {
      const candidate = await this.newEncryptedBridgeKey();
      await this.store.createAbleOidcBridgeKey({issuer: ABLE_BRIDGE_ISSUER, ...candidate});
      stored = await this.store.getAbleOidcBridgeKey(ABLE_BRIDGE_ISSUER);
    }
    if (!bridgeKeyIsValid(stored)) throw new AbleOidcError(502, 'able identity bridge is unavailable');
    try {
      return {
        publicJwk: stored.publicJwk,
        privateKey: decryptSecret(stored.privateKeyCiphertext, stored.privateKeyIv, this.encryptionKey),
      };
    } catch {
      // A deliberate client-secret rotation also rotates this local signing key;
      // assertions minted under the prior secret stop verifying immediately.
      const replacement = await this.newEncryptedBridgeKey();
      await this.store.rotateAbleOidcBridgeKey({issuer: ABLE_BRIDGE_ISSUER, ...replacement});
      return {
        publicJwk: replacement.publicJwk,
        privateKey: decryptSecret(replacement.privateKeyCiphertext, replacement.privateKeyIv, this.encryptionKey),
      };
    }
  }

  private async mintBridgeAssertion(payload: JWTPayload): Promise<string> {
    const key = await this.bridgeKey();
    const config = await this.store.getInstanceConfig();
    const trustedIssuers = [
      ...config.trustedIssuers.filter((entry) => entry.issuer !== ABLE_BRIDGE_ISSUER),
      {issuer: ABLE_BRIDGE_ISSUER, jwks: {keys: [key.publicJwk]}},
    ];
    const currentBridge = config.trustedIssuers.find((entry) => entry.issuer === ABLE_BRIDGE_ISSUER);
    if (JSON.stringify(currentBridge?.jwks?.keys ?? []) !== JSON.stringify([key.publicJwk])) {
      await this.store.updateInstanceConfig({trustedIssuers});
    }
    const now = Math.floor(this.now() / 1000);
    const claims: IdentityClaims = {
      iss: ABLE_BRIDGE_ISSUER,
      sub: payload.sub as string,
      ...(typeof payload.name === 'string' ? {name: payload.name} : {}),
      ...(typeof payload.email === 'string' ? {email: payload.email} : {}),
      iat: now,
      exp: now + ASSERTION_TTL_SEC,
      jti: randomUUID(),
      ...(config.audience ? {aud: config.audience} : {}),
    };
    return signIdentity(key.privateKey, claims, key.publicJwk.kid);
  }

  async callback(origin: string, state: string, code: string): Promise<string> {
    if (!state || !code) throw new AbleOidcError(400, 'able callback is missing code or state');
    const pending = await this.store.consumeAbleOidcState(stateHash(state), new Date(this.now()));
    if (!pending) throw new AbleOidcError(400, 'able callback state is invalid or expired');

    let verifier: string;
    try {
      verifier = decryptSecret(
        pending.codeVerifierCiphertext,
        pending.codeVerifierIv,
        this.encryptionKey,
      );
    } catch {
      throw new AbleOidcError(400, 'able callback state is invalid or expired');
    }
    const tokens = await this.exchangeCode(code, verifier, pending.redirectUri);
    if (typeof tokens.id_token !== 'string') throw new AbleOidcError(502, 'able token response has no ID token');
    const payload = await this.verifyIdToken(tokens.id_token, pending.nonce);

    if (typeof tokens.refresh_token === 'string' && tokens.refresh_token.length > 0) {
      const encrypted = encryptSecret(tokens.refresh_token, this.encryptionKey);
      await this.store.setAbleOidcRefreshToken({
        issuer: this.issuer,
        subject: payload.sub as string,
        tokenCiphertext: encrypted.ciphertext,
        tokenIv: encrypted.iv,
      });
    }

    const assertion = await this.mintBridgeAssertion(payload);
    const handoff = new URL('/account/callback', origin);
    handoff.hash = new URLSearchParams({
      token: assertion,
      state: pending.handoffState || state,
    }).toString();
    return handoff.toString();
  }
}
