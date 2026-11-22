import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';

test.use({freshWorkspace: true, mockAi: true});

async function holdOpeningNavigation(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Settings', exact: true}).first()).toBeVisible();
  // Harness-only gate: Next's real transition has started, but its route-info
  // promise cannot resolve until after a real Escape has closed the dialog.
  await page.evaluate(() => {
    type RouteArgs = {query: Record<string, unknown>};
    type Router = {getRouteInfo: (args: RouteArgs) => Promise<unknown>; events: {on: (event: string, fn: (url: string) => void) => void}};
    const w = window as typeof window & {next: {router: Router}; settingsRace?: {held: boolean; release: () => void; events: {kind: string; url: string}[]}};
    const router = w.next.router;
    const original = router.getRouteInfo;
    const events: {kind: string; url: string}[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const state: NonNullable<typeof w.settingsRace> = w.settingsRace = {held: false, release, events};
    for (const event of ['routeChangeStart', 'routeChangeComplete']) {
      router.events.on(event, url => events.push({kind: event, url}));
    }
    router.getRouteInfo = async function(args) {
      const result = await original.call(this, args);
      if (!state.held && args.query.settings !== undefined) {
        state.held = true;
        events.push({kind: 'held', url: location.href});
        await gate;
      }
      return result;
    };
  });
}

async function openSettings(page: Page) {
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByPlaceholder(/Search pages or run a command/);
  await expect(search).toBeFocused();
  await search.fill('Open settings');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {name: 'Settings', exact: true});
  await expect(dialog).toBeVisible();
}

for (const reopen of [false, true]) {
  test(`settings: latest HUD ${reopen ? 'reopen' : 'close'} supersedes delayed opening navigation`, async ({page}, testInfo) => {
    await holdOpeningNavigation(page);
    await openSettings(page);
    const dialog = page.getByRole('dialog', {name: 'Settings', exact: true});
    await expect.poll(() => page.evaluate(() => (window as typeof window & {settingsRace: {held: boolean}}).settingsRace.held)).toBe(true);
    await expect(page).not.toHaveURL(/settings=/);
    await expect(dialog.getByPlaceholder('Search settings…')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    if (reopen) await openSettings(page);
    await page.evaluate(() => {
      const state = (window as typeof window & {settingsRace: {release: () => void; events: {kind: string; url: string}[]}}).settingsRace;
      state.events.push({kind: 'closed-before-release', url: location.href});
      state.release();
    });
    await expect.poll(() => page.evaluate(() => (window as typeof window & {settingsRace: {events: {kind: string; url: string}[]}}).settingsRace.events.some(event => event.kind === 'routeChangeComplete' && event.url.includes('settings=')))).toBe(true);
    if (reopen) {
      await expect(page).toHaveURL(/settings=/);
      await expect(dialog).toBeVisible();
    } else {
      await expect(page).not.toHaveURL(/settings=/);
      await expect(dialog).toBeHidden();
    }
    const events = await page.evaluate(() => (window as typeof window & {settingsRace: {events: {kind: string; url: string}[]}}).settingsRace.events);
    const closed = events.findIndex(event => event.kind === 'closed-before-release');
    const complete = events.findIndex(event => event.kind === 'routeChangeComplete' && event.url.includes('settings='));
    expect(closed).toBeGreaterThan(-1);
    expect(complete).toBeGreaterThan(closed);
    await testInfo.attach('settings-race-order', {body: JSON.stringify(events, null, 2), contentType: 'application/json'});
  });
}

test('settings: external Back and Forward retain URL authority', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Settings', exact: true}).first()).toBeVisible();
  // Hold Next's render completion AFTER pushState, so Back also exercises a
  // late completion from the now-superseded forward navigation.
  await page.evaluate(() => {
    type Router = {set: (state: {query: Record<string, unknown>}, ...rest: unknown[]) => Promise<unknown>; events: {on: (name: string, fn: (url: string) => void) => void}};
    const w = window as typeof window & {next: {router: Router}; backGate?: {held: boolean; completed: boolean; release: () => Promise<void>}};
    const router = w.next.router, original = router.set;
    let release!: () => void, complete!: () => void;
    const gate = new Promise<void>(resolve => {release = resolve;});
    const done = new Promise<void>(resolve => {complete = resolve;});
    const control: NonNullable<typeof w.backGate> = w.backGate = {held: false, completed: false, release: async () => {release(); await done;}};
    router.events.on('routeChangeComplete', url => {
      if (control.held && url.includes('settings=')) control.completed = true;
    });
    router.set = async function(state, ...rest) {
      if (!control.held && state.query.settings !== undefined) {
        control.held = true;
        await gate;
        const result = await original.call(this, state, ...rest);
        complete();
        return result;
      }
      return original.call(this, state, ...rest);
    };
  });
  await openSettings(page);
  const dialog = page.getByRole('dialog', {name: 'Settings', exact: true});
  await expect(page).toHaveURL(/settings=/);
  await expect.poll(() => page.evaluate(() => (window as typeof window & {backGate: {held: boolean}}).backGate.held)).toBe(true);
  await page.goBack();
  await expect(page).not.toHaveURL(/settings=/);
  await expect(dialog).toBeHidden();
  await page.evaluate(() => (window as typeof window & {backGate: {release: () => Promise<void>}}).backGate.release());
  await expect.poll(() => page.evaluate(() => (window as typeof window & {backGate: {completed: boolean}}).backGate.completed)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expect(page).not.toHaveURL(/settings=/);
  await expect(dialog).toBeHidden();
  await page.goForward();
  await expect(page).toHaveURL(/settings=/);
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
});

test('settings: genuine deep links and reload retain URL authority', async ({page}) => {
  await page.goto('/?settings=profile');
  const dialog = page.getByRole('dialog', {name: 'Settings', exact: true});
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/settings=profile/);
  // Stability observation: a transient open-then-close is not restoration.
  await page.waitForTimeout(250);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/settings=profile/);
  await expect(page.locator('#ob-profile-name')).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/settings=profile/);
  // Stability observation: a transient open-then-close is not restoration.
  await page.waitForTimeout(250);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/settings=profile/);
  await expect(page.locator('#ob-profile-name')).toBeVisible();
  await page.goto('/');
  await expect(dialog).toBeHidden();
});

test('settings: Escape after ordinary opening completion closes and removes param', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Settings', exact: true}).first()).toBeVisible();
  await page.evaluate(() => {
    const w = window as typeof window & {next: {router: {events: {on: (name: string, fn: (url: string) => void) => void}}}; settingsOpened?: boolean};
    w.next.router.events.on('routeChangeComplete', url => { if (url.includes('settings=')) w.settingsOpened = true; });
  });
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => (window as typeof window & {settingsOpened?: boolean}).settingsOpened)).toBe(true);
  const dialog = page.getByRole('dialog', {name: 'Settings', exact: true});
  await expect(dialog.getByPlaceholder('Search settings…')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/settings=/);
});
