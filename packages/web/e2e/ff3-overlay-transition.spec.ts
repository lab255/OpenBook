import {test, expect} from './fixtures';
import {newPage} from './seed';
import type {Locator} from '@playwright/test';

async function expectBoundedTransition(overlay: Locator): Promise<void> {
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCSS('transition-property', 'opacity, transform');
}

// Manager-run browser proof: keyframes do not change the transition-property
// initial value of "all". Assert computed styles on each real mounted overlay.
test('FF-3: dropdown, dialog scrim/panel and Settings bound transition properties', {tag: ['@shell']}, async ({page, request}) => {
  const id = await newPage(request, 'FF-3 overlay transitions');
  await page.goto(`/?page=${id}`);

  await page.getByRole('button', {name: 'Page actions', exact: true}).click();
  await expectBoundedTransition(page.getByRole('menu'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  await page.getByRole('button', {name: 'Share', exact: true}).click();
  await expectBoundedTransition(page.getByRole('dialog'));
  await expectBoundedTransition(page.locator('[data-slot="dialog-overlay"]'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', {name: 'Settings', exact: true}).first().click();
  await expectBoundedTransition(page.getByRole('dialog', {name: 'Settings', exact: true}));
  await expectBoundedTransition(page.locator('[data-slot="dialog-overlay"]'));
});
