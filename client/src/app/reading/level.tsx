import React, { useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlowButton, FlowScreen, OptionCard, flowStyles } from "@/components/flow-ui";
import {
  AssessmentLanguage,
  Level,
  LEVELS,
  findPassage,
  languageLabel,
  levelLabel,
} from "@/constants/content";
import { tokenize } from "@/features/reading/analyzer";
import { useApp } from "@/state/app-store";

const LEVEL_HINTS: Record<Level, { en: string; kn: string }> = {
  Easy: { en: "Short sentences, familiar words", kn: "ಚಿಕ್ಕ ವಾಕ್ಯಗಳು, ಪರಿಚಿತ ಪದಗಳು" },
  Medium: { en: "A short story with new words", kn: "ಹೊಸ ಪದಗಳಿರುವ ಸಣ್ಣ ಕಥೆ" },
  Advanced: { en: "Longer passage, richer vocabulary", kn: "ದೀರ್ಘ ಭಾಗ, ಹೆಚ್ಚಿನ ಶಬ್ದಕೋಶ" },
};

export default function ReadingLevelScreen() {
  const router = useRouter();
  const { lang } = useApp();
  const params = useLocalSearchParams<{ language?: string; level?: string }>();
  const language: AssessmentLanguage = params.language === "Kannada" ? "Kannada" : "English";
  const [level, setLevel] = useState<Level>(
    LEVELS.includes(params.level as Level) ? (params.level as Level) : "Medium"
  );

  const passage = findPassage(language, level);

  return (
    <FlowScreen
      title={lang === "en" ? "Choose a Level" : "ಹಂತ ಆಯ್ಕೆಮಾಡಿ"}
      subtitle={`${lang === "en" ? "Step 2 of 4" : "ಹಂತ 2/4"} • ${languageLabel(language, lang)}`}
      step={2}
      totalSteps={4}
      footer={
        <FlowButton
          label={lang === "en" ? "Show Passage" : "ಭಾಗ ತೋರಿಸಿ"}
          icon="chevron-forward"
          onPress={() =>
            router.push({ pathname: "/reading/passage", params: { passageId: passage.id } })
          }
        />
      }
    >
      <Text style={[flowStyles.bodyText, { marginBottom: 14 }]}>
        {lang === "en"
          ? "Pick the level that feels right. You can try another level any time."
          : "ನಿಮಗೆ ಸೂಕ್ತವಾದ ಹಂತವನ್ನು ಆರಿಸಿ. ಯಾವಾಗ ಬೇಕಾದರೂ ಬೇರೆ ಹಂತ ಪ್ರಯತ್ನಿಸಬಹುದು."}
      </Text>

      {LEVELS.map((l) => {
        const p = findPassage(language, l);
        return (
          <OptionCard
            key={l}
            title={levelLabel(l, lang)}
            subtitle={`${LEVEL_HINTS[l][lang]}\n${lang === "en" ? p.title : p.kannadaTitle} • ${tokenize(p.text).length} ${lang === "en" ? "words" : "ಪದಗಳು"}`}
            selected={level === l}
            onPress={() => setLevel(l)}
          />
        );
      })}
    </FlowScreen>
  );
}
