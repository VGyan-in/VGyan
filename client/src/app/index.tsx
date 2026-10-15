import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { AppIcon, IconName } from "@/components/ui/app-icon";
import { useApp, useEntryRoute } from "@/state/app-store";

const INK = "#0B3D2E";
const BODY = "#3F5F53";
const MUTED = "#6B877B";
const LINE = "#E2ECE6";
const CREAM = "#FAF6EF";

/** One line of a sample passage, marked up the way the reading result screen shows it. */
const SAMPLE: { w: string; s?: "changed" | "skipped"; said?: string }[] = [
  { w: "The" },
  { w: "thirsty" },
  { w: "crow" },
  { w: "saw" },
  { w: "a" },
  { w: "pitcher", s: "changed", said: "picture" },
  { w: "under" },
  { w: "the", s: "skipped" },
  { w: "tree." },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { lang, toggleLang } = useApp();
  const entryRoute = useEntryRoute();
  const en = lang === "en";

  // Signed-in students skip the landing page.
  if (entryRoute) return <Redirect href={entryRoute} />;

  const points: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "mic",
      title: en ? "Read aloud" : "ಗಟ್ಟಿಯಾಗಿ ಓದಿ",
      body: en
        ? "See which words you read well and which to practise."
        : "ಯಾವ ಪದಗಳು ಸರಿ, ಯಾವುದನ್ನು ಅಭ್ಯಾಸ ಮಾಡಬೇಕು ಎಂದು ನೋಡಿ.",
    },
    {
      icon: "pencil",
      title: en ? "Write on paper or type" : "ಕಾಗದದಲ್ಲಿ ಬರೆಯಿರಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ",
      body: en
        ? "Snap a photo of your page and get feedback on it."
        : "ನಿಮ್ಮ ಪುಟದ ಫೋಟೋ ತೆಗೆದು ಪ್ರತಿಕ್ರಿಯೆ ಪಡೆಯಿರಿ.",
    },
    {
      icon: "cloud-check",
      title: en ? "Works without internet" : "ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆಯೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
      body: en
        ? "Your work is saved on the phone and sent to your teacher later."
        : "ನಿಮ್ಮ ಕೆಲಸ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಯುತ್ತದೆ, ನಂತರ ಶಿಕ್ಷಕರಿಗೆ ಹೋಗುತ್ತದೆ.",
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <Image
                source={require("@/assets/images/vgyan_logo.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="VGyan"
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleLang}
              style={styles.langPill}
              accessibilityRole="button"
              accessibilityLabel="Switch language"
            >
              <AppIcon name="globe" size={13} color={INK} />
              <Text style={styles.langPillText}>{en ? "ಕನ್ನಡ" : "English"}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.headline}>
              {en ? "Practise reading and writing in English and Kannada." : "ಇಂಗ್ಲಿಷ್ ಮತ್ತು ಕನ್ನಡದಲ್ಲಿ ಓದು-ಬರಹ ಅಭ್ಯಾಸ ಮಾಡಿ."}
            </Text>
            <Text style={styles.subhead}>
              {en ? "ಓದಿ · ಬರೆಯಿರಿ · ಕಲಿಯಿರಿ" : "Read · Write · Learn"}
            </Text>

            {/* What a reading check looks like */}
            <View style={styles.sampleCard}>
              <View style={styles.sampleHeader}>
                <Text style={styles.sampleLabel}>
                  {en ? "After you read" : "ನೀವು ಓದಿದ ನಂತರ"}
                </Text>
                <Text style={styles.sampleScore}>
                  78<Text style={styles.sampleScoreUnit}>%</Text>
                </Text>
              </View>
              <Text style={styles.sampleText}>
                {SAMPLE.map((t, i) => (
                  <Text key={i}>
                    {i > 0 ? " " : ""}
                    <Text
                      style={
                        t.s === "changed"
                          ? styles.wordChanged
                          : t.s === "skipped"
                          ? styles.wordSkipped
                          : undefined
                      }
                    >
                      {t.w}
                    </Text>
                    {t.said ? <Text style={styles.wordSaid}> ({t.said})</Text> : null}
                  </Text>
                ))}
              </Text>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#D97706" }]} />
                  <Text style={styles.legendText}>{en ? "said differently" : "ಬೇರೆ ರೀತಿ ಹೇಳಿದ್ದು"}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                  <Text style={styles.legendText}>{en ? "skipped" : "ಬಿಟ್ಟದ್ದು"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.points}>
              {points.map((p) => (
                <View key={p.title} style={styles.point}>
                  <View style={styles.pointIcon}>
                    <AppIcon name={p.icon} size={16} color={INK} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pointTitle}>{p.title}</Text>
                    <Text style={styles.pointBody}>{p.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/register")}
              style={styles.primaryButton}
              accessibilityRole="button"
              accessibilityLabel="Create an account"
            >
              <Text style={styles.primaryButtonText}>
                {en ? "Get Started" : "ಪ್ರಾರಂಭಿಸಿ"}
              </Text>
              <AppIcon name="chevron-forward" size={16} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/login")}
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.secondaryText}>
                {en ? "I already have an account. " : "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆ. "}
                <Text style={styles.secondaryLink}>{en ? "Sign in" : "ಸೈನ್ ಇನ್"}</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  screenWrapper: {
    width: "100%",
    height: "100%",
    maxWidth: 480,
    backgroundColor: CREAM,
  },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? 14 : 8,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 56, height: 56 },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5E3DB",
    backgroundColor: "#FFFFFF",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  langPillText: { fontSize: 12.5, fontWeight: "700", color: INK },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  headline: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.4,
  },
  subhead: { fontSize: 15, color: MUTED, marginTop: 8, fontWeight: "600" },
  sampleCard: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  sampleHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sampleLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sampleScore: { fontSize: 22, fontWeight: "800", color: INK },
  sampleScoreUnit: { fontSize: 14, fontWeight: "700", color: MUTED },
  sampleText: { fontSize: 17, lineHeight: 28, color: "#1C3A30" },
  wordChanged: { color: "#B45309", backgroundColor: "#FEF3C7", fontWeight: "700" },
  wordSkipped: {
    color: "#DC2626",
    backgroundColor: "#FDECEC",
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  wordSaid: { fontSize: 12.5, color: "#B45309" },
  legend: { flexDirection: "row", gap: 16, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: MUTED },
  points: { marginTop: 22, gap: 16 },
  point: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  pointTitle: { fontSize: 15, fontWeight: "700", color: INK },
  pointBody: { fontSize: 13, lineHeight: 19, color: BODY, marginTop: 2 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 8 : 18,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: CREAM,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryButton: { alignItems: "center", paddingVertical: 12 },
  secondaryText: { fontSize: 13.5, color: BODY },
  secondaryLink: { fontWeight: "800", color: INK, textDecorationLine: "underline" },
});
