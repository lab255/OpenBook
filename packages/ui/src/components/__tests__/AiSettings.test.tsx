import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import type {AiConfig, AiStatus, DataClient} from '@book.dev/sdk';
import AiSettings from '../AiSettings';
import {DataProvider} from '@/data/DataProvider';
import {ConfirmProvider, I18nProvider, PreferencesProvider} from '@/providers';

afterEach(cleanup);

const chat: AiConfig = {provider: 'claude', providers: {claude: {model: 'chat-model', apiKeySet: true}}, effort: 'high', thinking: false};
const cloud: AiConfig['transcription'] = {provider: 'openai-compat', baseUrl: 'https://audio.example', model: 'audio-model', apiKeySet: true};

function setup(initial: AiConfig = chat) {
  let config = structuredClone(initial);
  const aiStatus = vi.fn(async (): Promise<AiStatus> => ({
    config: structuredClone(config), ready: false, embeddings: false, index: {pages: 0, builtAt: null},
    transcription: {model: 'base', modelPresent: false, runtimeAvailable: false, ready: false, downloadUrl: 'https://example.com/base.bin'},
  }));
  const aiSetConfig = vi.fn(async (next: AiConfig) => {
    // Simulate the server's redaction and preserve/set/clear key contract.
    const saved = structuredClone(next);
    const redact = (s: {apiKey?: string | null; apiKeySet?: boolean}, previous?: {apiKeySet?: boolean}) => {
      s.apiKeySet = s.apiKey === null ? false : Boolean(s.apiKey?.trim()) || Boolean(previous?.apiKeySet);
      delete s.apiKey;
    };
    if (saved.transcription) redact(saved.transcription, config.transcription);
    for (const [p, settings] of Object.entries(saved.providers ?? {})) {
      redact(settings, config.providers?.[p as keyof NonNullable<AiConfig['providers']>]);
    }
    config = saved;
    return structuredClone(config);
  });
  const client = {aiStatus, aiSetConfig, aiSkills: async () => []} as unknown as DataClient;
  const mount = () => render(
    <I18nProvider><PreferencesProvider><ConfirmProvider><DataProvider client={client}>
      <AiSettings />
    </DataProvider></ConfirmProvider></PreferencesProvider></I18nProvider>,
  );
  const view = mount();
  return {aiStatus, aiSetConfig, view, mount};
}

async function section() {
  const picker = await screen.findByLabelText('Transcription provider') as HTMLButtonElement;
  return {picker, audio: within(picker.closest('section')!)};
}

