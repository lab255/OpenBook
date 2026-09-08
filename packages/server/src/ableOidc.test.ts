import {createHash} from 'node:crypto';
import {rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportJWK, generateKeyPair, SignJWT} from 'jose';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {API, DEFAULT_ACCOUNT_URL} from '@book.dev/sdk';
import {createApp} from './app';
import {generateAgentToken, AGENT_API_SETTING_KEY} from './agentTokens';
import type {AbleOidcOptions} from './ableOidc';
import {PgliteDb} from './db';
import {PageHub} from './hub';
import {IdentityService} from './instanceConfig';
import {IDENTITY_HEADER} from './principal';
import {PageStore} from './store';

const UPSTREAM_ISSUER = 'https://able.test/api/auth';
const DISCOVERY_URL = `${UPSTREAM_ISSUER}/.well-known/openid-configuration`;
const AUTHORIZE_URL = `${UPSTREAM_ISSUER}/oauth2/authorize`;
const TOKEN_URL = `${UPSTREAM_ISSUER}/oauth2/token`;
const JWKS_URL = `${UPSTREAM_ISSUER}/oauth2/jwks`;
const CLIENT_ID = 'openbook';
const CLIENT_SECRET = 'test client:secret+never/log';
const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);

let store: PageStore;
let dir: string;
let seq = 0;

beforeEach(async () => {
  seq += 1;
  dir = join(tmpdir(), `ob-able-oidc-${process.pid}-${seq}`);
  rmSync(dir, {recursive: true, force: true});
  store = new PageStore(await PgliteDb.create(dir));
  await store.migrate();
});

afterEach(async () => {
  await store.close();
  rmSync(dir, {recursive: true, force: true});
});

interface IdpHarness {
  options: AbleOidcOptions;
  tokenCalls: Array<{authorization: string; body: URLSearchParams}>;
  setNonce: (nonce: string) => void;
  setTokenKind: (kind: 'valid' | 'bad-iss' | 'bad-aud' | 'expired' | 'bad-sig') => void;
  failDiscovery: () => void;
  discoveryCalls: () => number;
}

