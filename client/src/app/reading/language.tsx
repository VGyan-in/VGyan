import React, { useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlowButton, FlowScreen, OptionCard, flowStyles } from "@/components/flow-ui";
import { AssessmentLanguage, Level, LEVELS } from "@/constants/content";
import { useApp } from "@/state/app-store";

export default function ReadingLanguageScreen() {
  const router = useRouter();
  const { lang } = useApp();
  const params = useLocalSearchParams<{ level?: string }>();
  const [language, setLanguage] = useState<AssessmentLanguage>(lang === "kn" ? "Kannada" : "English");

  const level: Level = LEVELS.includes(params.level as Level) ? (params.level as Level) : "Medium";

  return (
    <FlowScreen
      title={lang === "en" ? "Reading Assessment" : "ಓದುವ ಮೌಲ್ಯಮಾಪನ"}
      subtitle={lang === "en" ? "Step 1 of 4 • Language" : "ಹಂತ 1/4 • ಭಾಷೆ"}
      step={1}
      totalSteps={4}
      footer={
        <FlowButton
          label={lang === "en" ? "Continue" : "ಮುಂದುವರಿಸಿ"}
          icon="chevron-forward"
          onPress={() =>
            router.push({ pathname: "/reading/level", params: { language, level } })
          }
        />
      }
    >
      <Text style={[flowStyles.bodyText, { marginBottom: 14 }]}>
        {lang === "en"
          ? "Which language would you like to read in today?"
          : "ಇಂದು ನೀವು ಯಾವ ಭಾಷೆಯಲ್ಲಿ ಓದಲು ಬಯಸುತ್ತೀರಿ?"}
      </Text>

      <OptionCard
        title="English"
        subtitle={lang === "en" ? "Stories and passages in English" : "ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಕಥೆಗಳು"}
        icon="book"
        badge="EN"
        selected={language === "English"}
        onPress={() => setLanguage("English")}
      />
      <OptionCard
        title="ಕನ್ನಡ (Kannada)"
        subtitle={lang === "en" ? "Stories and passages in Kannada" : "ಕನ್ನಡದಲ್ಲಿ ಕಥೆಗಳು"}
        icon="book"
        badge="KN"
        selected={language === "Kannada"}
        onPress={() => setLanguage("Kannada")}
      />

      <Text style={[flowStyles.muted, { marginTop: 6 }]}>
        {lang === "en"
          ? "Speech recognition runs on this phone, so reading works without internet."
          : "ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಈ ಫೋನ್‌ನಲ್ಲೇ ನಡೆಯುತ್ತದೆ, ಇಂಟರ್ನೆಟ್ ಬೇಕಿಲ್ಲ."}
      </Text>
    </FlowScreen>
  );
}
