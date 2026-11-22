import {useState} from 'react';
import type {AiStatus} from '@book.dev/sdk';
import {Button} from '@/components/ui/button';
import {useData} from '@/data';
import {useTranslation} from '@/providers';

type Tool = NonNullable<NonNullable<AiStatus['transcription']>['runtime']>['tools']['whisper-cli'];

function toolLabel(tool: Tool, name: string, t: ReturnType<typeof useTranslation>['t']): string {
  return tool.override ? t(tool.available ? 'ai.transcription.override' : 'ai.transcription.overrideMissing', {override: tool.override})
    : tool.status === 'unsupported' ? t('ai.transcription.unsupported', {override: name === 'ffmpeg' ? 'OPENBOOK_FFMPEG_BIN' : 'OPENBOOK_WHISPER_BIN'})
      : tool.status === 'failed' ? t('ai.transcription.failed', {detail: tool.detail ?? ''})
        : tool.status === 'provisioning' ? t('ai.transcription.provisioning')
          : tool.status === 'provisioned' ? t('ai.transcription.installed')
            : tool.installedVersion ? t('ai.transcription.updateAvailable') : t('ai.transcription.pending');
}

export function LocalTranscription({status, refresh}: {status: AiStatus; refresh: () => Promise<void>}) {
  const client = useData();
  const {t} = useTranslation();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const audio = status.transcription!;
  const download = status.download?.url === audio.downloadUrl ? status.download : undefined;
  const tools = Object.entries(audio.runtime?.tools ?? {});
  const provisioning = tools.some(([, tool]) => tool.status === 'provisioning');
  const downloading = Boolean(download && !download.done && !download.error);
  const active = starting || downloading || provisioning;
  const update = audio.modelUpdateAvailable || tools.some(([, tool]) => !tool.override && tool.installedVersion && tool.status !== 'provisioned');
  const partialUnsupported = tools.some(([, tool]) => tool.status === 'unsupported' && !tool.override);
  const current = audio.ready && !update;
  const runtimeFailed = tools.some(([, tool]) => tool.status === 'failed');
  const actionable = !audio.modelPresent || Boolean(audio.modelUpdateAvailable) || tools.some(([, tool]) => !tool.override && (tool.status === 'missing' || tool.status === 'failed'));
  const enable = async () => {
    setStarting(true);
    setError(undefined);
    try {
      await client.aiDownloadModel(audio.downloadUrl);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  };
  return (
    <div className="space-y-2" aria-live="polite" aria-busy={active}>
      <p className="text-sm text-muted-foreground">
        {t('ai.transcription.stageLine', {stage: t('ai.transcription.modelStage'), state: audio.modelPresent ? t(audio.modelUpdateAvailable ? 'ai.transcription.updateAvailable' : 'ai.transcription.modelReady')
          : downloading && !provisioning ? download?.total
            ? t('ai.transcription.downloadingProgress', {progress: Math.round(download.received / download.total * 100)})
            : t('ai.transcription.downloading')
            : t(audio.modelUpdateAvailable ? 'ai.transcription.updateAvailable' : 'ai.transcription.modelAbsent')})}
      </p>
      {tools.map(([name, tool]) => (
        <p key={name} role={tool.status === 'failed' && !tool.override ? 'alert' : undefined}
          className={tool.status === 'failed' && !tool.override ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {t('ai.transcription.stageLine', {stage: name === 'ffmpeg' ? 'FFmpeg' : name, state: toolLabel(tool, name, t)})}
        </p>
      ))}
      {current && <p className="text-sm text-muted-foreground">{t('ai.transcription.ready')}</p>}
      {!current && (actionable || active) && <Button size="sm" disabled={active || Boolean(status.download && !status.download.done && !status.download.error)} onClick={() => void enable()}>
        {t(active ? 'ai.transcription.enabling' : partialUnsupported ? 'ai.transcription.downloadAvailable' : update ? 'ai.transcription.update' : 'ai.transcription.enable')}
      </Button>}
      {download?.error && (!download.done || !runtimeFailed) && <p role="alert" className="text-sm text-destructive">{t('ai.transcription.stageLine', {stage: t('ai.transcription.modelStage'), state: download.error})}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{t('ai.transcription.setupFailed', {detail: error})}</p>}
    </div>
  );
}
