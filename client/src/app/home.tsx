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
  initialStudentProfile,
  mockReadingAttempts,
  initialSyncStatus,
} from "@/constants/mock-data";
import { BottomNavBar } from "@/components/bottom-nav-bar";

export default function HomeScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "kn">("en");
  const [selectedLevel, setSelectedLevel] = useState<"Easy" | "Medium" | "Advanced">("Medium");

  const initials = initialStudentProfile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top Header */}
          <View style={styles.topBar}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarInitials}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.greetingTitle}>
                  {lang === "en" ? "Namaskara," : "ನಮಸ್ಕಾರ,"}{" "}
                  <Text style={styles.studentNameHighlight}>
                    {lang === "en"
                      ? initialStudentProfile.name.split(" ")[0]
                      : initialStudentProfile.kannadaName.split(" ")[0]}
                  </Text>
                </Text>
                <View style={styles.idChip}>
                  <Text style={styles.idChipText}>
                    {initialStudentProfile.participantId}
                  </Text>
                </View>
              </View>
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
            {/* Sync Status Banner */}
            <View style={styles.syncCard}>
              <View style={styles.syncLeft}>
                <View style={styles.statusDot} />
                <Text style={styles.syncText}>
                  {lang === "en" ? "Offline-Ready" : "ಆಫ್‌ಲೈನ್ ಸಿದ್ಧ"} • {initialSyncStatus.totalLocalRecords} {lang === "en" ? "records synced" : "ದಾಖಲೆಗಳು ಸಿಂಕ್ ಆಗಿವೆ"}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/profile")}
                style={styles.syncAction}
              >
                <Text style={styles.syncActionText}>
                  {lang === "en" ? "Status" : "ವಿವರ"}
                </Text>
                <AppIcon name="chevron-forward" size={12} color="#0B3D2E" />
              </TouchableOpacity>
            </View>

            {/* Performance Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statBox}>
                <View style={styles.statIconRow}>
                  <AppIcon name="flame" size={15} color="#0B3D2E" />
                  <Text style={styles.statNum}>{initialStudentProfile.streakDays}</Text>
                </View>
                <Text style={styles.statLabel}>
                  {lang === "en" ? "Day Streak" : "ಅಭ್ಯಾಸ ಸರಣಿ"}
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statBox}>
                <View style={styles.statIconRow}>
                  <AppIcon name="check" size={15} color="#0B3D2E" />
                  <Text style={styles.statNum}>{initialStudentProfile.totalAssessments}</Text>
                </View>
                <Text style={styles.statLabel}>
                  {lang === "en" ? "Completed" : "ಪೂರ್ಣಗೊಂಡಿದೆ"}
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statBox}>
                <View style={styles.statIconRow}>
                  <AppIcon name="speed" size={15} color="#0B3D2E" />
                  <Text style={styles.statNum}>92%</Text>
                </View>
                <Text style={styles.statLabel}>
                  {lang === "en" ? "Avg Accuracy" : "ನಿಖರತೆ"}
                </Text>
              </View>
            </View>

            {/* Assessment Section Title */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionMainTitle}>
                {lang === "en" ? "Assessments" : "ಮೌಲ್ಯಮಾಪನಗಳು"}
              </Text>
              <Text style={styles.sectionTagline}>
                {lang === "en" ? "Bilingual AI Modules" : "ದ್ವಿಭಾಷಾ AI ಮಾಡ್ಯೂಲ್‌ಗಳು"}
              </Text>
            </View>

            {/* Level Selector */}
            <View style={styles.levelSegment}>
              {(["Easy", "Medium", "Advanced"] as const).map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  activeOpacity={0.8}
                  onPress={() => setSelectedLevel(lvl)}
                  style={[
                    styles.levelOption,
                    selectedLevel === lvl && styles.levelOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.levelOptionText,
                      selectedLevel === lvl && styles.levelOptionTextActive,
                    ]}
                  >
                    {lvl === "Easy"
                      ? lang === "en" ? "Easy" : "ಸುಲಭ"
                      : lvl === "Medium"
                      ? lang === "en" ? "Medium" : "ಮಧ್ಯಮ"
                      : lang === "en" ? "Advanced" : "ಕಠಿಣ"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reading Card */}
            <View style={styles.assessmentCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardIconWrap}>
                  <AppIcon name="mic" size={18} color="#0B3D2E" />
                </View>
                <View style={styles.cardHeaderInfo}>
                  <View style={styles.pillRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>Reading</Text>
                    </View>
                    <View style={styles.asrBadge}>
                      <Text style={styles.asrBadgeText}>Vosk TDNN ASR</Text>
                    </View>
                  </View>
                  <Text style={styles.cardHeading}>
                    {lang === "en"
                      ? "Oral Reading & Fluency"
                      : "ಮೌಖಿಕ ಓದುವಿಕೆ ಮತ್ತು ನಿರರ್ಗಳತೆ"}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardBodyText}>
                {lang === "en"
                  ? "Read aloud in English or Kannada. Real-time on-device ASR computes word alignment, WPM, and accuracy."
                  : "ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಗಟ್ಟಿಯಾಗಿ ಓದಿ. ಸಾಧನದ AI ನಿಖರತೆ ಮತ್ತು ವೇಗವನ್ನು ಅಳೆಯುತ್ತದೆ."}
              </Text>

              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>
                  {lang === "en" ? "Selected Passage:" : "ಆಯ್ದ ಭಾಗ:"}{" "}
                  <Text style={styles.previewBold}>
                    {lang === "en" ? "The Clever Crow" : "ಜಾಣ ಕಾಗೆ"} ({selectedLevel})
                  </Text>
                </Text>
                <Text style={styles.previewMeta}>
                  Last attempt: 94% Accuracy • 82 WPM
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/progress")}
                style={styles.cardPrimaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Start Reading Assessment"
              >
                <Text style={styles.cardPrimaryBtnText}>
                  {lang === "en" ? "Start Reading Assessment" : "ಓದುವ ಪರೀಕ್ಷೆ ಪ್ರಾರಂಭಿಸಿ"}
                </Text>
                <AppIcon name="chevron-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Writing Card */}
            <View style={styles.assessmentCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardIconWrap}>
                  <AppIcon name="pencil" size={18} color="#0B3D2E" />
                </View>
                <View style={styles.cardHeaderInfo}>
                  <View style={styles.pillRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>Writing</Text>
                    </View>
                    <View style={styles.asrBadge}>
                      <Text style={styles.asrBadgeText}>OCR + AI Evaluation</Text>
                    </View>
                  </View>
                  <Text style={styles.cardHeading}>
                    {lang === "en"
                      ? "Handwriting OCR & Grading"
                      : "ಕೈಬರಹದ OCR ಮತ್ತು ಮೌಲ್ಯಮಾಪನ"}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardBodyText}>
                {lang === "en"
                  ? "Capture your written answer via camera, gallery upload, or keyboard. Analyzes spelling, grammar, and vocabulary."
                  : "ಕ್ಯಾಮೆರಾ ಮೂಲಕ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ. ವ್ಯಾಕರಣ ಮತ್ತು ಕಾಗುಣಿತದ ವಿಶ್ಲೇಷಣೆ ಪಡೆಯಿರಿ."}
              </Text>

              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>
                  {lang === "en" ? "Today's Prompt:" : "ಇಂದಿನ ವಿಷಯ:"}
                </Text>
                <Text style={styles.promptText}>
                  "{lang === "en"
                    ? "Describe your favorite festival and how your family celebrates it."
                    : "ನಿಮ್ಮ ನೆಚ್ಚಿನ ಹಬ್ಬ ಮತ್ತು ಅದನ್ನು ನೀವು ಹೇಗೆ ಆಚರಿಸುತ್ತೀರಿ ಎಂಬುದನ್ನು ವಿವರಿಸಿ."}"
                </Text>
                <Text style={styles.previewMeta}>
                  Last score: 8.8 / 10 • 74 Words
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/progress")}
                style={styles.cardPrimaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Start Writing Assessment"
              >
                <Text style={styles.cardPrimaryBtnText}>
                  {lang === "en" ? "Start Writing Assessment" : "ಬರವಣಿಗೆ ಪರೀಕ್ಷೆ ಪ್ರಾರಂಭಿಸಿ"}
                </Text>
                <AppIcon name="chevron-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Recent History */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionMainTitle}>
                {lang === "en" ? "Recent Activity" : "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ"}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/progress")}
              >
                <Text style={styles.seeAllText}>
                  {lang === "en" ? "View All" : "ಎಲ್ಲವೂ"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.historyCard}>
              {mockReadingAttempts.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.langChip}>
                    <Text style={styles.langChipText}>
                      {item.language === "English" ? "EN" : "KN"}
                    </Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {lang === "en" ? item.title : item.kannadaTitle}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {item.date} • {item.level} • {item.wpm} WPM
                    </Text>
                  </View>
                  <View style={styles.historyScoreBlock}>
                    <Text style={styles.historyScoreNum}>{item.accuracy}%</Text>
                    <Text style={styles.historyScoreSub}>Accuracy</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Persistent Bottom Nav */}
          <BottomNavBar activeTab="home" />
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarInitials: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0B3D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  greetingTitle: {
    fontSize: 14,
    color: "#4E6D61",
    fontWeight: "500",
  },
  studentNameHighlight: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  idChip: {
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  idChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
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
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 12,
  },
  syncLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  syncText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#164A3D",
  },
  syncAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  syncActionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B877B",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2ECE6",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionMainTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  sectionTagline: {
    fontSize: 11.5,
    color: "#6B877B",
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  levelSegment: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    marginBottom: 14,
  },
  levelOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  levelOptionActive: {
    backgroundColor: "#EAF3EF",
  },
  levelOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#688478",
  },
  levelOptionTextActive: {
    color: "#0B3D2E",
    fontWeight: "700",
  },
  assessmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderInfo: {
    flex: 1,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  typeBadge: {
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  asrBadge: {
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  asrBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B877B",
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  cardBodyText: {
    fontSize: 12.5,
    color: "#4E6D61",
    lineHeight: 17,
    marginBottom: 10,
  },
  previewContainer: {
    backgroundColor: "#FAF6EF",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EBE5D8",
  },
  previewTitle: {
    fontSize: 11.5,
    color: "#688478",
  },
  previewBold: {
    fontWeight: "700",
    color: "#0B3D2E",
  },
  previewMeta: {
    fontSize: 11,
    color: "#0B3D2E",
    fontWeight: "600",
    marginTop: 2,
  },
  promptText: {
    fontSize: 12,
    color: "#164A3D",
    fontStyle: "italic",
    lineHeight: 16,
    marginVertical: 2,
  },
  cardPrimaryBtn: {
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0B3D2E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  cardPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2ECE6",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EFF5F1",
    gap: 10,
  },
  langChip: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  langChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  historyMeta: {
    fontSize: 11,
    color: "#688478",
    marginTop: 1,
  },
  historyScoreBlock: {
    alignItems: "flex-end",
  },
  historyScoreNum: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  historyScoreSub: {
    fontSize: 9.5,
    color: "#688478",
  },
});
