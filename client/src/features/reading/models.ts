import * as LegacyFS from "expo-file-system/legacy";
import { Directory, File, Paths } from "expo-file-system";
import type { AssessmentLanguage } from "@/constants/content";
import { VgyanSpeech } from "../../../modules/vgyan-speech";

/**
 * Offline speech models are downloaded once (not bundled) to keep the APK small, verified by
 * MD5 and unpacked into app storage. Each language's source is configurable so the research
 * team can ship its own validated (e.g. children's speech or Kannada) model without a rebuild of
 * the analysis code.
 */
export interface ModelSpec {
  key: "en" | "kn";
  language: AssessmentLanguage;
  url: string;
  md5: string;
  version: string;
  sizeMb: number;
}


export const MODEL_SPECS: Record<AssessmentLanguage, ModelSpec | null> = {
  // Default: Vosk small Indian-English model (Apache-2.0), 36 MB. See docs/asr-evaluation.md.
  English: {
    key: "en",
    language: "English",
    url: process.env.EXPO_PUBLIC_ASR_MODEL_EN_URL || "https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip",
    md5: process.env.EXPO_PUBLIC_ASR_MODEL_EN_MD5 || "62fd085f33c8c5fc01a235030e2a1fe3",
    version: process.env.EXPO_PUBLIC_ASR_MODEL_EN_VERSION || "vosk-model-small-en-in-0.4",
    sizeMb: Number(process.env.EXPO_PUBLIC_ASR_MODEL_EN_MB || 36),
  },
  // No public Kannada Vosk model exists. Recordings are kept and transcribed once the research
  // team publishes its Kannada TDNN model and sets these variables.
  Kannada: process.env.EXPO_PUBLIC_ASR_MODEL_KN_URL
    ? {
        key: "kn",
        language: "Kannada",
        url: process.env.EXPO_PUBLIC_ASR_MODEL_KN_URL,
        md5: process.env.EXPO_PUBLIC_ASR_MODEL_KN_MD5 || "",
        version: process.env.EXPO_PUBLIC_ASR_MODEL_KN_VERSION || "kn-custom",
        sizeMb: Number(process.env.EXPO_PUBLIC_ASR_MODEL_KN_MB || 50),
      }
    : null,
};

export type ModelState =
  | { status: "unsupported" } // engine not in this build (web / Expo Go)
  | { status: "unavailable" } // no model published for this language
  | { status: "missing"; spec: ModelSpec }
  | { status: "downloading"; spec: ModelSpec; progress: number }
  | { status: "installing"; spec: ModelSpec }
  | { status: "ready"; spec: ModelSpec; path: string }
  | { status: "error"; spec: ModelSpec; message: string };

const root = () => new Directory(Paths.document, "asr-models");
const markerFile = (spec: ModelSpec) => new File(root(), `${spec.key}.json`);

interface Marker {
  version: string;
  path: string;
  md5: string;
  installedAt: string;
}

function readMarker(spec: ModelSpec): Marker | null {
  try {
    const f = markerFile(spec);
    if (!f.exists) return null;
    const m = JSON.parse(f.textSync()) as Marker;
    if (m.version !== spec.version) return null;
    if (!new Directory(m.path).exists) return null;
    return m;
  } catch {
    return null;
  }
}

export function getModelState(language: AssessmentLanguage): ModelState {
  if (!VgyanSpeech) return { status: "unsupported" };
  const spec = MODEL_SPECS[language];
  if (!spec) return { status: "unavailable" };
  const m = readMarker(spec);
  return m ? { status: "ready", spec, path: m.path } : { status: "missing", spec };
}

/**
 * Downloads (resumable), verifies and installs a model. Safe to call again after a failure or if
 * the app was killed mid-download: a partial download resumes, a bad archive is discarded.
 */
export async function installModel(language: AssessmentLanguage, onState: (s: ModelState) => void): Promise<ModelState> {
  const spec = MODEL_SPECS[language];
  if (!VgyanSpeech) return { status: "unsupported" };
  if (!spec) return { status: "unavailable" };
  const existing = getModelState(language);
  if (existing.status === "ready") return existing;

  const dir = root();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const zipUri = `${dir.uri}/${spec.key}-${spec.version}.zip`;
  const resumeFile = new File(dir, `${spec.key}.resume.json`);

  try {
    onState({ status: "downloading", spec, progress: 0 });
    const cb = (p: LegacyFS.DownloadProgressData) => {
      const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : spec.sizeMb * 1024 * 1024;
      onState({ status: "downloading", spec, progress: Math.min(1, p.totalBytesWritten / total) });
    };
    let resumeData: string | undefined;
    try {
      if (resumeFile.exists) resumeData = JSON.parse(resumeFile.textSync()).resumeData;
    } catch {
      resumeData = undefined;
    }
    const dl = LegacyFS.createDownloadResumable(spec.url, zipUri, { md5: true }, cb, resumeData);
    let res: LegacyFS.FileSystemDownloadResult | undefined;
    try {
      res = resumeData ? await dl.resumeAsync() : await dl.downloadAsync();
    } catch (e) {
      // Keep resume data so the next attempt continues where this one stopped.
      try {
        const snap = dl.savable();
        resumeFile.write(JSON.stringify(snap));
      } catch {
        // ignore
      }
      throw e;
    }
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`Download failed (HTTP ${res?.status ?? "?"})`);
    const md5 = res.md5 ?? (await LegacyFS.getInfoAsync(zipUri, { md5: true }).then((i) => (i.exists ? i.md5 : undefined)));
    if (spec.md5 && md5 !== spec.md5) {
      await LegacyFS.deleteAsync(zipUri, { idempotent: true });
      if (resumeFile.exists) resumeFile.delete();
      throw new Error("Downloaded model is corrupted (checksum mismatch). Please try again.");
    }

    onState({ status: "installing", spec });
    const target = new Directory(dir, `${spec.key}-${spec.version}`);
    if (target.exists) target.delete();
    target.create({ intermediates: true, idempotent: true });
    const modelPath = await VgyanSpeech.unzip(zipUri, target.uri);
    await LegacyFS.deleteAsync(zipUri, { idempotent: true });
    if (resumeFile.exists) resumeFile.delete();
    const marker: Marker = { version: spec.version, path: modelPath, md5: md5 ?? "", installedAt: new Date().toISOString() };
    markerFile(spec).write(JSON.stringify(marker));
    const ready: ModelState = { status: "ready", spec, path: modelPath };
    onState(ready);
    return ready;
  } catch (e) {
    const s: ModelState = { status: "error", spec, message: e instanceof Error ? e.message : String(e) };
    onState(s);
    return s;
  }
}

/** Loads the model into memory (a few seconds on low-end phones); no-op if already loaded. */
export async function ensureModelLoaded(language: AssessmentLanguage): Promise<ModelSpec | null> {
  const state = getModelState(language);
  if (state.status !== "ready" || !VgyanSpeech) return null;
  if (!VgyanSpeech.isModelLoaded(state.spec.key)) await VgyanSpeech.loadModel(state.spec.key, state.path);
  return state.spec;
}
