import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { AppIcon } from "@/components/ui/app-icon";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { tokenize } from "@/features/reading/analyzer";
import { useApp } from "@/state/app-store";
import { attemptDate } from "@/utils/format";

type Timeframe = "week" | "month" | "all";

const TIMEFRAME_DAYS: Record<Timeframe, number | null> = { week: 7, month: 30, all: null };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default function ProgressScreen() {
  const router = useRouter();
  const { lang, toggleLang, readingAttempts, writingAttempts, pendingCount } = useApp();
  const [activeTab, setActiveTab] = useState<"reading" | "writing">("reading");
  const [timeframe, setTimeframe] = useState<Timeframe>("week");

  const [now] = useState(() => Date.now());

  // Seed attempts have no timestamp; they are treated as recent so the demo history stays visible.
  const { reading, writing } = useMemo(() => {
    const days = TIMEFRAME_DAYS[timeframe];
    const inRange = (a: { createdAt?: string }) =>
      days == null || !a.createdAt || now - new Date(a.createdAt).getTime() <= days * 86400000;
    return {
      reading: readingAttempts.filter(inRange),
      writing: writingAttempts
        .filter(inRange)
        .filter((a) => a.aiStatus !== "pending" && a.aiStatus !== "failed"),
    };
  }, [readingAttempts, writingAttempts, timeframe, now]);

  const avgAccuracy = avg(reading.map((a) => a.accuracy));
  const avgWpm = avg(reading.map((a) => a.wpm));
  const avgWriting = avg(writing.map((a) => a.score));
  const totalSessions = reading.length + writing.length;

  // Oldest → newest, last 7, for the bar chart.
  const trend = [...reading].reverse().slice(-7);

  const byLanguage = (["English", "Kannada"] as const).map((language) => {
    const xs = reading.filter((a) => a.language === language);
    return {
      language,
      count: xs.length,
      accuracy: avg(xs.map((a) => a.accuracy)),
      wpm: avg(xs.map((a) => a.wpm)),
    };
  });

  // Alignment breakdown across attempts that recorded it, as a share of reference words.
  const aligned = reading.filter((a) => a.substitutions != null && a.referenceText);
  const refWords = aligned.reduce((sum, a) => sum + tokenize(a.referenceText!).length, 0);
  const pct = (n: number) => (refWords ? Math.round((n / refWords) * 100) : 0);
  const subs = aligned.reduce((s, a) => s + (a.substitutions ?? 0), 0);
  const oms = aligned.reduce((s, a) => s + (a.omissions ?? 0), 0);
  const ins = aligned.reduce((s, a) => s + (a.insertions ?? 0), 0);
  const correctPct = refWords ? Math.max(0, 100 - pct(subs) - pct(oms)) : 0;

  // Practice words ranked by how often they were missed.
  const practice = useMemo(() => {
    const map = new Map<string, { word: string; language: string; count: number }>();
    for (const a of reading) {
      for (const w of a.practiceWords) {
        const key = w.toLowerCase();
        const entry = map.get(key) ?? { word: w, language: a.language, count: 0 };
        entry.count += 1;
        map.set(key, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [reading]);

  const avgRubric = {
    spelling: avg(writing.map((a) => a.spellingScore)),
    grammar: avg(writing.map((a) => a.grammarScore)),
    vocabulary: avg(writing.map((a) => a.vocabularyScore)),
    ocr: avg(writing.filter((a) => a.inputMethod !== "typed" && a.ocrAccuracy > 0).map((a) => a.ocrAccuracy)),
  };
  const latestWriting = writing[0];
  const latestTip = latestWriting?.assessment?.improvements[0];

  const speak = (word: string, language: string) => {
    Speech.stop();
    Speech.speak(word, { language: language === "Kannada" ? "kn-IN" : "en-IN", rate: 0.8 });
  };

  const fmt = (n: number | null, digits = 0) => (n == null ? "–" : n.toFixed(digits));

  const emptyReading = (
    <Text style={styles.emptyText}>
      {lang === "en"
        ? "No reading attempts in this period yet."
        : "ಈ ಅವಧಿಯಲ್ಲಿ ಇನ್ನೂ ಯಾವುದೇ ಓದುವ ಪ್ರಯತ್ನಗಳಿಲ್ಲ."}
    </Text>
  );

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.headerTitle}>
                {lang === "en" ? "Learning Analytics" : "ಕಲಿಕೆಯ ವಿಶ್ಲೇಷಣೆ"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {lang === "en" ? "Phase 2 • Performance" : "ಹಂತ 2 • ಪ್ರಗತಿ"}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleLang}
              style={styles.langPill}
              accessibilityRole="button"
              accessibilityLabel="Switch language"
            >
              <AppIcon name="globe" size={13} color="#0B3D2E" />
              <Text style={styles.langPillText}>
                {lang === "en" ? "ಕನ್ನಡ" : "EN"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Timeframe Selector */}
            <View style={styles.filterSegment}>
              {(["week", "month", "all"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  activeOpacity={0.8}
                  onPress={() => setTimeframe(t)}
                  style={[
                    styles.filterOption,
                    timeframe === t && styles.filterOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      timeframe === t && styles.filterOptionTextActive,
                    ]}
                  >
                    {t === "week"
                      ? lang === "en" ? "This Week" : "ಈ ವಾರ"
                      : t === "month"
                      ? lang === "en" ? "This Month" : "ಈ ತಿಂಗಳು"
                      : lang === "en" ? "All Time" : "ಸಂಪೂರ್ಣ"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* KPI Metrics 2x2 Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="chart" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>{reading.length} {lang === "en" ? "reads" : "ಓದು"}</Text>
                </View>
                <Text style={styles.kpiValue}>{avgAccuracy == null ? "–" : `${fmt(avgAccuracy, 1)}%`}</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Average Accuracy" : "ಸರಾಸರಿ ನಿಖರತೆ"}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="speed" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>{lang === "en" ? "avg" : "ಸರಾಸರಿ"}</Text>
                </View>
                <Text style={styles.kpiValue}>{avgWpm == null ? "–" : `${fmt(avgWpm)} WPM`}</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Reading Speed" : "ಓದುವ ವೇಗ"}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="pencil" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>{writing.length} {lang === "en" ? "essays" : "ಬರಹ"}</Text>
                </View>
                <Text style={styles.kpiValue}>{avgWriting == null ? "–" : `${fmt(avgWriting, 1)} / 10`}</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Writing Score" : "ಬರವಣಿಗೆ ಅಂಕ"}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="doc" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>
                    {pendingCount > 0 ? `${pendingCount} ${lang === "en" ? "pending" : "ಬಾಕಿ"}` : lang === "en" ? "Synced" : "ಸಿಂಕ್"}
                  </Text>
                </View>
                <Text style={styles.kpiValue}>{totalSessions}</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Total Sessions" : "ಅಧಿವೇಶನಗಳು"}
                </Text>
              </View>
            </View>

            {/* Domain Switcher */}
            <View style={styles.domainSegment}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveTab("reading")}
                style={[
                  styles.domainOption,
                  activeTab === "reading" && styles.domainOptionActive,
                ]}
              >
                <AppIcon
                  name="mic"
                  size={15}
                  color={activeTab === "reading" ? "#0B3D2E" : "#688478"}
                />
                <Text
                  style={[
                    styles.domainOptionText,
                    activeTab === "reading" && styles.domainOptionTextActive,
                  ]}
                >
                  {lang === "en" ? "Reading Fluency" : "ಓದುವ ನಿರರ್ಗಳತೆ"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveTab("writing")}
                style={[
                  styles.domainOption,
                  activeTab === "writing" && styles.domainOptionActive,
                ]}
              >
                <AppIcon
                  name="pencil"
                  size={15}
                  color={activeTab === "writing" ? "#0B3D2E" : "#688478"}
                />
                <Text
                  style={[
                    styles.domainOptionText,
                    activeTab === "writing" && styles.domainOptionTextActive,
                  ]}
                >
                  {lang === "en" ? "Writing & OCR" : "ಬರವಣಿಗೆ ಮತ್ತು OCR"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* READING CONTENT */}
            {activeTab === "reading" && (
              <View style={styles.tabContentWrap}>
                {/* Accuracy Trend Bar Chart */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      {lang === "en" ? "Reading Accuracy Trend" : "ಓದುವ ನಿಖರತೆಯ ಪ್ರವೃತ್ತಿ"}
                    </Text>
                    <Text style={styles.chartTarget}>Target 85%+</Text>
                  </View>

                  {trend.length === 0 ? (
                    emptyReading
                  ) : (
                    <View style={styles.barsArea}>
                      {trend.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.7}
                          style={styles.barColumn}
                          onPress={() => router.push({ pathname: "/reading/result", params: { id: item.id } })}
                          accessibilityLabel={`${item.title}: ${item.accuracy}%`}
                        >
                          <Text style={styles.barTopNum}>{Math.round(item.accuracy)}%</Text>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                { height: `${Math.max(4, item.accuracy)}%` },
                                item.accuracy >= 85 && styles.barFillHigh,
                              ]}
                            />
                          </View>
                          <Text style={styles.barDayLabel} numberOfLines={1}>
                            {attemptDate(item).replace("Today, ", "").replace("Yesterday", "Yday")}
                          </Text>
                          <Text style={styles.barWpmLabel}>{item.wpm}w</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Bilingual Fluency Breakdown */}
                <View style={styles.chartCard}>
                  <Text style={styles.cardHeaderTitle}>
                    {lang === "en" ? "Bilingual Fluency" : "ದ್ವಿಭಾಷಾ ನಿರರ್ಗಳತೆ"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {lang === "en"
                      ? "Comparative accuracy between English and Kannada oral passages."
                      : "ಇಂಗ್ಲಿಷ್ ಮತ್ತು ಕನ್ನಡ ಓದುವಿಕೆಯ ನಡುವಿನ ಹೋಲಿಕೆ."}
                  </Text>

                  {byLanguage.map((l) => (
                    <View key={l.language} style={styles.progressLine}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLang}>
                          {l.language === "English" ? "English" : "Kannada (ಕನ್ನಡ)"}
                        </Text>
                        <Text style={styles.progressValue}>
                          {l.count === 0
                            ? lang === "en" ? "Not attempted" : "ಪ್ರಯತ್ನಿಸಿಲ್ಲ"
                            : `${fmt(l.accuracy)}% • ${fmt(l.wpm)} WPM`}
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: `${l.accuracy ?? 0}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Word Alignment Error Breakdown */}
                <View style={styles.chartCard}>
                  <Text style={styles.cardHeaderTitle}>
                    {lang === "en"
                      ? "ASR Word Alignment"
                      : "ಧ್ವನಿ ಮಾದರಿಯ ಪದ ಹೊಂದಾಣಿಕೆ"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {lang === "en"
                      ? "Share of passage words read correctly, changed, skipped, or added."
                      : "ಸರಿಯಾಗಿ, ಬದಲಾಗಿ, ಬಿಟ್ಟು ಅಥವಾ ಹೆಚ್ಚುವರಿಯಾಗಿ ಓದಿದ ಪದಗಳ ಪಾಲು."}
                  </Text>

                  {refWords === 0 ? (
                    <Text style={styles.emptyText}>
                      {lang === "en"
                        ? "Complete a reading assessment to see your word breakdown."
                        : "ಪದ ವಿಶ್ಲೇಷಣೆ ನೋಡಲು ಓದುವ ಮೌಲ್ಯಮಾಪನ ಪೂರ್ಣಗೊಳಿಸಿ."}
                    </Text>
                  ) : (
                    <View style={styles.alignGrid}>
                      <View style={styles.alignItem}>
                        <Text style={[styles.alignNum, { color: "#0B3D2E" }]}>{correctPct}%</Text>
                        <Text style={styles.alignLabel}>Correct</Text>
                      </View>
                      <View style={styles.alignItem}>
                        <Text style={[styles.alignNum, { color: "#D97706" }]}>{pct(subs)}%</Text>
                        <Text style={styles.alignLabel}>Substitution</Text>
                      </View>
                      <View style={styles.alignItem}>
                        <Text style={[styles.alignNum, { color: "#DC2626" }]}>{pct(oms)}%</Text>
                        <Text style={styles.alignLabel}>Omission</Text>
                      </View>
                      <View style={styles.alignItem}>
                        <Text style={[styles.alignNum, { color: "#2563EB" }]}>{pct(ins)}%</Text>
                        <Text style={styles.alignLabel}>Insertion</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Practice Words List */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      {lang === "en" ? "Practice Words" : "ಅಭ್ಯಾಸ ಪದಗಳು"}
                    </Text>
                    <Text style={styles.chartTarget}>
                      {practice.length} {lang === "en" ? "Words" : "ಪದಗಳು"}
                    </Text>
                  </View>

                  {practice.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {lang === "en" ? "No practice words yet. Great reading!" : "ಇನ್ನೂ ಅಭ್ಯಾಸ ಪದಗಳಿಲ್ಲ!"}
                    </Text>
                  ) : (
                    <View style={styles.wordsWrap}>
                      {practice.map((pw) => (
                        <View key={pw.word} style={styles.wordRow}>
                          <View style={styles.wordInfo}>
                            <Text style={styles.wordPrimary}>{pw.word}</Text>
                            <Text style={styles.wordSec}>
                              {pw.language} • {lang === "en" ? `missed ${pw.count}×` : `${pw.count} ಬಾರಿ ತಪ್ಪು`}
                            </Text>
                          </View>
                          <View style={styles.wordActions}>
                            <View style={styles.tagBadge}>
                              <Text style={styles.tagText}>
                                {pw.count >= 3 ? "Hard" : pw.count === 2 ? "Medium" : "Easy"}
                              </Text>
                            </View>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              style={styles.speakerBtn}
                              onPress={() => speak(pw.word, pw.language)}
                              accessibilityRole="button"
                              accessibilityLabel={`Listen to ${pw.word}`}
                            >
                              <AppIcon name="sound" size={14} color="#0B3D2E" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* WRITING CONTENT */}
            {activeTab === "writing" && (
              <View style={styles.tabContentWrap}>
                <View style={styles.chartCard}>
                  <Text style={styles.cardHeaderTitle}>
                    {lang === "en" ? "Rubric Evaluation" : "ಬರವಣಿಗೆ ಮೌಲ್ಯಮಾಪನ"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {lang === "en"
                      ? "Average scores across your assessed writing."
                      : "ನಿಮ್ಮ ಬರವಣಿಗೆಯ ಸರಾಸರಿ ಅಂಕಗಳು."}
                  </Text>

                  {writing.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {lang === "en" ? "No writing assessed in this period yet." : "ಈ ಅವಧಿಯಲ್ಲಿ ಯಾವುದೇ ಬರವಣಿಗೆ ಇಲ್ಲ."}
                    </Text>
                  ) : (
                    <View style={styles.rubricWrap}>
                      {[
                        { label: "Spelling & Orthography", value: avgRubric.spelling },
                        { label: "Grammar & Sentence Syntax", value: avgRubric.grammar },
                        { label: "Vocabulary Diversity", value: avgRubric.vocabulary },
                        { label: "OCR Handwriting Legibility", value: avgRubric.ocr },
                      ]
                        .filter((r) => r.value != null)
                        .map((r) => (
                          <View key={r.label} style={styles.progressLine}>
                            <View style={styles.progressHeader}>
                              <Text style={styles.progressLang}>{r.label}</Text>
                              <Text style={styles.progressValue}>{fmt(r.value)}%</Text>
                            </View>
                            <View style={styles.track}>
                              <View style={[styles.fill, { width: `${r.value ?? 0}%` }]} />
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                </View>

                {/* Latest qualitative feedback */}
                {latestWriting ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/writing/result", params: { id: latestWriting.id } })}
                    style={styles.chartCard}
                  >
                    <View style={styles.chartHeader}>
                      <Text style={styles.cardHeaderTitle}>
                        {lang === "en" ? "Latest Feedback" : "ಇತ್ತೀಚಿನ ಪ್ರತಿಕ್ರಿಯೆ"}
                      </Text>
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagText}>AI</Text>
                      </View>
                    </View>

                    <Text style={styles.feedbackQuote}>
                      &quot;{latestWriting.aiFeedback}&quot;
                    </Text>

                    {latestTip ? (
                      <View style={styles.tipBox}>
                        <AppIcon name="sparkles" size={14} color="#0B3D2E" />
                        <Text style={styles.tipText}>{latestTip}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ) : null}

                {writing.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/writing/result", params: { id: w.id } })}
                    style={[styles.wordRow, styles.writingRow]}
                  >
                    <View style={styles.wordInfo}>
                      <Text style={styles.wordPrimary} numberOfLines={1}>
                        {lang === "en" ? w.prompt : w.kannadaPrompt}
                      </Text>
                      <Text style={styles.wordSec}>
                        {attemptDate(w)} • {w.wordCount} {lang === "en" ? "words" : "ಪದಗಳು"}
                      </Text>
                    </View>
                    <Text style={styles.progressValue}>{w.score.toFixed(1)} / 10</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Persistent Bottom Nav */}
          <BottomNavBar activeTab="progress" syncBadgeCount={pendingCount} />
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 12.5,
    color: "#688478",
    textAlign: "center",
    paddingVertical: 14,
  },
  writingRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#FAF6EF",
    alignItems: "center",
    justifyContent: "center",
  },
  screenWrapper: {
    width: "100%",
    height: "100%",
    maxWidth: 480,
    backgroundColor: "#FAF6EF",
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2ECE6",
    backgroundColor: "#FAF6EF",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#688478",
    fontWeight: "500",
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    gap: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  langPillText: {
    color: "#0B3D2E",
    fontSize: 11.5,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  filterSegment: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    marginBottom: 14,
  },
  filterOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  filterOptionActive: {
    backgroundColor: "#0B3D2E",
  },
  filterOptionText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#688478",
  },
  filterOptionTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2ECE6",
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kpiBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  kpiLabel: {
    fontSize: 10.5,
    color: "#688478",
    marginTop: 2,
  },
  domainSegment: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    marginBottom: 14,
  },
  domainOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  domainOptionActive: {
    backgroundColor: "#EAF3EF",
  },
  domainOptionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#688478",
  },
  domainOptionTextActive: {
    color: "#0B3D2E",
    fontWeight: "700",
  },
  tabContentWrap: {
    gap: 12,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: "#688478",
    marginBottom: 10,
  },
  chartTarget: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  barsArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 125,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: "center",
    width: 36,
  },
  barTopNum: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#0B3D2E",
    marginBottom: 3,
  },
  barTrack: {
    width: 12,
    height: 65,
    backgroundColor: "#F1F5F3",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#8CA399",
    borderRadius: 6,
  },
  barFillHigh: {
    backgroundColor: "#0B3D2E",
  },
  barDayLabel: {
    fontSize: 10,
    color: "#4E6D61",
    fontWeight: "600",
    marginTop: 4,
  },
  barWpmLabel: {
    fontSize: 9,
    color: "#8CA399",
  },
  progressLine: {
    marginBottom: 10,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLang: {
    fontSize: 12,
    fontWeight: "600",
    color: "#164A3D",
  },
  progressValue: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  track: {
    height: 6,
    backgroundColor: "#F1F5F3",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#0B3D2E",
    borderRadius: 3,
  },
  alignGrid: {
    flexDirection: "row",
    backgroundColor: "#FAF6EF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EBE5D8",
  },
  alignItem: {
    flex: 1,
    alignItems: "center",
  },
  alignNum: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 1,
  },
  alignLabel: {
    fontSize: 9.5,
    color: "#688478",
    fontWeight: "500",
  },
  wordsWrap: {
    gap: 8,
    marginTop: 6,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F3",
  },
  wordInfo: {
    flex: 1,
  },
  wordPrimary: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  wordSec: {
    fontSize: 11,
    color: "#688478",
  },
  wordActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tagBadge: {
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  speakerBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE9E2",
  },
  rubricWrap: {
    gap: 2,
    marginTop: 4,
  },
  feedbackQuote: {
    fontSize: 12.5,
    color: "#164A3D",
    fontStyle: "italic",
    lineHeight: 17,
    marginBottom: 8,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF6EF",
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: "#4E6D61",
    lineHeight: 15,
  },
});
