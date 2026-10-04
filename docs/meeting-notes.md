# Meeting notes

On a saved page, type `/meeting` and choose **Meeting**. Keep the page connected
to its OpenBook server so recordings can be saved to the library.

## Record and transcribe

Click **Record** and allow microphone access. OpenBook saves roughly 45-second
chunks and transcribes each completed upload; transcript lines appear as chunks
finish, without waiting for the entire meeting. Each chunk is a standalone audio
file, so it can be played or exported independently.

**Pause** closes the current chunk and silences capture. **Resume** starts a new
chunk; paused time is excluded from the recording timeline. **Stop** finishes
capture and lets pending uploads and transcription settle. Keep the page open
until processing completes. Failed uploads retain an in-session audio copy with
save/retry controls; transcription failures preserve uploaded audio and offer
**Retry transcription**. Leaving the page can lose audio that has not uploaded.

Local Whisper transcription ships by default, independently of the chat model.
In **Settings → AI**, select **Download Whisper base** to download the model.
See [local transcription](local-transcription.md) for the required Whisper and
FFmpeg installation, model setup, and runtime checks. If local transcription
is unavailable, recording and manual notes still work; OpenBook does not silently
fall back to a cloud service. Cloud transcription requires explicit opt-in in
**Settings → AI**. Selecting a cloud chat model alone does not opt audio into
cloud transcription.

## Summaries and notes

Configure a generation provider in **Settings → AI**, then click **Generate
summary** once transcript text exists. Summaries never start automatically.
Text appears while generation streams. **Cancel** discards the unfinished
replacement and retains any previous summary. **Regenerate summary** requests a
new version. Long transcripts are clipped to the first 4,000 characters for the
summary prompt, with an instruction to disclose that it covers an excerpt.

Type directly under **Notes**, including while recording. Notes are ordinary
editable blocks inside the meeting, independent of generated transcript and
summary text.

## Export and privacy

Click **Export audio** to download one audio file for a single saved chunk, or a
ZIP containing ordered, timestamped files for multiple chunks. Files retain their
original formats and bytes; the ZIP does not join or re-encode the recording.
Export leaves the original audio in your library. Audio is stored with the page's
assets and follows library/page access rules; it is not uploaded to a third-party
transcription service unless you explicitly configure one. With a remote library,
capture uploads to that library's server, so “local transcription” refers to
processing on the server rather than necessarily on the microphone's device.

Use **Page actions → Export → Markdown (.md)** for transcript timestamps,
summary, manual notes, and audio references. Markdown is not an audio backup;
use **Export audio** for the actual recordings.

## Desktop

Allow microphone access for OpenBook in your OS privacy settings and reopen the
app if permission changes require it. Browser permission instructions may still
appear in the shared UI. Follow the [desktop microphone manual checks](../packages/app/README.md#meeting-microphone-manual-checks)
to verify the actual webview and OS permission behavior; Chromium e2e coverage
uses synthetic audio and cannot establish desktop microphone support.
