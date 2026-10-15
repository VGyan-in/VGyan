import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import { C, Card, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { getPassage } from "@/constants/content";
import { analyzeReading } from "@/features/reading/analyzer";
import { transcribe } from "@/features/reading/asr";
import { requestReadingFeedback } from "@/features/feedback/ai";
import { useGoHome } from "@/hooks/use-go-home";
import { useApp } from "@/state/app-store";
import { newId } from "@/core/auth/credentials";

type StepKey = "save" | "asr" | "analyse" | "feedback";
type StepState = "waiting" | "running" | "done" | "failed";

export default function ReadingProcessingScreen() {
  const router = useRouter();
  const goHome = useGoHome();
  const { lang, saveNewReading, updateReadingAttempt } = useApp();
  const params = useLocalSearchParams<{ passageId?: string; audioUri?: string; durationMs?: string }>();
  const passage = getPassage(params.passageId);
  const durationMs = Number(params.durationMs) || 0;
  const audioUri = params.audioUri || null;

  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    save: "running",
    asr: "waiting",
    analyse: "waiting",
    feedback: "waiting",
  });
  const [fatal, setFatal] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (!passage || started.current === attempt) return;
    started.current = attempt;
    const mark = (k: StepKey, s: StepState) => setSteps((prev) => ({ ...prev, [k]: s }));

    (async () => {
      setFatal(null);
      mark("save", "done");
      mark("asr", "running");
      let asr;
      try {
        asr = await transcribe({
          audioUri,
          language: passage.language,
          referenceText: passage.text,
          durationMs,
        });
      } catch (e) {
        console.warn("ASR failed", e);
        mark("asr", "failed");
        setFatal(
          lang === "en"
            ? "Speech recognition failed. Your recording is saved — try processing it again."
            : "ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
        );
        return;
      }
      mark("asr", "done");
      mark("analyse", "running");

      const analysis = analyzeReading(passage.text, asr.transcript, durationMs, passage.language);
      const id = newId();
      try {
        await saveNewReading({
        id,
        title: passage.title,
        kannadaTitle: passage.kannadaTitle,
        language: passage.language,
        level: passage.level,
        accuracy: analysis.accuracy,
        wpm: analysis.wpm,
        wcpm: analysis.wcpm,
        pace: analysis.pace,
        durationSec: Math.round(durationMs / 1000),
        mistakesCount: analysis.mistakes,
        substitutions: analysis.substitutions,
        omissions: analysis.omissions,
        insertions: analysis.insertions,
        practiceWords: analysis.practiceWords,
        words: analysis.words,
        passageId: passage.id,
        referenceText: passage.text,
        transcript: asr.transcript,
        audioUri,
        asrConfidence: asr.confidence,
        asrModelVersion: asr.modelVersion,
        aiStatus: "pending",
        });
      } catch (e) {
        console.warn("saving attempt failed", e);
        mark("analyse", "failed");
        setFatal(
          lang === "en"
            ? "Couldn't save this attempt on the phone. Check free storage space and try again."
            : "ಈ ಪ್ರಯತ್ನವನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಫೋನ್‌ನ ಸಂಗ್ರಹ ಸ್ಥಳ ಪರಿಶೀಲಿಸಿ."
        );
        return;
      }
      mark("analyse", "done");
      mark("feedback", "running");

      try {
        const feedback = await requestReadingFeedback(analysis, passage.language);
        await updateReadingAttempt(id, { feedback, aiStatus: "completed" });
        mark("feedback", "done");
      } catch (e) {
        // Metrics are already saved; feedback is retried later.
        console.warn("AI feedback failed", e);
        await updateReadingAttempt(id, { aiStatus: "failed" });
        mark("feedback", "failed");
      }

      router.replace({ pathname: "/reading/result", params: { id } });
    })();
  }, [attempt, passage, audioUri, durationMs, lang, saveNewReading, updateReadingAttempt, router]);

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
