import React, { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { AppIcon } from "@/components/ui/app-icon";
import { C, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { getPassage } from "@/constants/content";
import { useApp } from "@/state/app-store";
import { formatDuration } from "@/utils/format";

const MAX_RECORDING_MS = 3 * 60 * 1000;
const MIN_RECORDING_MS = 3000;

type Phase = "idle" | "recording" | "stopping";

export default function ReadingRecordingScreen() {
  const router = useRouter();
  const { lang } = useApp();
  const { passageId } = useLocalSearchParams<{ passageId?: string }>();
  const passage = getPassage(passageId);

  // 16 kHz mono matches what the ASR models expect.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    directory: "document",
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 150);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) setPermissionDenied(true);
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch {
        setPermissionDenied(true);
      }
    })();
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

  const start = async () => {
    setError(null);
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setElapsedMs(0);
      setPhase("recording");
    } catch (e) {
      setError(
        lang === "en"
          ? "Could not start the microphone. Please try again."
          : "ಮೈಕ್ರೋಫೋನ್ ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
      );
      console.warn("recording start failed", e);
    }
  };

  async function stop() {
    if (phase !== "recording") return;
    setPhase("stopping");
    const durationMs = startedAt.current ? Date.now() - startedAt.current : elapsedMs;
    try {
      await recorder.stop();
    } catch (e) {
      console.warn("recording stop failed", e);
    }
    if (durationMs < MIN_RECORDING_MS) {
      setPhase("idle");
      setElapsedMs(0);
      setError(
        lang === "en"
          ? "That was too short. Tap the mic and read the whole passage."
          : "ತುಂಬಾ ಚಿಕ್ಕದಾಗಿದೆ. ಮೈಕ್ ಒತ್ತಿ ಸಂಪೂರ್ಣ ಭಾಗವನ್ನು ಓದಿ."
      );
      return;
    }
    router.replace({
      pathname: "/reading/processing",
      params: {
        passageId: passage!.id,
        audioUri: recorder.uri ?? "",
        durationMs: String(durationMs),
      },
    });
  }

  const cancel = async () => {
    if (phase === "recording") {
      try {
        await recorder.stop();
      } catch {}
    }
    router.back();
  };

  // Metering is in dBFS (about -160..0); map to a 0..1 level for the pulse ring.
  const level =
    phase === "recording" && recorderState.metering != null
      ? Math.max(0, Math.min(1, (recorderState.metering + 60) / 60))
      : 0;

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

      <View style={styles.recorderArea}>
        <Text style={styles.timer}>{formatDuration(elapsedMs)}</Text>
        <Text style={styles.statusText}>
          {phase === "recording"
            ? lang === "en" ? "Listening… tap stop when you finish" : "ಕೇಳುತ್ತಿದೆ… ಮುಗಿದಾಗ ನಿಲ್ಲಿಸಿ ಒತ್ತಿ"
            : phase === "stopping"
            ? lang === "en" ? "Saving recording…" : "ಉಳಿಸಲಾಗುತ್ತಿದೆ…"
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
            disabled={phase === "stopping"}
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
          style={{ flex: 0 }}
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
