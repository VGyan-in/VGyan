import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { ButtonRow, C, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { getWritingPrompt } from "@/constants/content";
import { OcrUnavailableError, recognizeHandwriting } from "@/features/writing/ocr";
import { ApiError } from "@/core/api/client";
import { useApp } from "@/state/app-store";

export default function WritingPreviewScreen() {
  const router = useRouter();
  const { lang, writingDraft, setWritingDraft } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompt = getWritingPrompt(writingDraft?.promptId);

  if (!writingDraft || !prompt || !writingDraft.imageUri) return <Redirect href="/writing/prompt" />;

  const runOcr = async () => {
    setBusy(true);
    setError(null);
    try {
      const ocr = await recognizeHandwriting(writingDraft.imageUri!, prompt.language);
      setWritingDraft({
        ...writingDraft,
        originalOcr: ocr.text,
        ocrConfidence: ocr.confidence,
        ocrId: ocr.ocrId,
        ocrEngineVersion: ocr.engineVersion,
        text: ocr.text,
      });
      router.push("/writing/ocr-correction");
    } catch (e) {
      console.warn("OCR failed", e instanceof Error ? e.message : e);
      const en = lang === "en";
      const offline = e instanceof OcrUnavailableError || (e instanceof ApiError && e.status === null);
      const noConsent = e instanceof ApiError && (e.code === "handwriting_consent_required" || e.status === 428);
      setError(
        noConsent
          ? en
            ? "Photos of handwriting need your guardian's consent. Please type your answer instead."
            : "ಕೈಬರಹದ ಫೋಟೋಗೆ ಪೋಷಕರ ಒಪ್ಪಿಗೆ ಬೇಕು. ದಯವಿಟ್ಟು ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ."
          : offline
          ? en
            ? "Reading handwriting needs the internet. Connect and try again, or type your answer (typing works offline)."
            : "ಕೈಬರಹ ಓದಲು ಇಂಟರ್ನೆಟ್ ಬೇಕು. ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ (ಟೈಪಿಂಗ್ ಆಫ್‌ಲೈನ್‌ನಲ್ಲೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ)."
          : en
          ? "We couldn't read the text. Retake a clearer photo, or type your answer."
          : "ಪಠ್ಯವನ್ನು ಓದಲಾಗಲಿಲ್ಲ. ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowScreen
      title={lang === "en" ? "Check Your Photo" : "ಫೋಟೋ ಪರಿಶೀಲಿಸಿ"}
      subtitle={lang === "en" ? "Step 3 of 3 • Preview" : "ಹಂತ 3/3 • ಮುನ್ನೋಟ"}
      step={3}
      totalSteps={3}
      footer={
        <ButtonRow>
          <FlowButton
            variant="secondary"
            label={lang === "en" ? "Retake" : "ಮತ್ತೆ ತೆಗೆಯಿರಿ"}
            icon="camera"
            disabled={busy}
            onPress={() => router.back()}
          />
          <FlowButton
            label={busy ? (lang === "en" ? "Reading…" : "ಓದುತ್ತಿದೆ…") : lang === "en" ? "Extract Text" : "ಪಠ್ಯ ಪಡೆಯಿರಿ"}
            icon="sparkles"
            loading={busy}
            onPress={runOcr}
          />
        </ButtonRow>
      }
    >
      <Notice
        text={
          lang === "en"
            ? "Make sure the whole page is visible, in focus, and not too dark."
            : "ಸಂಪೂರ್ಣ ಪುಟ ಸ್ಪಷ್ಟವಾಗಿ ಮತ್ತು ಬೆಳಕಿನಲ್ಲಿ ಕಾಣುತ್ತಿದೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ."
        }
      />
      {error ? <Notice tone="error" text={error} /> : null}

      <View style={styles.imageFrame}>
        <Image
          source={{ uri: writingDraft.imageUri }}
          style={styles.image}
          contentFit="contain"
          accessibilityLabel={lang === "en" ? "Photo of your handwriting" : "ನಿಮ್ಮ ಕೈಬರಹದ ಫೋಟೋ"}
        />
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    backgroundColor: "#1C2B25",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  image: { width: "100%", aspectRatio: 3 / 4 },
});
