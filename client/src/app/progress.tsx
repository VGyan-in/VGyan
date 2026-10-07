import React, { useState } from "react";
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
import { AppIcon } from "@/components/ui/app-icon";
import {
  mockWritingAttempts,
  mockPracticeWordsList,
} from "@/constants/mock-data";
import { BottomNavBar } from "@/components/bottom-nav-bar";

export default function ProgressScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "kn">("en");
  const [activeTab, setActiveTab] = useState<"reading" | "writing">("reading");
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("week");

  const weeklyTrend = [
    { day: "Mon", accuracy: 88, wpm: 72 },
    { day: "Tue", accuracy: 90, wpm: 75 },
    { day: "Wed", accuracy: 89, wpm: 74 },
    { day: "Thu", accuracy: 92, wpm: 78 },
    { day: "Fri", accuracy: 91, wpm: 80 },
    { day: "Sat", accuracy: 94, wpm: 82 },
    { day: "Sun", accuracy: 93, wpm: 81 },
  ];

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
              onPress={() => setLang(lang === "en" ? "kn" : "en")}
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
                  <Text style={styles.kpiBadge}>+3.4%</Text>
                </View>
                <Text style={styles.kpiValue}>92.4%</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Average Accuracy" : "ಸರಾಸರಿ ನಿಖರತೆ"}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="speed" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>+6 wpm</Text>
                </View>
                <Text style={styles.kpiValue}>80 WPM</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Reading Speed" : "ಓದುವ ವೇಗ"}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="pencil" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>Good</Text>
                </View>
                <Text style={styles.kpiValue}>8.6 / 10</Text>
                <Text style={styles.kpiLabel}>
                  {lang === "en" ? "Writing Score" : "ಬರವಣಿಗೆ ಅಂಕ"}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <AppIcon name="doc" size={15} color="#0B3D2E" />
                  <Text style={styles.kpiBadge}>Synced</Text>
                </View>
                <Text style={styles.kpiValue}>18</Text>
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
                {/* Weekly Trend Bar Chart */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      {lang === "en" ? "Daily Reading Accuracy" : "ದೈನಂದಿನ ಓದುವ ನಿಖರತೆ"}
                    </Text>
                    <Text style={styles.chartTarget}>Target 85%+</Text>
                  </View>

                  <View style={styles.barsArea}>
                    {weeklyTrend.map((item, idx) => (
                      <View key={idx} style={styles.barColumn}>
                        <Text style={styles.barTopNum}>{item.accuracy}%</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { height: `${(item.accuracy - 68) * 3.5}%` },
                              item.accuracy >= 92 && styles.barFillHigh,
                            ]}
                          />
                        </View>
                        <Text style={styles.barDayLabel}>{item.day}</Text>
                        <Text style={styles.barWpmLabel}>{item.wpm}w</Text>
                      </View>
                    ))}
                  </View>
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

                  {/* English bar */}
                  <View style={styles.progressLine}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLang}>English</Text>
                      <Text style={styles.progressValue}>94% • 82 WPM</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: "94%" }]} />
                    </View>
                  </View>

                  {/* Kannada bar */}
                  <View style={styles.progressLine}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLang}>Kannada (ಕನ್ನಡ)</Text>
                      <Text style={styles.progressValue}>91% • 76 WPM</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: "91%" }]} />
                    </View>
                  </View>
                </View>

                {/* Vosk Alignment Error Breakdown */}
                <View style={styles.chartCard}>
                  <Text style={styles.cardHeaderTitle}>
                    {lang === "en"
                      ? "ASR Word Alignment"
                      : "ಧ್ವನಿ ಮಾದರಿಯ ಪದ ಹೊಂದಾಣಿಕೆ"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {lang === "en"
                      ? "Vosk speech engine word-level classification."
                      : "ಸಾಧನದಲ್ಲಿನ ಮಾದರಿಯ ಪದ ವಿಂಗಡಣೆ."}
                  </Text>

                  <View style={styles.alignGrid}>
                    <View style={styles.alignItem}>
                      <Text style={[styles.alignNum, { color: "#0B3D2E" }]}>88%</Text>
                      <Text style={styles.alignLabel}>Correct</Text>
                    </View>
                    <View style={styles.alignItem}>
                      <Text style={[styles.alignNum, { color: "#D97706" }]}>6%</Text>
                      <Text style={styles.alignLabel}>Substitution</Text>
                    </View>
                    <View style={styles.alignItem}>
                      <Text style={[styles.alignNum, { color: "#DC2626" }]}>4%</Text>
                      <Text style={styles.alignLabel}>Omission</Text>
                    </View>
                    <View style={styles.alignItem}>
                      <Text style={[styles.alignNum, { color: "#2563EB" }]}>2%</Text>
                      <Text style={styles.alignLabel}>Insertion</Text>
                    </View>
                  </View>
                </View>

                {/* Practice Words List */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      {lang === "en" ? "Practice Words" : "ಅಭ್ಯಾಸ ಪದಗಳು"}
                    </Text>
                    <Text style={styles.chartTarget}>
                      {mockPracticeWordsList.length} Words
                    </Text>
                  </View>

                  <View style={styles.wordsWrap}>
                    {mockPracticeWordsList.map((pw, i) => (
                      <View key={i} style={styles.wordRow}>
                        <View style={styles.wordInfo}>
                          <Text style={styles.wordPrimary}>{pw.word}</Text>
                          <Text style={styles.wordSec}>{pw.phonetics} • {pw.kannada}</Text>
                        </View>
                        <View style={styles.wordActions}>
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagText}>{pw.difficulty}</Text>
                          </View>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.speakerBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Listen to ${pw.word}`}
                          >
                            <AppIcon name="sound" size={14} color="#0B3D2E" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
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
                      ? "Automated assessment metrics from student OCR handwriting text."
                      : "ಕೈಬರಹದ OCR ಆಧಾರಿತ ಮೌಲ್ಯಮಾಪನ ಅಂಕಗಳು."}
                  </Text>

                  <View style={styles.rubricWrap}>
                    <View style={styles.progressLine}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLang}>Spelling & Orthography</Text>
                        <Text style={styles.progressValue}>92%</Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: "92%" }]} />
                      </View>
                    </View>

                    <View style={styles.progressLine}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLang}>Grammar & Sentence Syntax</Text>
                        <Text style={styles.progressValue}>88%</Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: "88%" }]} />
                      </View>
                    </View>

                    <View style={styles.progressLine}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLang}>Vocabulary Diversity</Text>
                        <Text style={styles.progressValue}>84%</Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: "84%" }]} />
                      </View>
                    </View>

                    <View style={styles.progressLine}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLang}>OCR Handwriting Legibility</Text>
                        <Text style={styles.progressValue}>96%</Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: "96%" }]} />
                      </View>
                    </View>
                  </View>
                </View>

                {/* AI Qualitative Feedback */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      {lang === "en" ? "Diagnostic Feedback" : "ವಿಶ್ಲೇಷಣಾತ್ಮಕ ಸಲಹೆಗಳು"}
                    </Text>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagText}>Gemini AI</Text>
                    </View>
                  </View>

                  <Text style={styles.feedbackQuote}>
                    "{mockWritingAttempts[0].aiFeedback}"
                  </Text>

                  <View style={styles.tipBox}>
                    <AppIcon name="sparkles" size={14} color="#0B3D2E" />
                    <Text style={styles.tipText}>
                      Focus on maintaining consistent past-tense verbs in descriptive paragraphs.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Persistent Bottom Nav */}
          <BottomNavBar activeTab="progress" />
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
