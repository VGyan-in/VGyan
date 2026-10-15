import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import {
  ButtonRow,
  C,
  Card,
  FlowButton,
  FlowScreen,
  MetricTile,
  Notice,
  ScoreBar,
  SectionTitle,
  flowStyles,
} from "@/components/flow-ui";
import { getWritingPrompt, languageLabel } from "@/constants/content";
import { requestWritingAssessment } from "@/features/feedback/ai";
import { computeWritingMetrics } from "@/features/writing/metrics";
import { useGoHome } from "@/hooks/use-go-home";
import { useApp } from "@/state/app-store";
import { attemptDate } from "@/utils/format";

export default function WritingResultScreen() {
  const router = useRouter();
  const goHome = useGoHome();
  const { lang, writingAttempts, updateWritingAttempt } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const attempt = writingAttempts.find((a) => a.id === id);
  const [showOcr, setShowOcr] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!attempt) return <Redirect href="/home" />;

  const prompt = getWritingPrompt(attempt.promptId);
  const pending = attempt.aiStatus === "pending";
  const failed = attempt.aiStatus === "failed";
  const assessment = attempt.assessment;
  const hasScores = !pending && !failed;

  const retry = async () => {
    if (!attempt.correctedText) return;
    setRetrying(true);
    try {
      const metrics = computeWritingMetrics(attempt.correctedText, attempt.language);
      const a = await requestWritingAssessment(attempt.correctedText, metrics, attempt.language, prompt?.minWords ?? 40);
      updateWritingAttempt(attempt.id, {
        assessment: a,
        aiStatus: "completed",
        score: a.score,
        grammarScore: a.grammarScore,
        vocabularyScore: a.vocabularyScore,
        spellingScore: a.spellingScore,
      });
    } catch {
      updateWritingAttempt(attempt.id, { aiStatus: "failed" });
    } finally {
      setRetrying(false);
    }
  };

  const promptText = attempt.language === "Kannada" ? attempt.kannadaPrompt : attempt.prompt;

  return (
    <FlowScreen
      title={lang === "en" ? "Writing Result" : "ಬರವಣಿಗೆ ಫಲಿತಾಂಶ"}
      subtitle={`${languageLabel(attempt.language, lang)} • ${attemptDate(attempt)}`}
      onBack={() => (router.canGoBack() ? router.back() : goHome())}
      footer={
        <ButtonRow>
          <FlowButton
            variant="secondary"
            label={lang === "en" ? "Write Again" : "ಮತ್ತೆ ಬರೆಯಿರಿ"}
            icon="pencil"
            onPress={() => router.replace("/writing/prompt")}
          />
          <FlowButton label={lang === "en" ? "Done" : "ಮುಗಿಯಿತು"} icon="check" onPress={() => goHome()} />
        </ButtonRow>
      }
    >
      <Card style={styles.heroCard}>
        <Text style={styles.promptText} numberOfLines={3}>
          “{promptText}”
        </Text>
        {pending ? (
          <View style={styles.pendingBox}>
            <ActivityIndicator color={C.forest} />
            <Text style={flowStyles.bodyText}>
              {lang === "en" ? "Assessing your writing…" : "ನಿಮ್ಮ ಬರವಣಿಗೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ…"}
            </Text>
          </View>
        ) : hasScores ? (
          <>
            <Text style={styles.heroScore}>
              {attempt.score.toFixed(1)}
              <Text style={styles.heroOutOf}> / 10</Text>
            </Text>
            <Text style={styles.heroCaption}>{lang === "en" ? "Overall writing score" : "ಒಟ್ಟು ಅಂಕ"}</Text>
          </>
        ) : null}
      </Card>

      {failed ? (
        <>
          <Notice
            tone="warn"
            text={
              lang === "en"
                ? "Your writing is saved. The assessment couldn't finish — it will run when you're online."
                : "ನಿಮ್ಮ ಬರವಣಿಗೆ ಉಳಿಸಲಾಗಿದೆ. ಆನ್‌ಲೈನ್ ಆದಾಗ ಮೌಲ್ಯಮಾಪನ ನಡೆಯುತ್ತದೆ."
            }
          />
          <FlowButton
            variant="secondary"
            label={lang === "en" ? "Try Now" : "ಈಗ ಪ್ರಯತ್ನಿಸಿ"}
            icon="refresh"
            loading={retrying}
            onPress={retry}
            style={{ marginBottom: 12 }}
          />
        </>
      ) : null}

      <View style={flowStyles.metricsRow}>
        <MetricTile label={lang === "en" ? "Words" : "ಪದಗಳು"} value={String(attempt.wordCount)} sub={prompt ? `${lang === "en" ? "min" : "ಕನಿಷ್ಠ"} ${prompt.minWords}` : undefined} />
        <MetricTile label={lang === "en" ? "Sentences" : "ವಾಕ್ಯಗಳು"} value={attempt.sentenceCount != null ? String(attempt.sentenceCount) : "–"} />
        <MetricTile
          label={lang === "en" ? "Input" : "ವಿಧಾನ"}
          value={attempt.inputMethod === "typed" ? (lang === "en" ? "Typed" : "ಟೈಪ್") : attempt.inputMethod ? "Photo" : "OCR"}
        />
      </View>

      {hasScores ? (
        <Card>
          <SectionTitle title={lang === "en" ? "Skill Breakdown" : "ಕೌಶಲ ವಿಶ್ಲೇಷಣೆ"} />
          <ScoreBar label={lang === "en" ? "Grammar & sentences" : "ವ್ಯಾಕರಣ ಮತ್ತು ವಾಕ್ಯಗಳು"} value={attempt.grammarScore} />
          <ScoreBar label={lang === "en" ? "Vocabulary" : "ಶಬ್ದಕೋಶ"} value={attempt.vocabularyScore} />
          <ScoreBar label={lang === "en" ? "Spelling" : "ಕಾಗುಣಿತ"} value={attempt.spellingScore} />
        </Card>
      ) : null}

      {hasScores ? (
        <Card>
          <View style={styles.feedbackHeader}>
            <SectionTitle title={lang === "en" ? "Feedback" : "ಪ್ರತಿಕ್ರಿಯೆ"} />
            <View style={styles.aiBadge}>
              <AppIcon name="sparkles" size={11} color={C.forest} />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>
          {assessment ? (
            <>
              <Text style={[flowStyles.bodyText, { marginBottom: 8 }]}>{assessment.summary}</Text>
              {assessment.strengths.map((s, i) => (
                <Bullet key={`s${i}`} icon="check" color={C.forest} text={s} />
              ))}
              {assessment.improvements.map((s, i) => (
                <Bullet key={`i${i}`} icon="sparkles" color={C.amber} text={s} />
              ))}
            </>
          ) : (
            <Text style={flowStyles.bodyText}>
              {lang === "en" ? "No feedback recorded for this attempt." : "ಈ ಪ್ರಯತ್ನಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯೆ ಇಲ್ಲ."}
            </Text>
          )}
        </Card>
      ) : null}

      {attempt.correctedText ? (
        <Card>
          <SectionTitle title={lang === "en" ? "Your Answer" : "ನಿಮ್ಮ ಉತ್ತರ"} />
          <Text style={[styles.answerText, attempt.language === "Kannada" && { lineHeight: 26 }]}>
            {attempt.correctedText}
          </Text>

          {attempt.originalOcr ? (
            <>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowOcr((v) => !v)} style={styles.ocrToggle}>
                <AppIcon name="doc" size={13} color={C.muted} />
                <Text style={flowStyles.muted}>
                  {showOcr
                    ? lang === "en" ? "Hide original OCR text" : "ಮೂಲ OCR ಪಠ್ಯ ಮರೆಮಾಡಿ"
                    : lang === "en" ? "Show original OCR text" : "ಮೂಲ OCR ಪಠ್ಯ ತೋರಿಸಿ"}
                  {attempt.originalOcr === attempt.correctedText
                    ? lang === "en" ? " (no corrections)" : " (ಬದಲಾವಣೆ ಇಲ್ಲ)"
                    : ""}
                </Text>
              </TouchableOpacity>
              {showOcr ? <Text style={styles.ocrText}>{attempt.originalOcr}</Text> : null}
            </>
          ) : null}
        </Card>
      ) : null}

      {attempt.imageUri ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Image source={{ uri: attempt.imageUri }} style={styles.image} contentFit="cover" />
        </Card>
      ) : null}

      <Text style={[flowStyles.muted, { textAlign: "center" }]}>
        {attempt.synced === false
          ? lang === "en" ? "Saved on this phone • will sync when online" : "ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ • ಆನ್‌ಲೈನ್ ಆದಾಗ ಸಿಂಕ್"
          : lang === "en" ? "Synced to the research server" : "ಸರ್ವರ್‌ಗೆ ಸಿಂಕ್ ಆಗಿದೆ"}
      </Text>
    </FlowScreen>
  );
}

function Bullet({ icon, color, text }: { icon: "check" | "sparkles"; color: string; text: string }) {
  return (
    <View style={styles.bulletRow}>
      <AppIcon name={icon} size={13} color={color} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { alignItems: "center", paddingVertical: 18 },
  promptText: { fontSize: 13, fontStyle: "italic", color: "#164A3D", textAlign: "center", lineHeight: 19 },
  pendingBox: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  heroScore: { fontSize: 44, fontWeight: "900", color: C.forest, marginTop: 8 },
  heroOutOf: { fontSize: 18, fontWeight: "700", color: C.muted },
  heroCaption: { fontSize: 12, color: C.muted },
  feedbackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: C.mint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  aiBadgeText: { fontSize: 10, fontWeight: "800", color: C.forest },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  bulletText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: "#164A3D" },
  answerText: { fontSize: 14, lineHeight: 22, color: "#1C3A30" },
  ocrToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  ocrText: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    backgroundColor: C.cream,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  image: { width: "100%", height: 200 },
});
