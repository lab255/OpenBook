/**
 * SEC-1: owner-only settings must not fall open while an instance is unclaimed.
 *
 * The risky deployment is the documented headless LAN mode: an access token
 * admits the request to the server, but it proves reachability only and resolves
 * to an anonymous guest. Each field accepted by the two swept settings routes is
 * pinned independently so a future field cannot silently inherit the old
 * `ownerSubject && deny` behavior.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  DEFAULT_ACCOUNT_URL,
  LOCAL_OWNER_HEADER,
  mintIdentityKeypair,
  signIdentity,
  type BackupConfig,
  type IdentityKeypair,
  type InstanceConfig,
} from '@book.dev/sdk';
import {createApp} from './app';
import {BackupScheduler} from './backups';
import {PgliteDb} from './db';
import {PageHub} from './hub';
import {IdentityService} from './instanceConfig';
import {IDENTITY_HEADER} from './principal';
import {PageStore} from './store';

const ISS = 'https://sec1.test';
const LAN_TOKEN = 'sec1-lan-token';
const LOCAL_OWNER_SECRET = 'sec1-local-owner-secret';
const CLIENT_HEADERS = {
  Authorization: `Bearer ${LAN_TOKEN}`,
  'Content-Type': 'application/json',
  'X-OpenBook-Client': '1',
};

let store: PageStore;
let keys: IdentityKeypair;

beforeEach(async () => {
  store = new PageStore(await PgliteDb.create('memory://'));
  await store.migrate();
  keys = await mintIdentityKeypair('sec1');
  await store.updateInstanceConfig({
    trustedIssuers: [
      {
        issuer: DEFAULT_ACCOUNT_URL,
        jwksUrl: `${DEFAULT_ACCOUNT_URL}/api/identity/jwks`,
        revocationsUrl: `${DEFAULT_ACCOUNT_URL}/api/identity/revocations`,
      },
      {issuer: ISS, jwks: {keys: [keys.publicJwk]}},
    ],
  });
});

afterEach(async () => {
  await store.close();
});

const app = (localOwnerSecret?: string) =>
  createApp(store, undefined, new PageHub(), {
    accessToken: LAN_TOKEN,
    localOwnerSecret,
    identity: new IdentityService(store),
    backups: new BackupScheduler(store, {defaultDir: null}),
  });

const put = (path: string, body: unknown, extraHeaders: Record<string, string> = {}) =>
  app(extraHeaders[LOCAL_OWNER_HEADER] ? LOCAL_OWNER_SECRET : undefined).request(path, {
    method: 'PUT',
    headers: {...CLIENT_HEADERS, ...extraHeaders},
    body: JSON.stringify(body),
  });

const INSTANCE_FIELDS = {
  guestAccess: 'read',
  agentEdits: 'direct',
  instanceId: 'attacker-selected-instance-id',
  trustedIssuers: [
    {issuer: DEFAULT_ACCOUNT_URL, jwksUrl: `${DEFAULT_ACCOUNT_URL}/api/identity/jwks`},
    {issuer: 'https://attacker.test'},
  ],
  audience: 'https://attacker.test',
  requireAudience: true,
  defaultVisibility: 'public',
  emailAuthority: ISS,
  libraryBinding: {libraryId: 'attacker-library'},
  ledgerAutoExportPath: '/tmp/sec1-attacker-export.csv',
} satisfies Record<Exclude<keyof InstanceConfig, 'ownerSubject'>, unknown>;

const BACKUP_FIELDS = {
  enabled: false,
  userSetEnabled: true,
  dir: '/tmp/sec1-attacker-backups',
  cadences: {daily: false},
  keep: {daily: 99},
  lastRun: {daily: '2026-09-08T00:00:00.000Z'},
  lastSkippedCount: {daily: 99},
  failures: {
    daily: {
      failedAt: '2026-09-08T00:00:00.000Z',
      retryAt: '2026-09-09T00:00:00.000Z',
      attempts: 99,
      message: 'attacker-controlled',
    },
  },
} satisfies Record<keyof BackupConfig, unknown>;

describe('unclaimed instance-policy owner gate', () => {
  it.each(Object.entries(INSTANCE_FIELDS))(
    'denies a shared-LAN-token guest writing %s',
    async (field, value) => {
      const before = await store.getInstanceConfig();
      const response = await put('/api/instance', {[field]: value});
      expect(response.status).toBe(403);
      expect(await store.getInstanceConfig()).toEqual(before);
    },
  );

  it('denies a remote verified identity writing policy before it claims', async () => {
    const identity = await signIdentity(
      keys.privateKey,
      {
        iss: ISS,
        sub: 'remote-user',
        name: 'Remote user',
        iat: Math.floor(Date.now() / 1000) - 30,
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'sec1-remote-user',
      },
      keys.publicJwk.kid,
    );
    const response = await put('/api/instance', {guestAccess: 'off'}, {[IDENTITY_HEADER]: identity});
    expect(response.status).toBe(403);
    expect((await store.getInstanceConfig()).guestAccess).toBe('write');
  });
});

describe('unclaimed backup-policy owner gate', () => {
  it.each(Object.entries(BACKUP_FIELDS))(
    'denies a shared-LAN-token guest writing %s',
    async (field, value) => {
      const before = await store.getBackupConfig();
      const response = await put('/api/backups', {[field]: value});
      expect(response.status).toBe(403);
      expect(await store.getBackupConfig()).toEqual(before);
    },
  );

  it('keeps the local-owner first-run backup settings flow working', async () => {
    const response = await put(
      '/api/backups',
      {enabled: false},
      {[LOCAL_OWNER_HEADER]: LOCAL_OWNER_SECRET},
    );
    expect(response.status).toBe(200);
    expect((await store.getBackupConfig()).enabled).toBe(false);
  });
});
