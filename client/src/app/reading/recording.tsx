import React, { useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Directory, Paths } from "expo-file-system";
import { AppIcon } from "@/components/ui/app-icon";
import { C, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { getPassage } from "@/constants/content";
import { newId } from "@/core/auth/credentials";
import { fromNative, putHandoff } from "@/features/reading/asr";
import { ensureModelLoaded, getModelState, installModel, type ModelState } from "@/features/reading/models";
import { useApp } from "@/state/app-store";
import { formatDuration } from "@/utils/format";
import { VgyanSpeech } from "../../../modules/vgyan-speech";

const MAX_RECORDING_MS = 3 * 60 * 1000;
const MIN_RECORDING_MS = 3000;

type Phase = "idle" | "preparing" | "recording" | "stopping";

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export default function ReadingRecordingScreen() {
  const router = useRouter();
  const { lang } = useApp();
  const en = lang === "en";
  const { passageId } = useLocalSearchParams<{ passageId?: string }>();
  const passage = getPassage(passageId);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelState>(() => (passage ? getModelState(passage.language) : { status: "unsupported" }));
  const startedAt = useRef<number | null>(null);
  const recognizing = useRef(false);

  useEffect(() => {
    if (!VgyanSpeech) return;
    const sub = VgyanSpeech.addListener("onLevel", (e) => setLevel(Math.min(1, e.level * 3)));
    void ensureMicPermission().then((ok) => setPermissionDenied(!ok));
    return () => {
      sub.remove();
      // Leaving the screen mid-recording discards that take (nothing has been saved yet).
      void VgyanSpeech?.cancelRecording().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      if (startedAt.current) setElapsedMs(Date.now() - startedAt.current);
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && elapsedMs >= MAX_RECORDING_MS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, phase]);

  if (!passage) return <Redirect href="/reading/language" />;

  const download = async () => {
    setError(null);
    await installModel(passage.language, setModel);
  };

  const start = async () => {
    setError(null);
    if (!VgyanSpeech) {
      setError(en ? "Recording needs the VGyan Android app." : "ರೆಕಾರ್ಡಿಂಗ್‌ಗೆ VGyan ಆಂಡ್ರಾಯ್ಡ್ ಆ್ಯಪ್ ಬೇಕು.");
      return;
    }
    if (!(await ensureMicPermission())) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    setPhase("preparing");
    try {
      // Loading the model takes a few seconds on low-end phones; do it before the student starts.
      const spec = model.status === "ready" ? await ensureModelLoaded(passage.language) : null;
      const dir = new Directory(Paths.document, "recordings", "tmp");
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const out = `${dir.uri}/${newId()}.wav`;
      const r = await VgyanSpeech.startRecording(out, spec?.key ?? null);
      recognizing.current = r.recognizing;
      startedAt.current = Date.now();
      setElapsedMs(0);
      setPhase("recording");
    } catch (e) {
      setPhase("idle");
      setError(en ? "Could not start the microphone. Please try again." : "ಮೈಕ್ರೋಫೋನ್ ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.");
      console.warn("recording start failed", e instanceof Error ? e.message : e);
    }
  };

  async function stop() {
    if (phase !== "recording" || !VgyanSpeech) return;
    setPhase("stopping");
    try {
      const res = await VgyanSpeech.stopRecording();
      if (res.durationMs < MIN_RECORDING_MS) {
        setPhase("idle");
        setElapsedMs(0);
        setError(en ? "That was too short. Tap the mic and read the whole passage." : "ತುಂಬಾ ಚಿಕ್ಕದಾಗಿದೆ. ಮೈಕ್ ಒತ್ತಿ ಸಂಪೂರ್ಣ ಭಾಗವನ್ನು ಓದಿ.");
        return;
      }
      const spec = model.status === "ready" ? model.spec : null;
      const handoff = newId();
      putHandoff(handoff, {
        audioUri: res.uri,
        durationMs: res.durationMs,
        asr: recognizing.current && spec ? fromNative(res, spec.version) : null,
      });
      router.replace({ pathname: "/reading/processing", params: { passageId: passage!.id, handoff } });
    } catch (e) {
      setPhase("idle");
      setError(en ? "The recording could not be saved. Please try again." : "ರೆಕಾರ್ಡಿಂಗ್ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.");
      console.warn("recording stop failed", e instanceof Error ? e.message : e);
    }
  }

  const cancel = async () => {
    if (phase === "recording") await VgyanSpeech?.cancelRecording().catch(() => {});
    router.back();
  };

  const modelNotice = (() => {
    switch (model.status) {
      case "missing":
        return en
          ? `The ${passage.language} speech model (${model.spec.sizeMb} MB) is not on this phone yet. Download it once on Wi-Fi so your reading can be checked offline. You can also record now; it will be checked after the download.`
          : `ಧ್ವನಿ ಮಾದರಿ (${model.spec.sizeMb} MB) ಇನ್ನೂ ಈ ಫೋನ್‌ನಲ್ಲಿ ಇಲ್ಲ. ವೈ-ಫೈನಲ್ಲಿ ಒಮ್ಮೆ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ. ಈಗಲೇ ರೆಕಾರ್ಡ್ ಮಾಡಿದರೆ ಡೌನ್‌ಲೋಡ್ ನಂತರ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ.`;
      case "downloading":
        return `${en ? "Downloading speech model" : "ಧ್ವನಿ ಮಾದರಿ ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ"}… ${Math.round(model.progress * 100)}%`;
      case "installing":
        return en ? "Installing speech model…" : "ಧ್ವನಿ ಮಾದರಿ ಸ್ಥಾಪಿಸಲಾಗುತ್ತಿದೆ…";
      case "error":
        return `${en ? "Model download failed" : "ಡೌನ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ"}: ${model.message}`;
      case "unavailable":
        return en
          ? "Offline speech checking for Kannada is not available yet. Your recording will be saved and checked once the Kannada speech model is released."
          : "ಕನ್ನಡ ಧ್ವನಿ ಪರಿಶೀಲನೆ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ನಿಮ್ಮ ರೆಕಾರ್ಡಿಂಗ್ ಉಳಿಸಲಾಗುತ್ತದೆ ಮತ್ತು ಮಾದರಿ ಬಂದ ನಂತರ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ.";
      case "unsupported":
        return en ? "Recording works in the VGyan Android app only." : "ರೆಕಾರ್ಡಿಂಗ್ VGyan ಆಂಡ್ರಾಯ್ಡ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಮಾತ್ರ.";
      default:
        return null;
    }
  })();
  const busyModel = model.status === "downloading" || model.status === "installing";

  return (
    <FlowScreen
      title={lang === "en" ? "Read Aloud" : "ಗಟ್ಟಿಯಾಗಿ ಓದಿ"}
      subtitle={lang === "en" ? "Step 4 of 4 • Recording" : "ಹಂತ 4/4 • ರೆಕಾರ್ಡಿಂಗ್"}
      step={4}
      totalSteps={4}
      onBack={cancel}
      scroll={false}
    >
      <View style={styles.passageCard}>
        <ScrollView showsVerticalScrollIndicator>
          <Text style={styles.passageText}>{passage.text}</Text>
        </ScrollView>
      </View>

      {permissionDenied ? (
        <Notice
          tone="error"
          text={
            lang === "en"
              ? "Microphone permission is needed to record your reading. Allow it in Settings, then tap the mic again."
              : "ಓದನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಲು ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ಬೇಕು. ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅನುಮತಿಸಿ."
          }
        />
      ) : null}
      {error ? <Notice tone="warn" text={error} /> : null}
      {modelNotice && phase === "idle" ? <Notice tone={model.status === "error" ? "error" : "info"} text={modelNotice} /> : null}
      {(model.status === "missing" || model.status === "error") && phase === "idle" ? (
        <FlowButton label={en ? "Download speech model" : "ಧ್ವನಿ ಮಾದರಿ ಡೌನ್‌ಲೋಡ್"} variant="secondary" onPress={download} />
      ) : null}

      <View style={styles.recorderArea}>
        <Text style={styles.timer}>{formatDuration(elapsedMs)}</Text>
        <Text style={styles.statusText}>
          {phase === "recording"
            ? lang === "en" ? "Listening… tap stop when you finish" : "ಕೇಳುತ್ತಿದೆ… ಮುಗಿದಾಗ ನಿಲ್ಲಿಸಿ ಒತ್ತಿ"
            : phase === "stopping"
            ? lang === "en" ? "Saving recording…" : "ಉಳಿಸಲಾಗುತ್ತಿದೆ…"
            : phase === "preparing"
            ? lang === "en" ? "Preparing speech engine…" : "ಧ್ವನಿ ಎಂಜಿನ್ ಸಿದ್ಧವಾಗುತ್ತಿದೆ…"
            : lang === "en" ? "Tap the mic and start reading" : "ಮೈಕ್ ಒತ್ತಿ ಓದಲು ಪ್ರಾರಂಭಿಸಿ"}
        </Text>

        <View style={styles.micWrap}>
          {phase === "recording" ? (
            <View
              style={[
                styles.pulse,
                { transform: [{ scale: 1 + level * 0.45 }], opacity: 0.25 + level * 0.4 },
              ]}
            />
          ) : null}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={phase === "recording" ? stop : start}
            disabled={phase === "stopping" || phase === "preparing" || busyModel}
            style={[styles.micButton, phase === "recording" && styles.micButtonRecording]}
            accessibilityRole="button"
            accessibilityLabel={phase === "recording" ? "Stop recording" : "Start recording"}
          >
            <AppIcon name={phase === "recording" ? "stop" : "mic"} size={30} color={C.white} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <Text style={styles.limitText}>
          {lang === "en" ? "Maximum 3 minutes" : "ಗರಿಷ್ಠ 3 ನಿಮಿಷಗಳು"}
        </Text>
      </View>

      {phase === "recording" ? (
        <FlowButton
          label={lang === "en" ? "I'm Done" : "ಮುಗಿಯಿತು"}
          icon="check"
          onPress={stop}
        />
      ) : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  passageCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  passageText: { fontSize: 19, lineHeight: 32, color: "#1C3A30", fontWeight: "500" },
  recorderArea: { alignItems: "center", paddingVertical: 8, marginBottom: 8 },
  timer: { fontSize: 30, fontWeight: "800", color: C.forest, fontVariant: ["tabular-nums"] },
  statusText: { fontSize: 12.5, color: C.muted, marginTop: 2, marginBottom: 14, textAlign: "center" },
  micWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  pulse: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: C.red,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: C.forest, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { cursor: "pointer", boxShadow: "0 4px 14px rgba(11,61,46,0.25)" },
    }),
  },
  micButtonRecording: { backgroundColor: C.red },
  limitText: { fontSize: 11, color: C.muted, marginTop: 10 },
});
