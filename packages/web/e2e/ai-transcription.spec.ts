import type {AiStatus} from '@book.dev/sdk';
import {test, expect} from './fixtures';

test.use({ownerGatedRequests: true});

function fresh(): AiStatus {
  return {config: {provider: 'off'}, ready: false, embeddings: false, index: {pages: 0, builtAt: null},
    transcription: {model: 'base', modelPresent: false, runtimeAvailable: false, ready: false, downloadUrl: 'https://fixture.test/base.bin',
      runtime: {target: 'fixture', tools: {'whisper-cli': {status: 'missing'}, ffmpeg: {status: 'missing'}}}},
  };
}

async function open(page: import('@playwright/test').Page, status: AiStatus) {
  await page.route('**/api/ai/status', (route) => route.fulfill({json: status}));
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Page actions'})).toBeVisible();
  await page.keyboard.press('ControlOrMeta+,');
  await page.getByRole('button', {name: 'AI', exact: true}).click();
  return page.locator('section').filter({has: page.getByLabel('Transcription provider')});
}

test('one click enables runtime and model stages, then shows ready', async ({page}) => {
  const status = fresh();
  let clicks = 0;
  await page.route('**/api/ai/models/download', async (route) => {
    clicks++;
    expect(route.request().postDataJSON()).toEqual({url: status.transcription!.downloadUrl});
    status.transcription!.runtime!.tools['whisper-cli'].status = 'provisioning';
    status.download = {url: status.transcription!.downloadUrl, received: 0, total: null, done: false};
    await route.fulfill({json: status.download});
  });
  const audio = await open(page, status);
  await expect(audio.getByRole('button', {name: 'Enable local transcription'})).toHaveCount(1);
  await audio.getByRole('button', {name: 'Enable local transcription'}).click();
  await expect(audio.getByText('whisper-cli: Preparing runtime…')).toBeVisible();
  await expect(audio.getByRole('button', {name: 'Setting up local transcription…'})).toBeDisabled();
  status.transcription!.runtime!.tools = {'whisper-cli': {status: 'provisioned'}, ffmpeg: {status: 'provisioned'}};
  status.download = {...status.download!, received: 50, total: 100};
  await expect(audio.getByText('Whisper model: Downloading 50%')).toBeVisible();
  Object.assign(status.transcription!, {ready: true, modelPresent: true, runtimeAvailable: true});
  status.download.done = true;
  await expect(audio.getByText('Ready to transcribe.')).toBeVisible();
  await expect(audio.getByRole('button', {name: /local transcription/})).toHaveCount(0);
  expect(clicks).toBe(1);
});

for (const state of ['unsupported', 'model-update', 'runtime-update', 'failed', 'override'] as const) {
  test(`transcription: ${state}`, async ({page}) => {
    const status = fresh();
    const audioStatus = status.transcription!;
    if (state === 'unsupported') audioStatus.runtime!.tools = {'whisper-cli': {status: 'unsupported'}, ffmpeg: {status: 'provisioned'}};
    if (state === 'model-update') audioStatus.modelUpdateAvailable = true;
    if (state === 'runtime-update') audioStatus.runtime!.tools.ffmpeg = {status: 'missing', installedVersion: '1', version: '2'};
    if (state === 'failed') audioStatus.runtime!.tools.ffmpeg = {status: 'failed', detail: 'Network unavailable'};
    if (state === 'override') audioStatus.runtime!.tools['whisper-cli'] = {status: 'unsupported', override: 'OPENBOOK_WHISPER_BIN', available: true};
    const audio = await open(page, status);
    if (state === 'unsupported') {
      await expect(audio.getByText(/Built-in runtime unavailable.*OPENBOOK_WHISPER_BIN/)).toBeVisible();
      await expect(audio.getByRole('alert')).toHaveCount(0);
    } else if (state.endsWith('update')) await expect(audio.getByRole('button', {name: 'Update local transcription'})).toBeVisible();
    else if (state === 'failed') await expect(audio.getByRole('alert')).toHaveText('ffmpeg: Failed: Network unavailable');
    else await expect(audio.getByText('whisper-cli: Using OPENBOOK_WHISPER_BIN.')).toBeVisible();
  });
}