describe('AI transcription settings', () => {
  it('defaults to local, shows cloud fields only for cloud, and round-trips all picker choices through status', async () => {
    const {aiSetConfig, view, mount} = setup();
    let {picker, audio} = await section();
    expect(picker.dataset.value).toBe('local');
    expect(audio.queryByLabelText('API key')).toBeNull();
    expect(audio.getByRole('link', {name: 'Local transcription setup'}).getAttribute('href')).toContain('docs/local-transcription.md');
    for (const provider of ['openai-compat', 'off', 'local']) {
      fireEvent.click(picker);
      fireEvent.click(await screen.findByRole('option', {name: provider === 'local' ? 'Default (local)' : provider === 'off' ? 'Off' : 'Cloud (OpenAI-compatible)'}));
      await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
      expect(aiSetConfig.mock.lastCall?.[0]).toEqual({...chat, transcription: expect.objectContaining({provider})});
      expect(Boolean(audio.queryByLabelText('API key'))).toBe(provider === 'openai-compat');
      expect(Boolean(audio.queryByRole('button', {name: 'Download Whisper base'}))).toBe(provider === 'local');
      expect(Boolean(audio.queryByText(/Model not downloaded/))).toBe(provider === 'local');
      if (provider !== 'local') expect(audio.getByText('Local Whisper is not used with this provider.')).toBeTruthy();
      if (provider === 'openai-compat') {
        expect((audio.getByLabelText('Server URL') as HTMLInputElement).value).toBe('');
        expect((audio.getByLabelText('Model') as HTMLInputElement).value).toBe('');
        expect((audio.getByLabelText('Server URL') as HTMLInputElement).placeholder).toBe('https://api.openai.com');
        expect((audio.getByLabelText('Model') as HTMLInputElement).placeholder).toBe('whisper-1');
        expect(audio.getByText(/sends meeting audio to the configured endpoint/)).toBeTruthy();
      }
    }
    view.unmount();
    const mounted = mount();
    ({picker, audio} = await section());
    expect(picker.dataset.value).toBe('local');
    mounted.unmount();
  });

  it.each(['', '   ', 'replacement-secret'])('keeps keys write-only on blur (%j)', async (typed) => {
    const {aiSetConfig} = setup({...chat, transcription: cloud});
    const {audio, picker} = await section();
    const input = audio.getByLabelText('API key') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-describedby')).toBe('ai-transcription-apikey-status');
    expect(audio.getByText(/Leave blank to keep the current key/)).toBeTruthy();
    fireEvent.change(input, {target: {value: typed}});
    fireEvent.blur(input);
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(aiSetConfig.mock.lastCall?.[0].transcription?.apiKey ?? '').toBe(typed);
    expect(input.value).toBe('');
    expect(audio.getByRole('button', {name: 'Clear key'})).toBeTruthy();
  });

  it('clears only with explicit null and never replays the clear on subsequent saves', async () => {
    const {aiSetConfig} = setup({...chat, transcription: cloud});
    const {audio, picker} = await section();
    fireEvent.click(audio.getByRole('button', {name: 'Clear key'}));
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(aiSetConfig.mock.lastCall?.[0]).toEqual({...chat, transcription: {...cloud, apiKey: null, apiKeySet: false}});
    expect(audio.queryByRole('button', {name: 'Clear key'})).toBeNull();
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', {name: 'Off'}));
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(aiSetConfig.mock.lastCall?.[0].transcription?.apiKey).toBeUndefined();
  });

  it('preserves chat config in transcription saves and transcription config in chat saves', async () => {
    const {aiSetConfig, view, mount} = setup({...chat, transcription: cloud});
    const {audio, picker} = await section();
    const url = audio.getByLabelText('Server URL');
    fireEvent.change(url, {target: {value: 'https://new.example'}});
    fireEvent.blur(url);
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    const updated = {...cloud, baseUrl: 'https://new.example'};
    expect(aiSetConfig.mock.lastCall?.[0]).toEqual({...chat, transcription: updated});
    const model = audio.getByLabelText('Model');
    fireEvent.change(model, {target: {value: 'new-model'}});
    fireEvent.blur(model);
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    updated.model = 'new-model';
    expect(aiSetConfig.mock.lastCall?.[0]).toEqual({...chat, transcription: updated});
    fireEvent.click(screen.getByRole('radio', {name: /Off No model/}));
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(aiSetConfig.mock.lastCall?.[0]).toEqual({...chat, provider: 'off', transcription: updated});
    view.unmount();
    mount();
    const reloaded = await section();
    expect(reloaded.picker.dataset.value).toBe('openai-compat');
    expect((reloaded.audio.getByLabelText('Server URL') as HTMLInputElement).value).toBe(updated.baseUrl);
    expect((reloaded.audio.getByLabelText('Model') as HTMLInputElement).value).toBe(updated.model);
  });
  it.each(['ftp://audio.example', 'https://user:password@audio.example'])('surfaces rejected URL %s and restores the saved draft', async (baseUrl) => {
    const {aiSetConfig} = setup({...chat, transcription: cloud});
    const {audio, picker} = await section();
    const error = 'Transcription baseUrl must be an HTTP(S) URL without embedded credentials';
    aiSetConfig.mockRejectedValueOnce(new Error(error));
    const input = audio.getByLabelText('Server URL') as HTMLInputElement;
    fireEvent.change(input, {target: {value: baseUrl}});
    fireEvent.blur(input);
    expect((await audio.findByRole('alert')).textContent).toBe(error);
    expect(input.value).toBe(cloud?.baseUrl);
    expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false');

    fireEvent.change(input, {target: {value: 'https://valid.example'}});
    fireEvent.blur(input);
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(audio.queryByRole('alert')).toBeNull();
    expect(input.value).toBe('https://valid.example');
  });

  it.each([
    ['transcription', 'save'],
    ['transcription', 'status'],
    ['chat', 'save'],
    ['chat', 'status'],
  ])('scrubs the %s key when the %s request rejects without inventing key-set state', async (target, failure) => {
    const {aiSetConfig, aiStatus} = setup({
      ...chat, providers: {claude: {model: 'chat-model', apiKeySet: false}},
      transcription: {...cloud!, apiKeySet: false},
    });
    const {audio, picker} = await section();
    const keySection = target === 'transcription' ? audio : within(document.getElementById('ai-section-claude')!);
    const input = keySection.getByLabelText('API key') as HTMLInputElement;
    if (failure === 'save') aiSetConfig.mockRejectedValueOnce(new Error('Save rejected'));
    else aiStatus.mockRejectedValueOnce(new Error('Status unavailable'));
    fireEvent.change(input, {target: {value: 'new-secret'}});
    fireEvent.blur(input);
    expect((await audio.findByRole('alert')).textContent).toBe(failure === 'save' ? 'Save rejected' : 'Status unavailable');
    expect(input.value).toBe('');
    expect(keySection.queryByRole('button', {name: 'Clear key'})).toBeNull();
    expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false');

    fireEvent.blur(audio.getByLabelText('Server URL'));
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(aiSetConfig.mock.lastCall?.[0].transcription?.apiKey).toBeUndefined();
    expect(aiSetConfig.mock.lastCall?.[0].providers?.claude?.apiKey).toBeUndefined();
  });

  it('retains picker focus while saving and ignores re-entrant selections', async () => {
    const {aiSetConfig} = setup({...chat, transcription: cloud});
    const {picker} = await section();
    const persist = aiSetConfig.getMockImplementation()!;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    aiSetConfig.mockImplementationOnce(async (config) => {
      await pending;
      return persist(config);
    });
    picker.focus();
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', {name: 'Off'}));
    expect(picker.disabled).toBe(false);
    expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(picker));
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', {name: 'Default (local)'}));
    expect(aiSetConfig).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(picker));

    release();
    await waitFor(() => expect(picker.closest('section')?.getAttribute('aria-busy')).toBe('false'));
    expect(picker.dataset.value).toBe('off');
    expect(document.activeElement).toBe(picker);
  });

});
