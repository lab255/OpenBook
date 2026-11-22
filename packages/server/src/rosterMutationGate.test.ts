/**
 * SEC-3: instance-wide roster mutations must fail closed before claim.
 *
 * A headless LAN bearer token authenticates reachability but still resolves to
 * an anonymous guest. Pin every member/sync mutation for both that deployment
 * posture and an ordinary anonymous caller, while retaining the trusted local
 * first-run path used by the desktop host.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LOCAL_OWNER_HEADER} from '@book.dev/sdk';
import {createApp} from './app';
import {PgliteDb} from './db';
import {PageHub} from './hub';
import {IdentityService} from './instanceConfig';
import type {RosterController} from './rosterSync';
import {PageStore} from './store';

const LAN_TOKEN = 'sec3-lan-token';
const LOCAL_OWNER_SECRET = 'sec3-local-owner-secret';

let store: PageStore;
let memberId: string;
let roster: RosterController;
let syncNow: RosterController['syncNow'];

beforeEach(async () => {
  store = new PageStore(await PgliteDb.create('memory://'));
  await store.migrate();
  memberId = (await store.addMember({
    email: 'existing@example.com',
    role: 'viewer',
    status: 'invited',
  })).id;
  syncNow = vi.fn<RosterController['syncNow']>()
    .mockResolvedValue({added: 0, updated: 0, removed: 0, skipped: 0});
  roster = {
    status: vi.fn().mockResolvedValue({
      bound: true,
      libraryId: 'sec3-library',
      accountBaseUrl: 'https://account.example.test',
      lastSyncAt: null,
      lastResult: null,
      lastError: null,
    }),
    syncNow,
  };
});

afterEach(async () => {
  await store.close();
});

type Mutation = {
  label: string;
  request: () => {path: string; init: RequestInit};
};

const mutations = (): Mutation[] => [
  {
    label: 'POST /api/members',
    request: () => ({
      path: '/api/members',
      init: {method: 'POST', body: JSON.stringify({invitee: 'new@example.com'})},
    }),
  },
  {
    label: 'PATCH /api/members/:id',
    request: () => ({
      path: `/api/members/${memberId}`,
      init: {method: 'PATCH', body: JSON.stringify({role: 'admin'})},
    }),
  },
  {
    label: 'DELETE /api/members/:id',
    request: () => ({path: `/api/members/${memberId}`, init: {method: 'DELETE'}}),
  },
  {
    label: 'POST /api/library/sync',
    request: () => ({path: '/api/library/sync', init: {method: 'POST'}}),
  },
  {
    label: 'POST /api/workspace/sync alias',
    request: () => ({path: '/api/workspace/sync', init: {method: 'POST'}}),
  },
];

describe.each([
  {caller: 'anonymous', accessToken: undefined, authorization: undefined},
  {caller: 'shared-LAN-token guest', accessToken: LAN_TOKEN, authorization: `Bearer ${LAN_TOKEN}`},
])('unclaimed roster mutation gate ($caller)', ({accessToken, authorization}) => {
  it.each(mutations())('denies $label without changing roster state', async ({request}) => {
    const before = await store.listMembers();
    const {path, init} = request();
    const app = createApp(store, undefined, new PageHub(), {
      accessToken,
      identity: new IdentityService(store),
      roster,
    });
    const response = await app.request(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-OpenBook-Client': '1',
        ...(authorization ? {Authorization: authorization} : {}),
      },
    });

    expect(response.status).toBe(403);
    expect(await store.listMembers()).toEqual(before);
    expect(syncNow).not.toHaveBeenCalled();
  });
});

describe('unclaimed local-owner roster flow', () => {
  it('keeps member mutations and both sync routes available during local first-run', async () => {
    const app = createApp(store, undefined, new PageHub(), {
      identity: new IdentityService(store),
      localOwnerSecret: LOCAL_OWNER_SECRET,
      roster,
    });
    const headers = {
      'Content-Type': 'application/json',
      'X-OpenBook-Client': '1',
      [LOCAL_OWNER_HEADER]: LOCAL_OWNER_SECRET,
    };
    const invited = await app.request('/api/members', {
      method: 'POST',
      headers,
      body: JSON.stringify({invitee: 'local@example.com'}),
    });
    expect(invited.status).toBe(201);
    const {id} = (await invited.json()) as {id: string};

    expect((await app.request(`/api/members/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({role: 'admin'}),
    })).status).toBe(200);
    expect((await app.request(`/api/members/${id}`, {method: 'DELETE', headers})).status).toBe(204);
    expect((await app.request('/api/library/sync', {method: 'POST', headers})).status).toBe(200);
    expect((await app.request('/api/workspace/sync', {method: 'POST', headers})).status).toBe(200);
    expect(syncNow).toHaveBeenCalledTimes(2);
  });
});
