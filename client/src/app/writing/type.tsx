import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { FlowButton, FlowScreen, Notice, flowStyles } from "@/components/flow-ui";
import { WritingEditor } from "@/components/writing-editor";
import { getWritingPrompt } from "@/constants/content";
import { countWords } from "@/features/writing/metrics";
import { useSubmitWriting } from "@/features/writing/use-submit-writing";
import { useApp } from "@/state/app-store";

export default function WritingTypeScreen() {
  const router = useRouter();
  const { lang, writingDraft } = useApp();
  const submit = useSubmitWriting();
  const [text, setText] = useState(writingDraft?.text ?? "");
  const [showShortWarning, setShowShortWarning] = useState(false);
  const prompt = getWritingPrompt(writingDraft?.promptId);

  if (!writingDraft || !prompt) return <Redirect href="/writing/prompt" />;

  const words = countWords(text);

  const handleSubmit = () => {
    if (words < prompt.minWords && !showShortWarning) {
      setShowShortWarning(true);
      return;
    }
    const id = submit({ ...writingDraft, inputMethod: "typed", text });
    if (id) router.replace({ pathname: "/writing/result", params: { id } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlowScreen
        title={lang === "en" ? "Write Your Answer" : "ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ"}
        subtitle={lang === "en" ? "Step 3 of 3 • Typing" : "ಹಂತ 3/3 • ಟೈಪಿಂಗ್"}
        step={3}
        totalSteps={3}
        footer={
          <FlowButton
            label={
              showShortWarning
                ? lang === "en" ? "Submit Anyway" : "ಹಾಗೆಯೇ ಸಲ್ಲಿಸಿ"
                : lang === "en" ? "Submit for Assessment" : "ಮೌಲ್ಯಮಾಪನಕ್ಕೆ ಸಲ್ಲಿಸಿ"
            }
            icon="check"
            disabled={words === 0}
            onPress={handleSubmit}
          />
        }
      >
        <Text style={[flowStyles.bodyText, { fontWeight: "700", marginBottom: 10 }]}>
          {prompt.language === "Kannada" ? prompt.kannadaPrompt : prompt.prompt}
        </Text>

        {showShortWarning && words < prompt.minWords ? (
          <Notice
            tone="warn"
            text={
              lang === "en"
                ? `Your answer has ${words} words. Try to reach ${prompt.minWords} for a better score, or submit anyway.`
                : `ನಿಮ್ಮ ಉತ್ತರದಲ್ಲಿ ${words} ಪದಗಳಿವೆ. ${prompt.minWords} ಪದಗಳನ್ನು ತಲುಪಲು ಪ್ರಯತ್ನಿಸಿ.`
            }
          />
        ) : null}

        <WritingEditor
          value={text}
          onChange={(t) => {
            setText(t);
            if (showShortWarning) setShowShortWarning(false);
          }}
          language={prompt.language}
          minWords={prompt.minWords}
          lang={lang}
          placeholder={prompt.language === "Kannada" ? "ಇಲ್ಲಿ ಬರೆಯಲು ಪ್ರಾರಂಭಿಸಿ…" : "Start writing here…"}
        />
      </FlowScreen>
    </KeyboardAvoidingView>
  );
}
