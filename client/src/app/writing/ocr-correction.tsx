import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";
import { C, Card, FlowButton, FlowScreen, Notice, flowStyles } from "@/components/flow-ui";
import { WritingEditor } from "@/components/writing-editor";
import { getWritingPrompt } from "@/constants/content";
import { useSubmitWriting } from "@/features/writing/use-submit-writing";
import { useApp } from "@/state/app-store";

export default function OcrCorrectionScreen() {
  const router = useRouter();
  const { lang, writingDraft } = useApp();
  const submit = useSubmitWriting();
  const [text, setText] = useState(writingDraft?.text ?? "");
  const [showImage, setShowImage] = useState(false);
  const prompt = getWritingPrompt(writingDraft?.promptId);

  if (!writingDraft || !prompt || writingDraft.originalOcr == null) {
    return <Redirect href="/writing/prompt" />;
  }

  const edited = text !== writingDraft.originalOcr;
  const confidence = writingDraft.ocrConfidence != null ? Math.round(writingDraft.ocrConfidence * 100) : null;

  const handleSubmit = () => {
    // originalOcr stays untouched in the draft; `text` is the student's correction.
    const id = submit({ ...writingDraft, text });
    if (id) router.replace({ pathname: "/writing/result", params: { id } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlowScreen
        title={lang === "en" ? "Check the Text" : "ಪಠ್ಯ ಪರಿಶೀಲಿಸಿ"}
        subtitle={lang === "en" ? "Fix anything we read wrongly" : "ತಪ್ಪಾಗಿ ಓದಿದ್ದನ್ನು ಸರಿಪಡಿಸಿ"}
        step={3}
        totalSteps={3}
        footer={
          <FlowButton
            label={lang === "en" ? "Submit for Assessment" : "ಮೌಲ್ಯಮಾಪನಕ್ಕೆ ಸಲ್ಲಿಸಿ"}
            icon="check"
            disabled={text.trim().length === 0}
            onPress={handleSubmit}
          />
        }
      >
        <Notice
          tone={confidence != null && confidence < 85 ? "warn" : "info"}
          text={
            lang === "en"
              ? `We read your handwriting${confidence != null ? ` with ${confidence}% confidence` : ""}. Compare it with your page and correct only reading mistakes. Don't fix your own spelling – that's part of the assessment!`
              : `ನಿಮ್ಮ ಕೈಬರಹವನ್ನು ಓದಿದ್ದೇವೆ${confidence != null ? ` (${confidence}% ವಿಶ್ವಾಸ)` : ""}. ನಾವು ತಪ್ಪಾಗಿ ಓದಿದ್ದನ್ನು ಮಾತ್ರ ಸರಿಪಡಿಸಿ. ನಿಮ್ಮ ಕಾಗುಣಿತವನ್ನು ಬದಲಾಯಿಸಬೇಡಿ!`
          }
        />

        {writingDraft.imageUri ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowImage((v) => !v)}
              style={styles.imageToggle}
              accessibilityRole="button"
            >
              <AppIcon name="image" size={15} color={C.forest} />
              <Text style={styles.imageToggleText}>
                {showImage
                  ? lang === "en" ? "Hide my page" : "ಪುಟ ಮರೆಮಾಡಿ"
                  : lang === "en" ? "Show my page" : "ನನ್ನ ಪುಟ ತೋರಿಸಿ"}
              </Text>
            </TouchableOpacity>
            {showImage ? (
              <Image source={{ uri: writingDraft.imageUri }} style={styles.image} contentFit="contain" />
            ) : null}
          </Card>
        ) : null}

        <WritingEditor
          value={text}
          onChange={setText}
          language={prompt.language}
          minWords={prompt.minWords}
          lang={lang}
          minHeight={200}
        />

        {edited ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setText(writingDraft.originalOcr ?? "")}
            style={styles.resetRow}
            accessibilityRole="button"
          >
            <AppIcon name="refresh" size={13} color={C.muted} />
            <Text style={flowStyles.muted}>
              {lang === "en" ? "Undo my changes" : "ನನ್ನ ಬದಲಾವಣೆಗಳನ್ನು ರದ್ದುಮಾಡಿ"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </FlowScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  imageToggle: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  imageToggleText: { fontSize: 13, fontWeight: "700", color: C.forest },
  image: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#1C2B25" },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
});
