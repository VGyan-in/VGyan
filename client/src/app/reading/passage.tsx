import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import { C, Card, FlowButton, FlowScreen, flowStyles } from "@/components/flow-ui";
import { getPassage, languageLabel, levelLabel } from "@/constants/content";
import { tokenize } from "@/features/reading/analyzer";
import { useApp } from "@/state/app-store";

export default function ReadingPassageScreen() {
  const router = useRouter();
  const { lang } = useApp();
  const { passageId } = useLocalSearchParams<{ passageId?: string }>();
  const passage = getPassage(passageId);

  if (!passage) return <Redirect href="/reading/language" />;

  const tips =
    lang === "en"
      ? [
          "Sit in a quiet place and hold the phone about 20 cm away.",
          "Read the whole passage aloud at your normal speed.",
          "If you make a mistake, just keep reading.",
        ]
      : [
          "ಶಾಂತವಾದ ಸ್ಥಳದಲ್ಲಿ ಕುಳಿತು ಫೋನ್ ಅನ್ನು ಸುಮಾರು 20 ಸೆಂ.ಮೀ ದೂರದಲ್ಲಿ ಹಿಡಿಯಿರಿ.",
          "ಸಂಪೂರ್ಣ ಭಾಗವನ್ನು ನಿಮ್ಮ ಸಾಮಾನ್ಯ ವೇಗದಲ್ಲಿ ಗಟ್ಟಿಯಾಗಿ ಓದಿ.",
          "ತಪ್ಪಾದರೂ ಓದುವುದನ್ನು ಮುಂದುವರಿಸಿ.",
        ];

  return (
    <FlowScreen
      title={lang === "en" ? passage.title : passage.kannadaTitle}
      subtitle={`${lang === "en" ? "Step 3 of 4" : "ಹಂತ 3/4"} • ${languageLabel(passage.language, lang)} • ${levelLabel(passage.level, lang)}`}
      step={3}
      totalSteps={4}
      footer={
        <FlowButton
          label={lang === "en" ? "I'm Ready – Start Recording" : "ಸಿದ್ಧ – ರೆಕಾರ್ಡಿಂಗ್ ಪ್ರಾರಂಭಿಸಿ"}
          icon="mic"
          onPress={() =>
            router.push({ pathname: "/reading/recording", params: { passageId: passage.id } })
          }
        />
      }
    >
      <Card>
        <View style={styles.metaRow}>
          <AppIcon name="book" size={14} color={C.muted} />
          <Text style={flowStyles.muted}>
            {tokenize(passage.text).length} {lang === "en" ? "words" : "ಪದಗಳು"} •{" "}
            {lang === "en" ? "Read it once silently first" : "ಮೊದಲು ಮನಸ್ಸಿನಲ್ಲಿ ಓದಿ"}
          </Text>
        </View>
        <Text style={styles.passageText}>{passage.text}</Text>
      </Card>

      <Card style={{ backgroundColor: C.mint, borderColor: "#D3E5DB" }}>
        <Text style={styles.tipsTitle}>{lang === "en" ? "Before you start" : "ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು"}</Text>
        {tips.map((t, i) => (
          <View key={i} style={styles.tipRow}>
            <AppIcon name="check" size={13} color={C.forest} />
            <Text style={styles.tipText}>{t}</Text>
          </View>
        ))}
      </Card>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  passageText: { fontSize: 18, lineHeight: 30, color: "#1C3A30", fontWeight: "500" },
  tipsTitle: { fontSize: 13.5, fontWeight: "800", color: C.forest, marginBottom: 8 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  tipText: { flex: 1, fontSize: 12.5, color: "#164A3D", lineHeight: 17 },
});
