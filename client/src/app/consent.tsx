import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import { initialStudentProfile } from "@/constants/mock-data";

export default function ConsentGateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isViewOnly = params.viewOnly === "true";

  const [lang, setLang] = useState<"en" | "kn">("en");
  const [signerRole, setSignerRole] = useState<"guardian" | "student">("guardian");
  const [signerName, setSignerName] = useState(
    signerRole === "guardian" ? "Ramesh Sharma" : initialStudentProfile.name
  );
  const [relationship, setRelationship] = useState("Father");

  const [consentStudy, setConsentStudy] = useState(true);
  const [consentAudioWriting, setConsentAudioWriting] = useState(true);
  const [consentAccuracy, setConsentAccuracy] = useState(true);

  const isFormValid =
    consentStudy &&
    consentAudioWriting &&
    consentAccuracy &&
    signerName.trim().length > 1;

  const handleAcceptConsent = () => {
    if (!isFormValid) {
      const msg =
        lang === "en"
          ? "Please complete all checkboxes and enter your signature name to proceed."
          : "ಮುಂದುವರಿಯಲು ದಯವಿಟ್ಟು ಎಲ್ಲಾ ಸಮ್ಮತಿ ಪೆಟ್ಟಿಗೆಗಳನ್ನು ಗುರುತಿಸಿ ಮತ್ತು ಹೆಸರನ್ನು ನಮೂದಿಸಿ.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Incomplete Consent", msg);
      }
      return;
    }

    router.replace("/home");
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/login");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <AppIcon name="arrow-back" size={18} color="#0B3D2E" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.navHeaderTitle}>
                {lang === "en" ? "Research Consent" : "ಸಂಶೋಧನಾ ಸಮ್ಮತಿ"}
              </Text>
              <Text style={styles.navHeaderSub}>
                {lang === "en" ? "Phase 1 • Gate" : "ಹಂತ 1 • ಪ್ರವೇಶ"}
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
            {/* Institution Header */}
            <View style={styles.studyBanner}>
              <View style={styles.studyBadge}>
                <AppIcon name="shield" size={12} color="#0B3D2E" />
                <Text style={styles.studyBadgeText}>IIIT-Delhi Study</Text>
              </View>
              <Text style={styles.versionTag}>Protocol v1.0</Text>
            </View>

            <Text style={styles.screenTitle}>
              {lang === "en"
                ? "Bilingual Assessment Consent"
                : "ದ್ವಿಭಾಷಾ ಮೌಲ್ಯಮಾಪನ ಸಮ್ಮತಿ ಪತ್ರ"}
            </Text>
            <Text style={styles.screenSubtitle}>
              {lang === "en"
                ? "This research study evaluates on-device reading fluency and handwriting assessment. Please review and acknowledge the terms below."
                : "ಈ ಸಂಶೋಧನೆಯು ಓದುವ ನಿರರ್ಗಳತೆ ಮತ್ತು ಬರವಣಿಗೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡುತ್ತದೆ. ದಯವಿಟ್ಟು ನಿಯಮಗಳನ್ನು ಪರಿಶೀಲಿಸಿ."}
            </Text>

            {/* Participant Identification Card */}
            <View style={styles.idCard}>
              <View style={styles.idCardLeft}>
                <Text style={styles.idCardLabel}>
                  {lang === "en" ? "RESEARCH PARTICIPANT ID" : "ಸಂಶೋಧನಾ ಭಾಗವಹಿಸುವವರ ಐಡಿ"}
                </Text>
                <Text style={styles.idCardCode}>
                  {initialStudentProfile.participantId}
                </Text>
                <Text style={styles.idCardStudent}>
                  {initialStudentProfile.name} • {initialStudentProfile.grade} ({initialStudentProfile.school})
                </Text>
              </View>
              <View style={styles.idLockIcon}>
                <AppIcon name="lock" size={16} color="#0B3D2E" />
              </View>
            </View>

            {/* Signer Selector */}
            <Text style={styles.sectionHeading}>
              {lang === "en" ? "Consenting Party" : "ಸಮ್ಮತಿ ನೀಡುವವರು"}
            </Text>
            <View style={styles.roleSegment}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSignerRole("guardian");
                  setSignerName("Ramesh Sharma");
                  setRelationship("Father");
                }}
                style={[
                  styles.roleOption,
                  signerRole === "guardian" && styles.roleOptionActive,
                ]}
              >
                <AppIcon
                  name="people"
                  size={16}
                  color={signerRole === "guardian" ? "#0B3D2E" : "#688478"}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    signerRole === "guardian" && styles.roleOptionTextActive,
                  ]}
                >
                  {lang === "en" ? "Parent / Guardian" : "ಪೋಷಕರು / ರಕ್ಷಕರು"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSignerRole("student");
                  setSignerName(initialStudentProfile.name);
                  setRelationship("Self");
                }}
                style={[
                  styles.roleOption,
                  signerRole === "student" && styles.roleOptionActive,
                ]}
              >
                <AppIcon
                  name="school"
                  size={16}
                  color={signerRole === "student" ? "#0B3D2E" : "#688478"}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    signerRole === "student" && styles.roleOptionTextActive,
                  ]}
                >
                  {lang === "en" ? "Student (Self)" : "ವಿದ್ಯಾರ್ಥಿ (ಸ್ವಯಂ)"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Signer Details Form */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                {signerRole === "guardian"
                  ? lang === "en"
                    ? "Guardian Full Name"
                    : "ಪೋಷಕರ ಪೂರ್ಣ ಹೆಸರು"
                  : lang === "en"
                  ? "Student Full Name"
                  : "ವಿದ್ಯಾರ್ಥಿಯ ಪೂರ್ಣ ಹೆಸರು"}
              </Text>
              <TextInput
                style={styles.textInput}
                value={signerName}
                onChangeText={setSignerName}
                placeholder="Enter full name"
                placeholderTextColor="#94A89F"
              />

              {signerRole === "guardian" && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                    {lang === "en" ? "Relationship to Student" : "ವಿದ್ಯಾರ್ಥಿಯೊಂದಿಗೆ ಸಂಬಂಧ"}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={relationship}
                    onChangeText={setRelationship}
                    placeholder="e.g. Father, Mother, Legal Guardian"
                    placeholderTextColor="#94A89F"
                  />
                </>
              )}
            </View>

            {/* Research Terms Breakdown */}
            <Text style={styles.sectionHeading}>
              {lang === "en" ? "Research & Data Privacy" : "ಸಂಶೋಧನೆ ಮತ್ತು ಡೇಟಾ ಗೌಪ್ಯತೆ"}
            </Text>

            <View style={styles.disclosuresContainer}>
              {/* Item 1: Audio */}
              <View style={styles.disclosureRow}>
                <View style={styles.disclosureIconBox}>
                  <AppIcon name="mic" size={16} color="#0B3D2E" />
                </View>
                <View style={styles.disclosureTextBox}>
                  <Text style={styles.disclosureTitle}>
                    {lang === "en"
                      ? "16 kHz Oral Reading Audio & Local ASR"
                      : "16 kHz ಆಡಿಯೋ ಮತ್ತು ಸಾಧನದಲ್ಲಿನ ASR"}
                  </Text>
                  <Text style={styles.disclosureBody}>
                    {lang === "en"
                      ? "Passage readings are evaluated for WPM and accuracy using on-device models. Audio is securely stored for research calibration."
                      : "ಸಾಧನದಲ್ಲಿನ ಮಾದರಿಯನ್ನು ಬಳಸಿ ಓದುವ ವೇಗ ಮತ್ತು ನಿಖರತೆಯನ್ನು ಅಳೆಯಲಾಗುತ್ತದೆ."}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Item 2: Writing */}
              <View style={styles.disclosureRow}>
                <View style={styles.disclosureIconBox}>
                  <AppIcon name="doc" size={16} color="#0B3D2E" />
                </View>
                <View style={styles.disclosureTextBox}>
                  <Text style={styles.disclosureTitle}>
                    {lang === "en"
                      ? "Handwriting Image Capture & OCR"
                      : "ಕೈಬರಹದ ಚಿತ್ರ ಮತ್ತು OCR ವಿಶ್ಲೇಷಣೆ"}
                  </Text>
                  <Text style={styles.disclosureBody}>
                    {lang === "en"
                      ? "Written samples (camera or text) are processed for vocabulary, syntax, and spelling metrics. Original images are preserved."
                      : "ಕೈಬರಹದ ಚಿತ್ರಗಳನ್ನು ವ್ಯಾಕರಣ ಮತ್ತು ಕಾಗುಣಿತದ ವಿಶ್ಲೇಷಣೆಗಾಗಿ ಬಳಸಲಾಗುತ್ತದೆ."}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Item 3: Privacy */}
              <View style={styles.disclosureRow}>
                <View style={styles.disclosureIconBox}>
                  <AppIcon name="shield" size={16} color="#0B3D2E" />
                </View>
                <View style={styles.disclosureTextBox}>
                  <Text style={styles.disclosureTitle}>
                    {lang === "en"
                      ? "Anonymization & Zero Data Sale"
                      : "ಅನಾಮಧೇಯತೆ ಮತ್ತು ಗೌಪ್ಯತೆಯ ಭರವಸೆ"}
                  </Text>
                  <Text style={styles.disclosureBody}>
                    {lang === "en"
                      ? "All metrics are linked solely to the Participant ID. No student names or private identifying data are disclosed or sold."
                      : "ಎಲ್ಲಾ ಡೇಟಾವನ್ನು ಕೇವಲ ಅನಾಮಧೇಯ ಸಂಶೋಧನಾ ಐಡಿಯೊಂದಿಗೆ ಜೋಡಿಸಲಾಗುತ್ತದೆ."}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Item 4: Rights */}
              <View style={styles.disclosureRow}>
                <View style={styles.disclosureIconBox}>
                  <AppIcon name="check" size={16} color="#0B3D2E" />
                </View>
                <View style={styles.disclosureTextBox}>
                  <Text style={styles.disclosureTitle}>
                    {lang === "en"
                      ? "Voluntary Participation"
                      : "ಸ್ವಯಂಪ್ರೇರಿತ ಭಾಗವಹಿಸುವಿಕೆ"}
                  </Text>
                  <Text style={styles.disclosureBody}>
                    {lang === "en"
                      ? "Participation is optional. You may request data deletion or withdraw at any time without academic consequence."
                      : "ಭಾಗವಹಿಸುವಿಕೆ ಐಚ್ಛಿಕವಾಗಿದೆ. ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ಡೇಟಾ ಅಳಿಸಲು ವಿನಂತಿಸಬಹುದು."}
                  </Text>
                </View>
              </View>
            </View>

            {/* Clauses Checkboxes */}
            <Text style={styles.sectionHeading}>
              {lang === "en" ? "Consent Acknowledgments" : "ಸಮ್ಮತಿ ದೃಢೀಕರಣಗಳು"}
            </Text>

            <View style={styles.checkboxesCard}>
              {/* Check 1 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConsentStudy(!consentStudy)}
                style={styles.checkboxLine}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    consentStudy && styles.checkboxBoxChecked,
                  ]}
                >
                  {consentStudy && (
                    <AppIcon name="check" size={12} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  {lang === "en"
                    ? "I agree to participate in the VGyan bilingual reading & writing assessment research study."
                    : "ನಾನು VGyan ದ್ವಿಭಾಷಾ ಸಂಶೋಧನಾ ಅಧ್ಯಯನದಲ್ಲಿ ಭಾಗವಹಿಸಲು ಸಮ್ಮತಿಸುತ್ತೇನೆ."}
                </Text>
              </TouchableOpacity>

              {/* Check 2 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConsentAudioWriting(!consentAudioWriting)}
                style={styles.checkboxLine}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    consentAudioWriting && styles.checkboxBoxChecked,
                  ]}
                >
                  {consentAudioWriting && (
                    <AppIcon name="check" size={12} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  {lang === "en"
                    ? "I authorize audio recording and handwriting sample analysis for evaluation and research."
                    : "ಮೌಲ್ಯಮಾಪನಕ್ಕಾಗಿ ಆಡಿಯೊ ರೆಕಾರ್ಡಿಂಗ್ ಮತ್ತು ಕೈಬರಹದ ಚಿತ್ರಗಳ ಸಂಗ್ರಹಣೆಗೆ ನಾನು ಸಮ್ಮತಿಸುತ್ತೇನೆ."}
                </Text>
              </TouchableOpacity>

              {/* Check 3 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConsentAccuracy(!consentAccuracy)}
                style={styles.checkboxLine}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    consentAccuracy && styles.checkboxBoxChecked,
                  ]}
                >
                  {consentAccuracy && (
                    <AppIcon name="check" size={12} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  {lang === "en"
                    ? "I confirm that the consenting details provided above are accurate and authorized."
                    : "ಮೇಲೆ ನೀಡಲಾದ ವಿವರಗಳು ನಿಖರ ಮತ್ತು ದೃಢೀಕೃತವಾಗಿವೆ ಎಂದು ನಾನು ಖಚಿತಪಡಿಸುತ್ತೇನೆ."}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.actionBlock}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleAcceptConsent}
                style={[
                  styles.primaryButton,
                  !isFormValid && styles.primaryButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Agree and proceed"
              >
                <Text style={styles.primaryButtonText}>
                  {lang === "en"
                    ? "Accept & Continue to Home"
                    : "ಒಪ್ಪಿಕೊಳ್ಳಿ ಮತ್ತು ಮುಂದುವರಿಯಿರಿ"}
                </Text>
                <AppIcon name="chevron-forward" size={15} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.replace("/login")}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Decline and return"
              >
                <Text style={styles.secondaryButtonText}>
                  {lang === "en"
                    ? "Decline & Return to Sign In"
                    : "ತಿರಸ್ಕರಿಸಿ ಮತ್ತು ಹಿಂತಿರುಗಿ"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    width: "100%",
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5EEE9",
    backgroundColor: "#FAF6EF",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE9E2",
  },
  headerCenter: {
    alignItems: "center",
  },
  navHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  navHeaderSub: {
    fontSize: 11,
    color: "#6B877B",
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
    paddingTop: 16,
    paddingBottom: 36,
  },
  studyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  studyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3EF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  studyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  versionTag: {
    fontSize: 11,
    color: "#6B877B",
    fontWeight: "600",
  },
  screenTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0B3D2E",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: "#4E6D61",
    lineHeight: 18,
    marginBottom: 16,
  },
  idCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    marginBottom: 18,
  },
  idCardLeft: {
    flex: 1,
  },
  idCardLabel: {
    fontSize: 10,
    color: "#6B877B",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  idCardCode: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B3D2E",
    marginVertical: 2,
    letterSpacing: 0.5,
  },
  idCardStudent: {
    fontSize: 11.5,
    color: "#4E6D61",
  },
  idLockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0B3D2E",
    marginBottom: 8,
  },
  roleSegment: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    marginBottom: 14,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  roleOptionActive: {
    backgroundColor: "#EAF3EF",
  },
  roleOptionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#688478",
  },
  roleOptionTextActive: {
    color: "#0B3D2E",
    fontWeight: "700",
  },
  formGroup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#164A3D",
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: "#FAF6EF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13.5,
    color: "#0F2F24",
  },
  disclosuresContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 18,
  },
  disclosureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  disclosureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  disclosureTextBox: {
    flex: 1,
  },
  disclosureTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B3D2E",
    marginBottom: 2,
  },
  disclosureBody: {
    fontSize: 11.5,
    color: "#527064",
    lineHeight: 16,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#EFF5F1",
    marginVertical: 10,
  },
  checkboxesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    marginBottom: 18,
    gap: 12,
  },
  checkboxLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#A3BEB2",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: "#0B3D2E",
    borderColor: "#0B3D2E",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: "#164A3D",
    lineHeight: 17,
    fontWeight: "500",
  },
  actionBlock: {
    gap: 10,
  },
  primaryButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0B3D2E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  primaryButtonDisabled: {
    backgroundColor: "#8AA499",
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  secondaryButtonText: {
    color: "#6B877B",
    fontSize: 12.5,
    fontWeight: "600",
  },
});
