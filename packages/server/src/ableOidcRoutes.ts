/** HTTP routes for the optional able server-side OIDC relying party. */

import {API} from '@book.dev/sdk';
import type {Hono} from 'hono';
import type {AppEnv} from './appEnv';
import type {PageStore} from './store';
import {AbleOidcError, AbleOidcService, type AbleOidcOptions} from './ableOidc';
import {FixedWindowLimiter, clientIpKey} from './agentTokens';

const ABLE_REFRESH_RATE_LIMIT = 30;
const ABLE_REFRESH_RATE_WINDOW_MS = 60_000;

export const isAbleOidcPublicRequest = (method: string, path: string): boolean =>
  (method === 'GET' && (path === API.ableOauthAuthorize || path === API.ableOauthCallback)) ||
  ((method === 'POST' || method === 'DELETE') && path === API.ableOauthRefresh);

function bearerAssertion(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) throw new AbleOidcError(401, 'able session could not be renewed');
  const assertion = header.slice(7);
  if (!assertion || assertion.length > 16_384) {
    throw new AbleOidcError(401, 'able session could not be renewed');
  }
  return assertion;
}

export function mountAbleOidcRoutes(
  app: Hono<AppEnv>,
  store: PageStore,
  options: AbleOidcOptions,
): void {
  const oidc = new AbleOidcService(store, options);
  const refreshLimiter = new FixedWindowLimiter(ABLE_REFRESH_RATE_LIMIT, ABLE_REFRESH_RATE_WINDOW_MS);

  app.get(API.ableOauthAuthorize, async (c) => {
    // Same-origin web shells use this side-effect-free capability probe to
    // choose delegated sign-in only when the server actually mounted it.
    if (c.req.query('probe') === '1') return c.body(null, 204);
    try {
      const origin = new URL(c.req.url).origin;
      const target = await oidc.authorizationUrl(origin, c.req.query('handoff_state') ?? '');
      return c.redirect(target, 302);
    } catch (error) {
      const known = error instanceof AbleOidcError ? error : new AbleOidcError(502, 'able sign-in is unavailable');
      return c.json({error: known.message}, known.status);
    }
  });

  app.get(API.ableOauthCallback, async (c) => {
    try {
      if (c.req.query('error')) {
        throw new AbleOidcError(400, 'able authorization was not completed');
      }
      const origin = new URL(c.req.url).origin;
      const target = await oidc.callback(origin, c.req.query('state') ?? '', c.req.query('code') ?? '');
      return c.redirect(target, 302);
    } catch (error) {
      const known = error instanceof AbleOidcError ? error : new AbleOidcError(502, 'able sign-in failed');
      return c.json({error: known.message}, known.status);
    }
  });

  app.post(API.ableOauthRefresh, async (c) => {
    try {
      if (refreshLimiter.exceeded(clientIpKey(c))) {
        c.header('Retry-After', String(ABLE_REFRESH_RATE_WINDOW_MS / 1000));
        throw new AbleOidcError(429, 'too many able session requests');
      }
      const identity = await oidc.refresh(bearerAssertion(c.req.header('Authorization')));
      return c.json(identity);
    } catch (error) {
      const known = error instanceof AbleOidcError
        ? error
        : new AbleOidcError(502, 'able session could not be renewed');
      return c.json({error: known.message}, known.status);
    }
  });

  app.delete(API.ableOauthRefresh, async (c) => {
    try {
      if (refreshLimiter.exceeded(clientIpKey(c))) {
        c.header('Retry-After', String(ABLE_REFRESH_RATE_WINDOW_MS / 1000));
        throw new AbleOidcError(429, 'too many able session requests');
      }
      await oidc.remove(bearerAssertion(c.req.header('Authorization')));
      return c.body(null, 204);
    } catch (error) {
      const known = error instanceof AbleOidcError
        ? error
        : new AbleOidcError(502, 'able session could not be removed');
      return c.json({error: known.message}, known.status);
    }
  });
}
