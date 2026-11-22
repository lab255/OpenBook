import {test, expect} from './fixtures';
import {SERVER, emptySnapshot} from './seed';
import {writeFileSync} from 'node:fs';

// CARD7_SINGLE_PROCESS: sandboxed reviewer environments deny Chromium's
// multi-process Mach-port rendezvous; single-process mode survives there but
// only one test per invocation (drive each width via --grep).
test.use({
  freshWorkspace: true,
  mockAi: true,
  ...(process.env.CARD7_SINGLE_PROCESS ? {launchOptions: {args: ['--single-process', '--no-zygote']}} : {}),
});
for (const width of [1280, 390]) {
  test(`eyebrow captures ${width}`, async ({ownerPage: page, request}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({width, height: 900});
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    const phase = process.env.CAPTURE_PHASE ?? 'before';
    const dir = process.env.CARD7_CAPTURE_DIR!;
    async function capture(name: string, opts: {skipMouse?: boolean} = {}) {
      await page.evaluate(() => document.fonts.ready);
      // The narrow drawer dismisses on pointer activity; park the mouse
      // beforehand for that surface instead of moving mid-capture.
      if (!opts.skipMouse) await page.mouse.move(0, 0);
      await page.screenshot({path: `${dir}/${phase}-${width}-${name}.png`});
      const labels = await page.locator('h5, [cmdk-group-heading], span, p, .obe-slash-group').evaluateAll(nodes => nodes.filter(n => {
        const s = getComputedStyle(n); const r = n.getBoundingClientRect();
        return r.width && r.height && r.x >= 0 && r.x < innerWidth && r.y >= 0 && r.y < innerHeight && s.fontWeight >= '500' && (n.textContent?.length ?? 0) < 80;
      }).map(n => {const s=getComputedStyle(n);const r=n.getBoundingClientRect();return {text:n.textContent,transform:s.textTransform,spacing:s.letterSpacing,x:r.x,y:r.y,width:r.width,height:r.height,client:n.clientWidth,scroll:n.scrollWidth};}));
      writeFileSync(`${dir}/${phase}-${width}-${name}.json`, JSON.stringify(labels,null,2));
    }
    await page.goto('/');
    await expect(page.locator('[data-home-screen]')).toBeVisible();
    if (width === 390) {
      // DefaultLayout dismisses the narrow drawer on first mount and again
      // when currentPageId resolves, so an early toggle gets auto-closed.
      // Retry until the drawer is open AND stays open across that window,
      // and re-ensure right before each dependent step.
      const dialog = page.locator('[data-sidebar-drawer][role="dialog"]');
      const ensureDrawer = () => expect(async () => {
        if (!(await dialog.isVisible())) await page.getByRole('button',{name:'Toggle sidebar'}).click();
        await expect(dialog).toBeVisible({timeout: 1_000});
        await page.waitForTimeout(700);
        await expect(dialog).toBeVisible({timeout: 250});
      }).toPass({timeout: 30_000});
      await page.waitForTimeout(1_500);
      await page.mouse.move(0, 0);
      await ensureDrawer();
      await capture('sidebar', {skipMouse: true});
      if (!(await dialog.isVisible())) {
        await ensureDrawer();
        await capture('sidebar', {skipMouse: true});
      }
      await ensureDrawer();
    } else {
      await capture('sidebar');
    }
    await page.getByRole('button',{name:'Settings', exact:true}).first().click();
    await page.getByRole('button',{name:'General',exact:true}).click();
    await expect(page.getByText('Danger zone',{exact:true})).toBeVisible();
    await capture('settings-general');
    await page.getByRole('button',{name:'Backups & data',exact:true}).click();
    await expect(page.getByText('Backup & restore',{exact:true})).toBeVisible();
    await capture('settings-backups');
    await page.getByRole('button',{name:'Sharing & publishing',exact:true}).click();
    await page.getByRole('heading',{name:'Invite a member',exact:true}).scrollIntoViewIfNeeded();
    await capture('settings-members-invite');
    await page.getByRole('heading',{name:'Current members',exact:true}).scrollIntoViewIfNeeded();
    await capture('settings-members-roster');
    await page.getByRole('button',{name:'Profile',exact:true}).click();
    await page.locator('#ob-profile-avatar').click();
    await expect(page.getByPlaceholder('Search emoji…')).toBeVisible();
    await capture('emoji');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.goto('/');
    await expect(page.locator('[data-home-screen]')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByPlaceholder(/Search pages or run a command/)).toBeVisible();
    await capture('command');
    await page.getByPlaceholder(/Search pages or run a command/).fill('Ask the assistant');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-agent-panel]')).toBeVisible();
    await page.locator('[data-agent-modelbar]').click();
    await expect(page.locator('[data-agent-provider]')).toBeVisible();
    await capture('agent');
    const p = await request.post(`${SERVER}/api/pages`,{data:{name:'Capture database',data:emptySnapshot}});
    const pageId=(await p.json()).id;
    const d=await request.post(`${SERVER}/api/databases`,{data:{pageId,name:'Capture database',schema:{properties:[{id:'status',name:'A deliberately long property label',type:'text'}],views:[{id:'table',name:'Table',type:'table',filters:[],sorts:[]}]}}});
    const dbId=(await d.json()).id;
    const row=await request.post(`${SERVER}/api/databases/${dbId}/rows`,{data:{name:'Review typography',properties:{status:'Ready'}}});
    const rowId=(await row.json()).id;
    await page.goto(`/?page=${rowId}`);
    await expect(page.getByRole('button',{name:'Configure properties'})).toBeAttached();
    await capture('row-properties');
    await page.getByRole('button',{name:'Configure properties'}).click({force:true});
    await expect(page.getByText('Groups',{exact:true})).toBeVisible();
    await capture('row-properties-config');
  });
}
