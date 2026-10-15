import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui/app-icon";
import { C, FlowButton, FlowScreen } from "@/components/flow-ui";
import { useGoHome } from "@/hooks/use-go-home";
import { useApp } from "@/state/app-store";

export default function NotFoundScreen() {
  const goHome = useGoHome();
  const { lang } = useApp();

  return (
    <FlowScreen
      title={lang === "en" ? "Page not found" : "ಪುಟ ಸಿಗಲಿಲ್ಲ"}
      onBack={() => goHome()}
      footer={
        <FlowButton
          label={lang === "en" ? "Go Home" : "ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ"}
          icon="home"
          onPress={() => goHome()}
        />
      }
    >
      <View style={styles.body}>
        <AppIcon name="alert" size={40} color={C.muted} />
        <Text style={styles.text}>
          {lang === "en"
            ? "This screen doesn't exist. Let's get you back home."
            : "ಈ ಪರದೆ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗೋಣ."}
        </Text>
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", paddingVertical: 40, gap: 14 },
  text: { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },
});
