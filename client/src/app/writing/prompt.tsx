import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { C, FlowButton, FlowScreen, OptionCard, flowStyles } from "@/components/flow-ui";
import { AssessmentLanguage, WRITING_PROMPTS, languageLabel } from "@/constants/content";
import { useApp } from "@/state/app-store";

export default function WritingPromptScreen() {
  const router = useRouter();
  const { lang, setWritingDraft } = useApp();
  const [language, setLanguage] = useState<AssessmentLanguage>(lang === "kn" ? "Kannada" : "English");
  const prompts = WRITING_PROMPTS.filter((p) => p.language === language);
  const [promptId, setPromptId] = useState(prompts[0].id);

  const chooseLanguage = (l: AssessmentLanguage) => {
    setLanguage(l);
    setPromptId(WRITING_PROMPTS.find((p) => p.language === l)!.id);
  };

  const proceed = () => {
    setWritingDraft({
      promptId,
      inputMethod: "typed",
      imageUri: null,
      originalOcr: null,
      ocrConfidence: null,
      text: "",
    });
    router.push("/writing/input");
  };

  return (
    <FlowScreen
      title={lang === "en" ? "Writing Assessment" : "ಬರವಣಿಗೆ ಮೌಲ್ಯಮಾಪನ"}
      subtitle={lang === "en" ? "Step 1 of 3 • Choose a topic" : "ಹಂತ 1/3 • ವಿಷಯ ಆಯ್ಕೆ"}
      step={1}
      totalSteps={3}
      footer={<FlowButton label={lang === "en" ? "Continue" : "ಮುಂದುವರಿಸಿ"} icon="chevron-forward" onPress={proceed} />}
    >
      <View style={styles.segment}>
        {(["English", "Kannada"] as const).map((l) => (
          <TouchableOpacity
            key={l}
            activeOpacity={0.8}
            onPress={() => chooseLanguage(l)}
            style={[styles.segOption, language === l && styles.segOptionActive]}
          >
            <Text style={[styles.segText, language === l && styles.segTextActive]}>
              {l === "Kannada" ? "ಕನ್ನಡ" : languageLabel(l, lang)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[flowStyles.bodyText, { marginBottom: 12 }]}>
        {lang === "en" ? "Pick a topic to write about." : "ಬರೆಯಲು ಒಂದು ವಿಷಯವನ್ನು ಆರಿಸಿ."}
      </Text>

      {prompts.map((p) => (
        <OptionCard
          key={p.id}
          icon="pencil"
          title={language === "Kannada" ? p.kannadaPrompt : p.prompt}
          subtitle={`${lang === "en" ? p.hint : p.kannadaHint}\n${lang === "en" ? `At least ${p.minWords} words` : `ಕನಿಷ್ಠ ${p.minWords} ಪದಗಳು`}`}
          selected={promptId === p.id}
          onPress={() => setPromptId(p.id)}
        />
      ))}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    marginBottom: 14,
  },
  segOption: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  segOptionActive: { backgroundColor: C.mint },
  segText: { fontSize: 13, fontWeight: "600", color: C.muted },
  segTextActive: { color: C.forest, fontWeight: "800" },
});
