import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Card, FlowScreen, Notice, OptionCard, SectionTitle, flowStyles } from "@/components/flow-ui";
import { getWritingPrompt } from "@/constants/content";
import { useApp } from "@/state/app-store";

export default function WritingInputScreen() {
  const router = useRouter();
  const { lang, writingDraft, setWritingDraft } = useApp();
  const [error, setError] = useState<string | null>(null);
  const prompt = getWritingPrompt(writingDraft?.promptId);

  if (!writingDraft || !prompt) return <Redirect href="/writing/prompt" />;

  const pickImage = async (source: "camera" | "gallery") => {
    setError(null);
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          lang === "en"
            ? `Please allow ${source === "camera" ? "camera" : "photo"} access in Settings to continue.`
            : "ಮುಂದುವರಿಸಲು ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅನುಮತಿ ನೀಡಿ."
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: "images",
        allowsEditing: true,
        quality: 0.85,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;

      setWritingDraft({
        ...writingDraft,
        inputMethod: source,
        imageUri: result.assets[0].uri,
        originalOcr: null,
        ocrConfidence: null,
        text: "",
      });
      router.push("/writing/preview");
    } catch (e) {
      console.warn("image pick failed", e);
      setError(lang === "en" ? "Could not open the camera or gallery." : "ಕ್ಯಾಮೆರಾ ಅಥವಾ ಗ್ಯಾಲರಿ ತೆರೆಯಲಾಗಲಿಲ್ಲ.");
    }
  };

  return (
    <FlowScreen
      title={lang === "en" ? "How will you answer?" : "ಹೇಗೆ ಉತ್ತರಿಸುತ್ತೀರಿ?"}
      subtitle={lang === "en" ? "Step 2 of 3 • Input" : "ಹಂತ 2/3 • ಉತ್ತರ"}
      step={2}
      totalSteps={3}
    >
      <Card style={{ backgroundColor: "#FFFDF8", borderColor: "#EBE5D8" }}>
        <SectionTitle title={lang === "en" ? "Your topic" : "ನಿಮ್ಮ ವಿಷಯ"} />
        <Text style={styles.promptText}>
          {prompt.language === "Kannada" ? prompt.kannadaPrompt : prompt.prompt}
        </Text>
        <Text style={[flowStyles.muted, { marginTop: 6 }]}>
          {lang === "en" ? prompt.hint : prompt.kannadaHint}
        </Text>
      </Card>

      {error ? <Notice tone="error" text={error} /> : null}

      <OptionCard
        icon="camera"
        title={lang === "en" ? "Take a Photo" : "ಫೋಟೋ ತೆಗೆಯಿರಿ"}
        subtitle={lang === "en" ? "Write on paper, then photograph your page" : "ಕಾಗದದ ಮೇಲೆ ಬರೆದು ಫೋಟೋ ತೆಗೆಯಿರಿ"}
        badge="OCR"
        onPress={() => pickImage("camera")}
      />
      <OptionCard
        icon="image"
        title={lang === "en" ? "Upload from Gallery" : "ಗ್ಯಾಲರಿಯಿಂದ ಅಪ್‌ಲೋಡ್"}
        subtitle={lang === "en" ? "Choose a photo you already took" : "ಈಗಾಗಲೇ ತೆಗೆದ ಫೋಟೋ ಆರಿಸಿ"}
        badge="OCR"
        onPress={() => pickImage("gallery")}
      />
      <OptionCard
        icon="keyboard"
        title={lang === "en" ? "Type Your Answer" : "ಉತ್ತರ ಟೈಪ್ ಮಾಡಿ"}
        subtitle={lang === "en" ? "Write directly using the keyboard" : "ಕೀಬೋರ್ಡ್ ಬಳಸಿ ನೇರವಾಗಿ ಬರೆಯಿರಿ"}
        onPress={() => {
          setWritingDraft({ ...writingDraft, inputMethod: "typed", imageUri: null, originalOcr: null, ocrConfidence: null });
          router.push("/writing/type");
        }}
      />

      <Text style={[flowStyles.muted, { marginTop: 4 }]}>
        {lang === "en"
          ? "Photos of your handwriting are kept as the original record for research."
          : "ನಿಮ್ಮ ಕೈಬರಹದ ಫೋಟೋವನ್ನು ಸಂಶೋಧನೆಗಾಗಿ ಮೂಲ ದಾಖಲೆಯಾಗಿ ಇರಿಸಲಾಗುತ್ತದೆ."}
      </Text>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  promptText: { fontSize: 15.5, fontWeight: "700", color: "#164A3D", lineHeight: 22 },
});