async function idpHarness(): Promise<IdpHarness> {
  const {privateKey, publicKey} = await generateKeyPair('RS256');
  const wrong = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  Object.assign(publicJwk, {kid: 'able-rs1', use: 'sig', alg: 'RS256'});
  let nonce = '';
  let kind: 'valid' | 'bad-iss' | 'bad-aud' | 'expired' | 'bad-sig' = 'valid';
  let discoveryDown = false;
  let discoveries = 0;
  const tokenCalls: Array<{authorization: string; body: URLSearchParams}> = [];

  const idToken = async (): Promise<string> => {
    const now = Math.floor(NOW / 1000);
    const signer = kind === 'bad-sig' ? wrong.privateKey : privateKey;
    return new SignJWT({
      sub: 'able-user-7',
      name: 'Ada Able',
      email: 'ADA@EXAMPLE.COM',
      nonce,
    })
      .setProtectedHeader({alg: 'RS256', kid: 'able-rs1', typ: 'JWT'})
      .setIssuer(kind === 'bad-iss' ? 'https://evil.test' : UPSTREAM_ISSUER)
      .setAudience(kind === 'bad-aud' ? 'someone-else' : CLIENT_ID)
      .setIssuedAt(now)
      .setExpirationTime(kind === 'expired' ? now - 3600 : now + 3600)
      .sign(signer);
  };

  const fetchImpl: NonNullable<AbleOidcOptions['fetchImpl']> = async (input, init) => {
    const url = input.toString();
    if (url === DISCOVERY_URL) {
      discoveries += 1;
      if (discoveryDown) throw new Error('offline');
      return Response.json({
        issuer: UPSTREAM_ISSUER,
        authorization_endpoint: AUTHORIZE_URL,
        token_endpoint: TOKEN_URL,
        jwks_uri: JWKS_URL,
        id_token_signing_alg_values_supported: ['RS256', 'HS256', 'none'],
      });
    }
    if (url === JWKS_URL) return Response.json({keys: [publicJwk]});
    if (url === TOKEN_URL) {
      const headers = new Headers(init?.headers);
      const body = new URLSearchParams(String(init?.body ?? ''));
      tokenCalls.push({authorization: headers.get('authorization') ?? '', body});
      return Response.json({
        token_type: 'Bearer',
        id_token: await idToken(),
        refresh_token: 'upstream-refresh-token-plaintext',
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  return {
    options: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      issuer: UPSTREAM_ISSUER,
      discoveryUrl: DISCOVERY_URL,
      fetchImpl,
      now: () => NOW,
    },
    tokenCalls,
    setNonce: (value) => {
      nonce = value;
    },
    setTokenKind: (value) => {
      kind = value;
    },
    failDiscovery: () => {
      discoveryDown = true;
    },
    discoveryCalls: () => discoveries,
  };
}

function readAuthorizeLocation(response: Response): URL {
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') ?? '');
}

async function begin(app: ReturnType<typeof createApp>, handoffState = ''): Promise<URL> {
  const suffix = handoffState ? `?handoff_state=${encodeURIComponent(handoffState)}` : '';
  return readAuthorizeLocation(await app.request(`${API.ableOauthAuthorize}${suffix}`));
}

describe('able OIDC relying party', () => {
  it('offers a side-effect-free same-origin capability probe only when mounted', async () => {
    const idp = await idpHarness();
    const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});
    const response = await app.request(`${API.ableOauthAuthorize}?probe=1`);
    expect(response.status).toBe(204);
    expect(idp.discoveryCalls()).toBe(0);
  });

  it('is inert unless both confidential-client credentials are supplied', async () => {
    const absent = createApp(store);
    expect((await absent.request(API.ableOauthAuthorize)).status).toBe(404);
    const partial = createApp(store, undefined, new PageHub(), {
      // `createApp` receives the already-resolved all-or-nothing option; an
      // incomplete environment therefore passes no `ableOidc` at all.
      accessToken: 'unrelated',
    });
    expect((await partial.request(API.ableOauthAuthorize)).status).toBe(404);
  });

  it('refuses an able issuer that collides with the default account issuer', async () => {
    const idp = await idpHarness();
    expect(() => createApp(store, undefined, new PageHub(), {
      ableOidc: {...idp.options, issuer: DEFAULT_ACCOUNT_URL},
    })).toThrow('able OIDC issuer must differ from the default account issuer');
  });

  it('builds an S256 authorize redirect with state, nonce, exact scopes, and request-origin callback', async () => {
    const idp = await idpHarness();
    const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});
    const target = await begin(app, 'ui-csrf-state');

    expect(target.origin + target.pathname).toBe(AUTHORIZE_URL);
    expect(target.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(target.searchParams.get('response_type')).toBe('code');
    expect(target.searchParams.get('scope')).toBe('openid profile email offline_access');
    expect(target.searchParams.get('redirect_uri')).toBe(
      `http://localhost${API.ableOauthCallback}`,
    );
    expect(target.searchParams.get('code_challenge_method')).toBe('S256');
    expect(target.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(target.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(target.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const db = (store as unknown as {db: {query<T>(sql: string): Promise<T[]>}}).db;
    const [saved] = await db.query<{state_hash: string; code_verifier_ciphertext: string}>(
      'SELECT state_hash, code_verifier_ciphertext FROM able_oidc_states',
    );
    const rawState = target.searchParams.get('state') ?? '';
    expect(saved.state_hash).toBe(createHash('sha256').update(rawState).digest('hex'));
    expect(saved.state_hash).not.toContain(rawState);
    expect(saved.code_verifier_ciphertext).not.toBe(target.searchParams.get('code_challenge'));
  });

  it('rejects mismatched state before the token endpoint and consumes a valid state only once', async () => {
    const idp = await idpHarness();
    const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});
    const target = await begin(app);
    idp.setNonce(target.searchParams.get('nonce') ?? '');

    const mismatch = await app.request(`${API.ableOauthCallback}?state=wrong&code=code-1`);
    expect(mismatch.status).toBe(400);
    expect(idp.tokenCalls).toHaveLength(0);

    const state = target.searchParams.get('state') ?? '';
    const first = await app.request(
      `${API.ableOauthCallback}?state=${encodeURIComponent(state)}&code=code-1`,
    );
    expect(first.status).toBe(302);
    expect(idp.tokenCalls).toHaveLength(1);
    const replay = await app.request(
      `${API.ableOauthCallback}?state=${encodeURIComponent(state)}&code=code-1`,
    );
    expect(replay.status).toBe(400);
    expect(idp.tokenCalls).toHaveLength(1);
  });

  it('rejects and does not exchange an expired state row', async () => {
    const idp = await idpHarness();
    const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});
    const target = await begin(app);
    const db = (store as unknown as {db: {query(sql: string): Promise<unknown>}}).db;
    await db.query('UPDATE able_oidc_states SET expires_at = TIMESTAMPTZ \'2000-01-01\'');
    const state = target.searchParams.get('state') ?? '';
    const callback = await app.request(
      `${API.ableOauthCallback}?state=${encodeURIComponent(state)}&code=late-code`,
    );
    expect(callback.status).toBe(400);
    expect(idp.tokenCalls).toHaveLength(0);
  });

  it('caps the live authorization state table at 5000 rows', async () => {
    const db = (store as unknown as {db: {query(sql: string): Promise<unknown>}}).db;
    await db.query(
      `INSERT INTO able_oidc_states
        (state_hash, code_verifier_ciphertext, code_verifier_iv, nonce, handoff_state, redirect_uri, expires_at)
       SELECT 'flood-' || n, 'ciphertext', 'iv', 'nonce', '', 'http://localhost/callback', now() + INTERVAL '10 minutes'
       FROM generate_series(1, 5000) AS n`,
    );
    const idp = await idpHarness();
    const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});

    const response = await app.request(API.ableOauthAuthorize);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({error: 'too many pending able sign-in requests'});
  });

  it('exchanges with client_secret_basic + the original verifier, encrypts secrets, and bridges to resolvePrincipal', async () => {
    const idp = await idpHarness();
    const identity = new IdentityService(store, {now: () => NOW});
    const app = createApp(store, undefined, new PageHub(), {
      ableOidc: idp.options,
      identity,
    });
    const target = await begin(app, 'ui-state-123');
    idp.setNonce(target.searchParams.get('nonce') ?? '');
    const state = target.searchParams.get('state') ?? '';
    const callback = await app.request(
      `${API.ableOauthCallback}?state=${encodeURIComponent(state)}&code=authorization-code`,
    );

    expect(callback.status).toBe(302);
    expect(idp.tokenCalls).toHaveLength(1);
    const exchange = idp.tokenCalls[0];
    const encodedSecret = new URLSearchParams({v: CLIENT_SECRET}).toString().slice(2);
    expect(exchange.authorization).toBe(
      `Basic ${Buffer.from(`${CLIENT_ID}:${encodedSecret}`).toString('base64')}`,
    );
    expect(exchange.body.get('grant_type')).toBe('authorization_code');
    expect(exchange.body.get('code')).toBe('authorization-code');
    expect(exchange.body.get('redirect_uri')).toBe(`http://localhost${API.ableOauthCallback}`);
    const verifier = exchange.body.get('code_verifier') ?? '';
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(
      target.searchParams.get('code_challenge'),
    );

    const handoff = new URL(callback.headers.get('location') ?? '');
    const fragment = new URLSearchParams(handoff.hash.slice(1));
    expect(handoff.pathname).toBe('/account/callback');
    expect(fragment.get('state')).toBe('ui-state-123');
    const assertion = fragment.get('token') ?? '';
    const info = await (
      await app.request(API.instance, {headers: {[IDENTITY_HEADER]: assertion}})
    ).json() as {you: Record<string, unknown>};
    expect(info.you).toMatchObject({
      kind: 'user',
      subject: `${UPSTREAM_ISSUER}#able-user-7`,
      issuer: UPSTREAM_ISSUER,
      name: 'Ada Able',
      email: 'ada@example.com',
      verifiedVia: 'jws',
    });
    const config = await store.getInstanceConfig();
    expect(config.emailAuthority).toBe(UPSTREAM_ISSUER);
    expect(config.trustedIssuers.find((entry) => entry.issuer === UPSTREAM_ISSUER)?.jwks?.keys).toHaveLength(1);

    const db = (store as unknown as {db: {query<T>(sql: string): Promise<T[]>}}).db;
    const [refresh] = await db.query<{token_ciphertext: string}>('SELECT token_ciphertext FROM able_oidc_refresh_tokens');
    expect(refresh.token_ciphertext).not.toContain('upstream-refresh-token-plaintext');
    const [key] = await db.query<{private_key_ciphertext: string}>('SELECT private_key_ciphertext FROM able_oidc_bridge_keys');
    expect(key.private_key_ciphertext).not.toContain('PRIVATE');
    const settings = await db.query<{value: string}>('SELECT value::text AS value FROM settings');
    expect(JSON.stringify(settings)).not.toContain(CLIENT_SECRET);
    expect(JSON.stringify(settings)).not.toContain('upstream-refresh-token-plaintext');
  });

  it('does not replace an existing same-issuer JWKS URL with the bridge key', async () => {
    const config = await store.getInstanceConfig();
    await store.updateInstanceConfig({
      trustedIssuers: [...config.trustedIssuers, {issuer: UPSTREAM_ISSUER, jwksUrl: JWKS_URL}],
    });
    const idp = await idpHarness();
    const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});
    const target = await begin(app);
    idp.setNonce(target.searchParams.get('nonce') ?? '');
    const state = target.searchParams.get('state') ?? '';

    const callback = await app.request(
      `${API.ableOauthCallback}?state=${encodeURIComponent(state)}&code=authorization-code`,
    );

    expect(callback.status).toBe(502);
    expect(await callback.json()).toEqual({error: 'able OIDC issuer conflicts with a configured JWKS URL'});
    expect(idp.tokenCalls).toHaveLength(1);
    const retained = (await store.getInstanceConfig()).trustedIssuers.find((entry) => entry.issuer === UPSTREAM_ISSUER);
    expect(retained).toMatchObject({jwksUrl: JWKS_URL});
    expect(retained?.jwks).toBeUndefined();
  });

  for (const kind of ['bad-iss', 'bad-aud', 'expired', 'bad-sig'] as const) {
    it(`rejects an ID token with ${kind}`, async () => {
      const idp = await idpHarness();
      idp.setTokenKind(kind);
      const app = createApp(store, undefined, new PageHub(), {ableOidc: idp.options});
      const target = await begin(app);
      idp.setNonce(target.searchParams.get('nonce') ?? '');
      const state = target.searchParams.get('state') ?? '';
      const callback = await app.request(
        `${API.ableOauthCallback}?state=${encodeURIComponent(state)}&code=bad-token-code`,
      );
      expect(callback.status).toBe(400);
      expect(await callback.json()).toEqual({error: 'able ID token could not be verified'});
    });
  }

  it('uses last-good discovery while offline and exempts both routes from access/guest/PAT gates', async () => {
    const idp = await idpHarness();
    const identity = new IdentityService(store, {now: () => NOW});
    await store.updateInstanceConfig({guestAccess: 'off'});
    await store.setSetting(AGENT_API_SETTING_KEY, {enabled: true, remote: false});
    const pat = generateAgentToken();
    await store.createAgentToken({
      name: 'read only',
      tokenHash: pat.hash,
      preview: pat.preview,
      subject: 'local:owner',
      issuer: 'local',
      scope: 'read',
      createdBy: 'test',
      expiresAt: new Date(NOW + 60_000),
    });
    const app = createApp(store, undefined, new PageHub(), {
      ableOidc: {...idp.options, discoveryTtlMs: 0},
      accessToken: 'lan-secret',
      identity,
    });

    // Valid PAT proves the default-deny PAT path allowlist is explicitly bypassed.
    const patRedirect = await app.request(API.ableOauthAuthorize, {
      headers: {authorization: `Bearer ${pat.token}`},
    });
    expect(patRedirect.status).toBe(302);
    idp.failDiscovery();
    // No bearer proves the instance reachability gate and guestAccess:'off' are
    // bypassed for the callback-entry route; cached discovery survives offline.
    const plainRedirect = await app.request(API.ableOauthAuthorize);
    expect(plainRedirect.status).toBe(302);
    expect(idp.discoveryCalls()).toBe(2);
  });

  it('records the additive OIDC migration and all secret-state tables', async () => {
    const db = (store as unknown as {db: {query<T>(sql: string): Promise<T[]>}}).db;
    const applied = await db.query<{name: string}>(
      'SELECT name FROM _migrations WHERE name = \'0029_able_oidc\'',
    );
    expect(applied).toHaveLength(1);
    const tables = await db.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'able_oidc_%'`,
    );
    expect(tables.map((row) => row.table_name).sort()).toEqual([
      'able_oidc_bridge_keys',
      'able_oidc_refresh_tokens',
      'able_oidc_states',
    ]);
  });
});
