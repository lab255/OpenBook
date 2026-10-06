import {readFile} from 'node:fs/promises';
import type {Download, Page} from '@playwright/test';
import {unzipSync} from 'fflate';
import {expect, test} from './fixtures';

test.use({freshWorkspace: true, mockAi: true});

async function insertMeeting(page: Page): Promise<void> {
  const text = page.locator('.obe-text').first();
  await expect(text).toBeVisible();
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/meeting');
  await page.locator('.obe-slash-item', {
    has: page.locator('.obe-slash-label', {hasText: /^Meeting$/}),
  }).click();
  await expect(page.getByRole('region', {name: 'Meeting', exact: true})).toBeVisible();
}

async function downloadBytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(await download.path());
  expect(bytes.length).toBeGreaterThan(0);
  return bytes;
}

test.beforeEach(async ({page, request, dataServer}) => {
  const response = await request.post(`${dataServer}/api/pages`, {data: {
    name: 'Meeting epic',
    data: {editor: 'blocks', blockdoc: {blocks: [
      {id: 'intro', type: 'paragraph', text: [{t: 'Meeting agenda'}]},
    ]}, editorjs: {blocks: []}, values: [], names: []},
  }});
  expect(response.ok()).toBeTruthy();
  const {id} = await response.json() as {id: string};
  await page.addInitScript(() => {
    // Chromium's fake-media launch flags do not expose audioinput on every
    // build. Keep the real MediaRecorder and supply a WebAudio audio track.
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {configurable: true, writable: true, value: async () => {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const destination = audio.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      await audio.resume();
      destination.stream.getTracks()[0].addEventListener('ended', () => { void audio.close(); });
      return destination.stream;
    }});
  });
  await page.goto(`/?page=${id}`);
  await insertMeeting(page);
});

test('record, progressively transcribe, summarize, note and export a meeting', {tag: ['@meeting', '@p1']}, async ({page, request, dataServer}) => {
  test.setTimeout(90_000);
  const meeting = page.getByRole('region', {name: 'Meeting', exact: true});
  const transcript = meeting.locator('.obe-meeting-transcript p');
  const transcriptions: string[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('/api/ai/transcribe') && response.ok()) transcriptions.push(response.url());
  });
  await meeting.getByRole('button', {name: 'Record', exact: true}).click();
  await expect(meeting.locator('header')).toContainText('Recording');
  // Pause closes a genuine standalone chunk without sleeping for the 45s
  // rollover. Resume proves transcript growth while the session is still live.
  await meeting.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(transcript).toHaveCount(1);
  await expect(transcript.first()).toContainText(/Mock transcription \([1-9]\d* bytes\)/);
  await expect(meeting.locator('header')).toContainText('Paused');
  const firstText = await transcript.first().innerText();
  const singleDownload = page.waitForEvent('download');
  await meeting.getByRole('button', {name: 'Export audio', exact: true}).click();
  const single = await singleDownload;
  expect(single.suggestedFilename()).toBe('Meeting-00h00m00s.webm');
  const singleBytes = await downloadBytes(single);

  await meeting.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(meeting.locator('header')).toContainText('Recording');
  await meeting.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(transcript).toHaveCount(2);
  await expect(transcript.first()).toHaveText(firstText);
  await expect(transcript.nth(1)).toContainText(/Mock transcription \([1-9]\d* bytes\)/);
  expect(transcriptions).toHaveLength(2);
  await expect(meeting.locator('audio')).toHaveCount(2);
  await meeting.getByRole('button', {name: 'Stop', exact: true}).click();
  await expect(meeting.locator('header')).toContainText('Done');

  await expect(meeting.locator('.obe-meeting-summary')).toHaveCount(0);
  const generation = page.waitForResponse((response) => response.url().includes('/api/ai/generate') && response.ok());
  await meeting.getByRole('button', {name: 'Generate summary', exact: true}).click();
  expect((await generation).headers()['content-type']).toContain('text/event-stream');
  await expect(meeting.getByRole('button', {name: 'Regenerate summary'})).toBeVisible();
  const summary = await meeting.locator('.obe-meeting-summary').innerText();
  expect(summary).toContain('Mock response to:');
  const note = 'Ellis will send the meeting follow-up.';
  await meeting.locator('.obe-meeting-notes .obe-text').fill(note);
  const pageId = new URL(page.url()).searchParams.get('page');
  await expect.poll(async () => {
    const stored = await request.get(`${dataServer}/api/pages/${pageId}`);
    expect(stored.ok()).toBeTruthy();
    return JSON.stringify((await stored.json() as {data: {blockdoc: unknown}}).data.blockdoc);
  }).toContain(note);

  const zipDownload = page.waitForEvent('download');
  await meeting.getByRole('button', {name: 'Export audio', exact: true}).click();
  const zip = await zipDownload;
  expect(zip.suggestedFilename()).toMatch(/-audio\.zip$/);
  const files = unzipSync(await downloadBytes(zip));
  expect(Object.keys(files)).toHaveLength(2);
  expect(Object.keys(files)).toEqual([expect.stringMatching(/^001-\d{2}h\d{2}m\d{2}s\.webm$/), expect.stringMatching(/^002-\d{2}h\d{2}m\d{2}s\.webm$/)]);
  expect(files[Object.keys(files)[0]]).toEqual(new Uint8Array(singleBytes));
  for (const bytes of Object.values(files)) expect(bytes.length).toBeGreaterThan(0);

  await page.getByRole('button', {name: 'Page actions'}).click();
  await page.getByRole('menuitem', {name: 'Export', exact: true}).click();
  const markdownDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', {name: 'Markdown (.md)', exact: true}).click();
  const markdown = (await downloadBytes(await markdownDownload)).toString('utf8');
  for (const segment of await transcript.allTextContents()) {
    expect(markdown).toContain(segment.replace(/^\S+\s+/, '').trim());
  }
  expect(markdown).toContain(summary);
  expect(markdown).toContain(note);
});

test('microphone denial shows recovery copy and leaves the editor usable', {tag: ['@meeting', '@p1']}, async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
  });
  const meeting = page.getByRole('region', {name: 'Meeting', exact: true});
  await meeting.getByRole('button', {name: 'Record', exact: true}).click();
  await expect(meeting.getByRole('alert')).toHaveText('Microphone access failed. Allow microphone access in browser settings, then try again.');
  await expect(meeting.getByRole('button', {name: 'Record', exact: true})).toBeEnabled();
  await expect(meeting.getByRole('button', {name: 'Stop', exact: true})).toBeDisabled();
  await meeting.locator('.obe-meeting-notes .obe-text').fill('Notes still work without microphone access.');
  await expect(meeting.locator('.obe-meeting-notes')).toContainText('Notes still work without microphone access.');
  await expect(meeting.locator('audio')).toHaveCount(0);
  expect(errors).toEqual([]);
});
