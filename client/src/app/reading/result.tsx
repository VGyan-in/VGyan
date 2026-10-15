import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { AppIcon } from "@/components/ui/app-icon";
import {
  ButtonRow,
  C,
  Card,
  FlowButton,
  FlowScreen,
  MetricTile,
  Notice,
  SectionTitle,
  flowStyles,
} from "@/components/flow-ui";
import { languageLabel, levelLabel } from "@/constants/content";
import type { AlignedWord } from "@/features/reading/analyzer";
import { requestReadingFeedback } from "@/features/feedback/ai";
import { useGoHome } from "@/hooks/use-go-home";
import { useApp } from "@/state/app-store";
import { attemptDate } from "@/utils/format";

export default function ReadingResultScreen() {
  const router = useRouter();
  const goHome = useGoHome();
  const { lang, readingAttempts, updateReadingAttempt } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const attempt = readingAttempts.find((a) => a.id === id);
  const [retrying, setRetrying] = useState(false);

  const player = useAudioPlayer(attempt?.audioUri || null);
  const playerStatus = useAudioPlayerStatus(player);

  if (!attempt) return <Redirect href="/home" />;

  const togglePlayback = () => {
    if (playerStatus.playing) {
      player.pause();
    } else {
      if (playerStatus.didJustFinish || playerStatus.currentTime >= playerStatus.duration - 0.1) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const retryFeedback = async () => {
    setRetrying(true);
    try {
      const feedback = await requestReadingFeedback(
        {
          accuracy: attempt.accuracy,
          wpm: attempt.wpm,
          pace: attempt.pace,
          omissions: attempt.omissions ?? 0,
          practiceWords: attempt.practiceWords,
        },
        attempt.language
      );
      updateReadingAttempt(attempt.id, { feedback, aiStatus: "completed" });
    } catch {
      updateReadingAttempt(attempt.id, { aiStatus: "failed" });
    } finally {
      setRetrying(false);
    }
  };

  const accuracyColor = attempt.accuracy >= 90 ? C.forest : attempt.accuracy >= 75 ? C.amber : C.red;
  const headline =
    attempt.accuracy >= 90
      ? lang === "en" ? "Excellent reading!" : "ಅತ್ಯುತ್ತಮ ಓದು!"
      : attempt.accuracy >= 75
      ? lang === "en" ? "Good job, keep practising!" : "ಚೆನ್ನಾಗಿದೆ, ಅಭ್ಯಾಸ ಮುಂದುವರಿಸಿ!"
      : lang === "en" ? "Nice try! Let's practise together." : "ಒಳ್ಳೆಯ ಪ್ರಯತ್ನ! ಒಟ್ಟಿಗೆ ಅಭ್ಯಾಸ ಮಾಡೋಣ.";

  return (
    <FlowScreen
      title={lang === "en" ? "Reading Result" : "ಓದುವ ಫಲಿತಾಂಶ"}
      subtitle={`${lang === "en" ? attempt.title : attempt.kannadaTitle} • ${attemptDate(attempt)}`}
      onBack={() => (router.canGoBack() ? router.back() : goHome())}
      footer={
        <ButtonRow>
          <FlowButton
            variant="secondary"
            label={lang === "en" ? "Read Again" : "ಮತ್ತೆ ಓದಿ"}
            icon="refresh"
            onPress={() =>
              attempt.passageId
                ? router.replace({ pathname: "/reading/passage", params: { passageId: attempt.passageId } })
                : router.replace({ pathname: "/reading/language", params: { level: attempt.level } })
            }
          />
          <FlowButton
            label={lang === "en" ? "Done" : "ಮುಗಿಯಿತು"}
            icon="check"
            onPress={() => goHome()}
          />
        </ButtonRow>
      }
    >
      <Card style={styles.heroCard}>
        <Text style={styles.heroLabel}>
          {languageLabel(attempt.language, lang)} • {levelLabel(attempt.level, lang)}
        </Text>
        <Text style={[styles.heroScore, { color: accuracyColor }]}>{attempt.accuracy}%</Text>
        <Text style={styles.heroCaption}>{lang === "en" ? "Reading accuracy" : "ಓದುವ ನಿಖರತೆ"}</Text>
        <Text style={styles.heroHeadline}>{headline}</Text>
      </Card>

      <View style={flowStyles.metricsRow}>
        <MetricTile label={lang === "en" ? "Words / min" : "ಪದ / ನಿಮಿಷ"} value={String(attempt.wpm)} sub={attempt.wcpm != null ? `${attempt.wcpm} ${lang === "en" ? "correct" : "ಸರಿ"}` : undefined} />
        <MetricTile label={lang === "en" ? "Pace" : "ವೇಗ"} value={attempt.pace} />
        <MetricTile label={lang === "en" ? "Mistakes" : "ತಪ್ಪುಗಳು"} value={String(attempt.mistakesCount)} color={attempt.mistakesCount > 5 ? C.amber : C.forest} />
      </View>

      {attempt.substitutions != null ? (
        <Card>
          <SectionTitle title={lang === "en" ? "Word Check" : "ಪದ ಪರಿಶೀಲನೆ"} right={`${attempt.durationSec}s`} />
          <View style={styles.breakdownRow}>
            <Breakdown color={C.amber} label={lang === "en" ? "Changed" : "ಬದಲಾದ"} value={attempt.substitutions} />
            <Breakdown color={C.red} label={lang === "en" ? "Skipped" : "ಬಿಟ್ಟ"} value={attempt.omissions ?? 0} />
            <Breakdown color={C.blue} label={lang === "en" ? "Extra" : "ಹೆಚ್ಚುವರಿ"} value={attempt.insertions ?? 0} />
          </View>
          {attempt.words ? <WordDiff words={attempt.words} lang={lang} /> : null}
        </Card>
      ) : null}

      {attempt.audioUri ? (
        <TouchableOpacity activeOpacity={0.85} onPress={togglePlayback} style={styles.playRow} accessibilityRole="button">
          <View style={styles.playIcon}>
            <AppIcon name={playerStatus.playing ? "pause" : "play"} size={16} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.playTitle}>{lang === "en" ? "Listen to my reading" : "ನನ್ನ ಓದನ್ನು ಕೇಳಿ"}</Text>
            <Text style={flowStyles.muted}>
              {lang === "en" ? "Original recording kept for your teacher" : "ಮೂಲ ರೆಕಾರ್ಡಿಂಗ್ ಉಳಿಸಲಾಗಿದೆ"}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {attempt.practiceWords.length > 0 ? (
        <Card>
          <SectionTitle title={lang === "en" ? "Practice Words" : "ಅಭ್ಯಾಸ ಪದಗಳು"} right={String(attempt.practiceWords.length)} />
          <View style={styles.chipWrap}>
            {attempt.practiceWords.map((w) => (
              <View key={w} style={styles.chip}>
                <Text style={styles.chipText}>{w}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.feedbackHeader}>
          <SectionTitle title={lang === "en" ? "Feedback" : "ಪ್ರತಿಕ್ರಿಯೆ"} />
          <View style={styles.aiBadge}>
            <AppIcon name="sparkles" size={11} color={C.forest} />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        {attempt.feedback ? (
          <>
            <Text style={[flowStyles.bodyText, { marginBottom: 8 }]}>{attempt.feedback.summary}</Text>
            {attempt.feedback.strengths.map((s, i) => (
              <Bullet key={`s${i}`} icon="check" color={C.forest} text={s} />
            ))}
            {attempt.feedback.improvements.map((s, i) => (
              <Bullet key={`i${i}`} icon="sparkles" color={C.amber} text={s} />
            ))}
          </>
        ) : (
          <>
            <Notice
              tone="warn"
              text={
                lang === "en"
                  ? "Feedback isn't ready yet. Your scores are saved; feedback will be fetched when you're online."
                  : "ಪ್ರತಿಕ್ರಿಯೆ ಇನ್ನೂ ಸಿದ್ಧವಿಲ್ಲ. ಆನ್‌ಲೈನ್ ಆದಾಗ ಪಡೆಯಲಾಗುತ್ತದೆ."
              }
            />
            <FlowButton
              variant="secondary"
              label={lang === "en" ? "Try Now" : "ಈಗ ಪ್ರಯತ್ನಿಸಿ"}
              icon="refresh"
              loading={retrying}
              onPress={retryFeedback}
            />
          </>
        )}
      </Card>

      {attempt.transcript ? (
        <Card>
          <SectionTitle
            title={lang === "en" ? "What we heard" : "ನಾವು ಕೇಳಿದ್ದು"}
            right={attempt.asrConfidence != null ? `${Math.round(attempt.asrConfidence * 100)}% ${lang === "en" ? "confidence" : "ವಿಶ್ವಾಸ"}` : undefined}
          />
          <Text style={flowStyles.bodyText}>{attempt.transcript}</Text>
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

function Breakdown({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.breakdownItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.breakdownValue}>{value}</Text>
      <Text style={styles.breakdownLabel}>{label}</Text>
    </View>
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

/** Passage rendered word by word, coloured by alignment status. */
/**
 * Index where the student stopped reading: start of the trailing run of omissions.
 * A run shorter than 3 words is treated as ordinary skips.
 */
function notReachedFrom(words: AlignedWord[]): number {
  let i = words.length;
  while (i > 0 && words[i - 1].status === "omission") i--;
  return words.length - i >= 3 && i > 0 ? i : words.length;
}

function WordDiff({ words, lang }: { words: AlignedWord[]; lang: "en" | "kn" }) {
  const stopAt = notReachedFrom(words);
  const stoppedEarly = stopAt < words.length;
  return (
    <View>
      {stoppedEarly ? (
        <Notice
          tone="warn"
          text={
            lang === "en"
              ? `You stopped before the end. The ${words.length - stopAt} grey words weren't read, so they count as skipped. Try reading the whole passage next time!`
              : `ನೀವು ಕೊನೆಯವರೆಗೂ ಓದಲಿಲ್ಲ. ಓದದ ${words.length - stopAt} ಬೂದು ಪದಗಳನ್ನು ಬಿಟ್ಟವು ಎಂದು ಎಣಿಸಲಾಗಿದೆ.`
          }
        />
      ) : null}
      <Text style={styles.diffText}>
        {words.map((w, i) => {
          const sep = i === 0 ? "" : " ";
          if (i >= stopAt)
            return (
              <Text key={i} style={styles.diffNotReached}>
                {sep}
                {w.ref}
              </Text>
            );
          if (w.status === "correct") return <Text key={i}>{sep}{w.ref}</Text>;
          if (w.status === "omission")
            return (
              <Text key={i}>
                {sep}
                <Text style={[styles.diffWord, styles.diffOmission]}>{w.ref}</Text>
              </Text>
            );
          if (w.status === "insertion")
            return (
              <Text key={i}>
                {sep}
                <Text style={[styles.diffWord, styles.diffInsertion]}>+{w.hyp}</Text>
              </Text>
            );
          return (
            <Text key={i}>
              {sep}
              <Text style={[styles.diffWord, styles.diffSubstitution]}>{w.ref}</Text>
              <Text style={styles.diffSaid}> ({w.hyp})</Text>
            </Text>
          );
        })}
      </Text>
      <Text style={[flowStyles.muted, { marginTop: 8 }]}>
        {lang === "en"
          ? "Orange = said differently (what you said in brackets) • Red = skipped • Blue = extra word"
          : "ಕಿತ್ತಳೆ = ಬೇರೆ ರೀತಿ ಹೇಳಿದ್ದು • ಕೆಂಪು = ಬಿಟ್ಟದ್ದು • ನೀಲಿ = ಹೆಚ್ಚುವರಿ ಪದ"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { alignItems: "center", paddingVertical: 20 },
  heroLabel: { fontSize: 11.5, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  heroScore: { fontSize: 48, fontWeight: "900", marginTop: 4 },
  heroCaption: { fontSize: 12, color: C.muted },
  heroHeadline: { fontSize: 15, fontWeight: "800", color: C.forest, marginTop: 10, textAlign: "center" },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  breakdownValue: { fontSize: 14, fontWeight: "800", color: C.forest },
  breakdownLabel: { fontSize: 12, color: C.muted },
  diffText: { fontSize: 16, lineHeight: 28, color: "#1C3A30" },
  diffWord: { fontWeight: "700", borderRadius: 4 },
  diffSubstitution: { color: C.amber, backgroundColor: "#FEF3C7" },
  diffOmission: { color: C.red, backgroundColor: "#FDECEC", textDecorationLine: "line-through" },
  diffInsertion: { color: C.blue, backgroundColor: "#E8EFFD", fontStyle: "italic" },
  diffNotReached: { color: "#A3B8AE" },
  diffSaid: { fontSize: 12, color: C.amber },
  playRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 12,
  },
  playIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  playTitle: { fontSize: 13.5, fontWeight: "700", color: C.forest },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#FEF3C7", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13.5, fontWeight: "700", color: "#92400E" },
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
});
