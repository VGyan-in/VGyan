import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import {
  initialStudentProfile,
  initialConsentState,
  initialSyncStatus,
} from "@/constants/mock-data";
import { BottomNavBar } from "@/components/bottom-nav-bar";

export default function ProfileScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "kn">("en");
  const [autoSyncWifi, setAutoSyncWifi] = useState(initialSyncStatus.autoSyncWifi);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const handleSyncNow = () => {
    setIsSyncing(true);
    setSyncSuccessMsg(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccessMsg(
        lang === "en"
          ? "All 18 records, 12 audio files, and 6 OCR samples synced."
          : "ಎಲ್ಲಾ ದಾಖಲೆಗಳು ಮತ್ತು ಆಡಿಯೋಗಳು ಯಶಸ್ವಿಯಾಗಿ ಸಿಂಕ್ ಆಗಿವೆ."
      );
      setTimeout(() => setSyncSuccessMsg(null), 3500);
    }, 1200);
  };

  const handleLogout = () => {
    router.replace("/login");
  };

  const initials = initialStudentProfile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.headerTitle}>
                {lang === "en" ? "Profile & Sync" : "ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸಿಂಕ್"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {lang === "en" ? "Phase 2 • Settings" : "ಹಂತ 2 • ಸೆಟ್ಟಿಂಗ್‌ಗಳು"}
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
            {/* Student ID Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileTopRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.profileMain}>
                  <Text style={styles.profileName}>
                    {lang === "en"
                      ? initialStudentProfile.name
                      : initialStudentProfile.kannadaName}
                  </Text>
                  <Text style={styles.profileSchool}>
                    {initialStudentProfile.school}
                  </Text>
                  <View style={styles.idChip}>
                    <Text style={styles.idChipText}>
                      ID: {initialStudentProfile.participantId}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Grade</Text>
                  <Text style={styles.metaValue}>
                    {initialStudentProfile.grade} - {initialStudentProfile.section}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Medium</Text>
                  <Text style={styles.metaValue}>Bilingual</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Native Lang</Text>
                  <Text style={styles.metaValue}>
                    {initialStudentProfile.nativeLanguage}
                  </Text>
                </View>
              </View>
            </View>

            {/* Research Consent Status */}
            <Text style={styles.sectionHeader}>
              {lang === "en" ? "Research Consent" : "ಸಂಶೋಧನಾ ಸಮ್ಮತಿ"}
            </Text>

            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.verifiedBadge}>
                  <AppIcon name="shield" size={13} color="#0B3D2E" />
                  <Text style={styles.verifiedBadgeText}>
                    {lang === "en" ? "Active (v1.0)" : "ಸಕ್ರಿಯವಾಗಿದೆ (v1.0)"}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push("/consent?viewOnly=true")}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkButtonText}>
                    {lang === "en" ? "View Agreement" : "ಪರಿಶೀಲಿಸಿ"}
                  </Text>
                  <AppIcon name="chevron-forward" size={11} color="#0B3D2E" />
                </TouchableOpacity>
              </View>

              <View style={styles.dataLines}>
                <View style={styles.dataLine}>
                  <Text style={styles.dataLabel}>Signer:</Text>
                  <Text style={styles.dataVal}>
                    {initialConsentState.signerName} ({initialConsentState.signerRelation})
                  </Text>
                </View>
                <View style={styles.dataLine}>
                  <Text style={styles.dataLabel}>Accepted:</Text>
                  <Text style={styles.dataVal}>01 Oct 2026 • Bilingual</Text>
                </View>
                <View style={styles.dataLine}>
                  <Text style={styles.dataLabel}>Data Scope:</Text>
                  <Text style={styles.dataVal}>16 kHz Audio • Handwriting OCR</Text>
                </View>
              </View>
            </View>

            {/* Offline & Cloud Sync Center */}
            <Text style={styles.sectionHeader}>
              {lang === "en" ? "Cloud Sync Center" : "ಸಿಂಕ್ ಕೇಂದ್ರ"}
            </Text>

            <View style={styles.card}>
              <View style={styles.syncStatusRow}>
                <View style={styles.syncIconWrap}>
                  <AppIcon
                    name={isSyncing ? "sync" : "cloud-check"}
                    size={18}
                    color="#0B3D2E"
                  />
                </View>
                <View style={styles.syncTextWrap}>
                  <Text style={styles.syncStatusHeading}>
                    {isSyncing
                      ? lang === "en" ? "Syncing in progress..." : "ಸಿಂಕ್ ಆಗುತ್ತಿದೆ..."
                      : lang === "en" ? "All Local Records Up to Date" : "ಎಲ್ಲಾ ದಾಖಲೆಗಳು ಸಿಂಕ್ ಆಗಿವೆ"}
                  </Text>
                  <Text style={styles.syncStatusSub}>
                    Last synced: {initialSyncStatus.lastSynced}
                  </Text>
                </View>
              </View>

              {syncSuccessMsg && (
                <View style={styles.toastSuccess}>
                  <AppIcon name="check" size={12} color="#0B3D2E" strokeWidth={2.5} />
                  <Text style={styles.toastSuccessText}>{syncSuccessMsg}</Text>
                </View>
              )}

              {/* Storage Counts */}
              <View style={styles.storageTriplet}>
                <View style={styles.storageBox}>
                  <Text style={styles.storageDigit}>
                    {initialSyncStatus.totalLocalRecords}
                  </Text>
                  <Text style={styles.storageName}>SQLite Records</Text>
                </View>
                <View style={styles.storageBox}>
                  <Text style={styles.storageDigit}>
                    {initialSyncStatus.audioFilesCount}
                  </Text>
                  <Text style={styles.storageName}>
                    WAVs ({initialSyncStatus.audioStorageSizeMb}MB)
                  </Text>
                </View>
                <View style={styles.storageBox}>
                  <Text style={styles.storageDigit}>
                    {initialSyncStatus.imagesCount}
                  </Text>
                  <Text style={styles.storageName}>
                    OCR ({initialSyncStatus.imagesStorageSizeMb}MB)
                  </Text>
                </View>
              </View>

              {/* Wi-Fi Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>
                    {lang === "en" ? "Auto-Sync on Wi-Fi" : "ವೈ-ಫೈ ಸಂಪರ್ಕದಲ್ಲಿ ಸ್ವಯಂ ಸಿಂಕ್"}
                  </Text>
                  <Text style={styles.switchDesc}>
                    {lang === "en"
                      ? "Upload recordings automatically when network is available"
                      : "ನೆಟ್‌ವರ್ಕ್ ಲಭ್ಯವಿದ್ದಾಗ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ"}
                  </Text>
                </View>
                <Switch
                  value={autoSyncWifi}
                  onValueChange={setAutoSyncWifi}
                  trackColor={{ false: "#DCE9E2", true: "#0B3D2E" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSyncNow}
                disabled={isSyncing}
                style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Sync now"
              >
                {isSyncing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <AppIcon name="sync" size={15} color="#FFFFFF" />
                    <Text style={styles.syncBtnText}>
                      {lang === "en" ? "Sync Now" : "ಈಗಲೇ ಸಿಂಕ್ ಮಾಡಿ"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Speech Models Diagnostic */}
            <Text style={styles.sectionHeader}>
              {lang === "en" ? "On-Device Engine Diagnostics" : "ಸಾಧನದ ಇಂಜಿನ್ ಸ್ಥಿತಿ"}
            </Text>

            <View style={styles.card}>
              <View style={styles.engineLine}>
                <Text style={styles.engineText}>Vosk TDNN English Model</Text>
                <View style={styles.engineBadge}>
                  <Text style={styles.engineBadgeText}>v0.22 Ready</Text>
                </View>
              </View>
              <View style={styles.lineDivider} />
              <View style={styles.engineLine}>
                <Text style={styles.engineText}>Vosk TDNN Kannada Model</Text>
                <View style={styles.engineBadge}>
                  <Text style={styles.engineBadgeText}>v0.1 Ready</Text>
                </View>
              </View>
              <View style={styles.lineDivider} />
              <View style={styles.engineLine}>
                <Text style={styles.engineText}>Gemini Qualitative AI</Text>
                <View style={styles.engineBadge}>
                  <Text style={styles.engineBadgeText}>Connected</Text>
                </View>
              </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleLogout}
              style={styles.logoutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <AppIcon name="logout" size={15} color="#B91C1C" />
              <Text style={styles.logoutBtnText}>
                {lang === "en" ? "Sign Out" : "ಸೈನ್ ಔಟ್ ಮಾಡಿ"}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Persistent Bottom Nav */}
          <BottomNavBar activeTab="profile" />
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
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0B3D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  profileMain: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  profileSchool: {
    fontSize: 11.5,
    color: "#688478",
    marginTop: 1,
  },
  idChip: {
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  idChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  metaRow: {
    flexDirection: "row",
    backgroundColor: "#FAF6EF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EBE5D8",
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: "#688478",
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B3D2E",
    marginTop: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B3D2E",
    marginBottom: 6,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkButtonText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  dataLines: {
    gap: 6,
  },
  dataLine: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dataLabel: {
    fontSize: 11.5,
    color: "#688478",
  },
  dataVal: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#164A3D",
    flex: 1,
    textAlign: "right",
    marginLeft: 6,
  },
  syncStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  syncIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  syncTextWrap: {
    flex: 1,
  },
  syncStatusHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  syncStatusSub: {
    fontSize: 11,
    color: "#688478",
    marginTop: 1,
  },
  toastSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3EF",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  toastSuccessText: {
    fontSize: 11,
    color: "#0B3D2E",
    fontWeight: "600",
    flex: 1,
  },
  storageTriplet: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  storageBox: {
    flex: 1,
    backgroundColor: "#FAF6EF",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EBE5D8",
  },
  storageDigit: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  storageName: {
    fontSize: 9.5,
    color: "#688478",
    marginTop: 2,
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EFF5F1",
    marginBottom: 10,
  },
  switchTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#164A3D",
  },
  switchDesc: {
    fontSize: 10.5,
    color: "#688478",
    marginTop: 1,
  },
  syncBtn: {
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0B3D2E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  syncBtnDisabled: {
    opacity: 0.7,
  },
  syncBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  engineLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  engineText: {
    fontSize: 12,
    color: "#164A3D",
    fontWeight: "500",
  },
  engineBadge: {
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  engineBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  lineDivider: {
    height: 1,
    backgroundColor: "#EFF5F1",
    marginVertical: 8,
  },
  logoutBtn: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  logoutBtnText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
  },
});
