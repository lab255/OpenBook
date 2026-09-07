/** HTTP routes for the optional able server-side OIDC relying party. */

import {API} from '@book.dev/sdk';
import type {Hono} from 'hono';
import type {AppEnv} from './appEnv';
import type {PageStore} from './store';
import {AbleOidcError, AbleOidcService, type AbleOidcOptions} from './ableOidc';

export const isAbleOidcPublicRequest = (method: string, path: string): boolean =>
  method === 'GET' && (path === API.ableOauthAuthorize || path === API.ableOauthCallback);

export function mountAbleOidcRoutes(
  app: Hono<AppEnv>,
  store: PageStore,
  options: AbleOidcOptions,
): void {
  const oidc = new AbleOidcService(store, options);

  app.get(API.ableOauthAuthorize, async (c) => {
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
}
