import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import { C, Card, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { getPassage } from "@/constants/content";
import { analyzeReading, ANALYSIS_VERSION } from "@/features/reading/analyzer";
import { AsrUnavailableError, takeHandoff, transcribeFile, type AsrResult } from "@/features/reading/asr";
import { computeFluency } from "@/features/reading/fluency";
import { useGoHome } from "@/hooks/use-go-home";
import { useApp } from "@/state/app-store";
import { newId } from "@/core/auth/credentials";
import type { ReadingAttempt } from "@/types/models";

type StepKey = "save" | "asr" | "analyse" | "feedback";
type StepState = "waiting" | "running" | "done" | "failed" | "skipped";

/** Fields derived from a transcript; empty while transcription is pending. */
export function metricsFor(passageText: string, language: ReadingAttempt["language"], asr: AsrResult, durationMs: number) {
  const analysis = analyzeReading(passageText, asr.transcript, durationMs, language);
  return {
    analysis,
    patch: {
      asrStatus: "completed" as const,
      transcript: asr.transcript,
      asrConfidence: asr.confidence,
      asrModelVersion: asr.modelVersion,
      asrWords: asr.words,
      asrMs: asr.asrMs,
      analysisVersion: ANALYSIS_VERSION,
      accuracy: analysis.accuracy,
      wpm: analysis.wpm,
      wcpm: analysis.wcpm,
      pace: analysis.pace,
      mistakesCount: analysis.mistakes,
      substitutions: analysis.substitutions,
      omissions: analysis.omissions,
      insertions: analysis.insertions,
      practiceWords: analysis.practiceWords,
      words: analysis.words,
      fluency: asr.words.length > 0 ? computeFluency(asr.words) ?? undefined : undefined,
    },
  };
}

export default function ReadingProcessingScreen() {
  const router = useRouter();
  const goHome = useGoHome();
  const { lang, saveNewReading, updateReadingAttempt, requestFeedbackFor } = useApp();
  const params = useLocalSearchParams<{ passageId?: string; handoff?: string }>();
  const passage = getPassage(params.passageId);
  const [handoff] = useState(() => takeHandoff(params.handoff));

  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    save: "running",
    asr: "waiting",
    analyse: "waiting",
    feedback: "waiting",
  });
  const [fatal, setFatal] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);
  const savedId = useRef<string | null>(null);
  const savedAudio = useRef<string | null>(null);

  useEffect(() => {
    if (!passage || !handoff || started.current === attempt) return;
    started.current = attempt;
    const mark = (k: StepKey, st: StepState) => setSteps((prev) => ({ ...prev, [k]: st }));
    const en = lang === "en";

    (async () => {
      setFatal(null);
      let asr = handoff.asr;
      const durationMs = handoff.durationMs;

      // 1. Save first, so the original recording is safe whatever happens next.
      let id = savedId.current;
      if (!id) {
        id = newId();
        try {
          const saved = await saveNewReading({
            id,
            title: passage.title,
            kannadaTitle: passage.kannadaTitle,
            language: passage.language,
            level: passage.level,
            passageId: passage.id,
            referenceText: passage.text,
            audioUri: handoff.audioUri,
            durationSec: Math.round(durationMs / 100) / 10,
            asrStatus: "pending",
            transcript: "",
            asrConfidence: null,
            asrModelVersion: "",
            accuracy: 0,
            wpm: 0,
            wcpm: 0,
            pace: "",
            mistakesCount: 0,
            substitutions: 0,
            omissions: 0,
            insertions: 0,
            practiceWords: [],
            words: [],
            aiStatus: "pending",
            ...(asr ? metricsFor(passage.text, passage.language, asr, durationMs).patch : {}),
          });
          savedId.current = id;
          savedAudio.current = saved.audioUri;
        } catch (e) {
          console.warn("saving attempt failed", e instanceof Error ? e.message : e);
          mark("save", "failed");
          setFatal(en ? "Couldn't save this attempt on the phone. Check free storage space and try again." : "ಈ ಪ್ರಯತ್ನವನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಫೋನ್‌ನ ಸಂಗ್ರಹ ಸ್ಥಳ ಪರಿಶೀಲಿಸಿ.");
          return;
        }
      }
      mark("save", "done");

      // 2. Offline recognition (already done while recording when the model was loaded).
      mark("asr", "running");
      if (!asr) {
        try {
          asr = await transcribeFile(savedAudio.current ?? handoff.audioUri, passage.language);
          await updateReadingAttempt(id, metricsFor(passage.text, passage.language, asr, durationMs).patch);
        } catch (e) {
          if (e instanceof AsrUnavailableError) {
            mark("asr", "skipped");
            mark("analyse", "skipped");
            mark("feedback", "skipped");
            router.replace({ pathname: "/reading/result", params: { id } });
            return;
          }
          console.warn("ASR failed", e instanceof Error ? e.message : e);
          mark("asr", "failed");
          setFatal(en ? "Speech recognition failed. Your recording is saved; you can try again." : "ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ. ರೆಕಾರ್ಡಿಂಗ್ ಉಳಿಸಲಾಗಿದೆ; ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.");
          return;
        }
      }
      mark("asr", "done");
      mark("analyse", "done");

      // 3. AI feedback needs the server; when offline it is fetched on the next sync.
      mark("feedback", "running");
      const ok = await requestFeedbackFor(id);
      mark("feedback", ok ? "done" : "skipped");
      router.replace({ pathname: "/reading/result", params: { id } });
    })();
  }, [attempt, passage, handoff, lang, saveNewReading, updateReadingAttempt, requestFeedbackFor, router]);

  if (!handoff) return <Redirect href="/reading/language" />;
  if (!passage) return <Redirect href="/reading/language" />;

  const labels: Record<StepKey, string> =
    lang === "en"
      ? {
          save: "Recording saved on this phone",
          asr: "Recognising your speech (offline)",
          analyse: "Comparing words with the passage",
          feedback: "Preparing your feedback",
        }
      : {
          save: "ರೆಕಾರ್ಡಿಂಗ್ ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ",
          asr: "ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಗುರುತಿಸಲಾಗುತ್ತಿದೆ",
          analyse: "ಪದಗಳನ್ನು ಹೋಲಿಸಲಾಗುತ್ತಿದೆ",
          feedback: "ಪ್ರತಿಕ್ರಿಯೆ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ",
        };

  return (
    <FlowScreen
      title={lang === "en" ? "Checking Your Reading" : "ನಿಮ್ಮ ಓದನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ"}
      subtitle={lang === "en" ? passage.title : passage.kannadaTitle}
      hideBack={!fatal}
      onBack={() => goHome()}
      footer={
        fatal ? (
          <FlowButton
            label={lang === "en" ? "Try Again" : "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ"}
            icon="refresh"
            onPress={() => {
              setSteps({ save: "running", asr: "waiting", analyse: "waiting", feedback: "waiting" });
              setAttempt((a) => a + 1);
            }}
          />
        ) : null
      }
    >
      <View style={styles.hero}>
        {fatal ? (
          <AppIcon name="alert" size={42} color={C.red} />
        ) : (
          <ActivityIndicator size="large" color={C.forest} />
        )}
      </View>

      {fatal ? <Notice tone="error" text={fatal} /> : null}

      <Card>
        {(Object.keys(labels) as StepKey[]).map((k) => (
          <View key={k} style={styles.stepRow}>
            <View
              style={[
                styles.stepIcon,
                steps[k] === "done" && { backgroundColor: C.forest },
                steps[k] === "failed" && { backgroundColor: C.red },
              ]}
            >
              {steps[k] === "running" ? (
                <ActivityIndicator size="small" color={C.forest} />
              ) : steps[k] === "done" ? (
                <AppIcon name="check" size={13} color={C.white} strokeWidth={3} />
              ) : steps[k] === "skipped" ? (
                <AppIcon name="sync" size={13} color={C.forest} strokeWidth={2.5} />
              ) : steps[k] === "failed" ? (
                <AppIcon name="close" size={13} color={C.white} strokeWidth={3} />
              ) : null}
            </View>
            <Text style={[styles.stepText, steps[k] === "waiting" && { color: "#A3B8AE" }]}>
              {labels[k]}
            </Text>
          </View>
        ))}
      </Card>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", justifyContent: "center", paddingVertical: 28 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  stepIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: "#164A3D" },
});
