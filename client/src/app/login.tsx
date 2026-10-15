import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { C, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { Field } from "@/components/form-ui";
import { useApp } from "@/state/app-store";

export default function LoginScreen() {
  const router = useRouter();
  const { lang, login } = useApp();
  const en = lang === "en";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const res = await login(identifier, password);
    setBusy(false);
    if (res.ok) {
      // The landing route decides where a signed-in student goes next.
      router.replace("/");
      return;
    }
    setError(
      res.error === "not-found"
        ? en
          ? "No account with that ID or email on this phone. Check it, or create an account."
          : "ಈ ಫೋನ್‌ನಲ್ಲಿ ಆ ಐಡಿ ಅಥವಾ ಇಮೇಲ್‌ನ ಖಾತೆ ಇಲ್ಲ. ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಹೊಸ ಖಾತೆ ತೆರೆಯಿರಿ."
        : en
        ? "That password doesn't match. Try again."
        : "ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದುತ್ತಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlowScreen
        title={en ? "Sign In" : "ಸೈನ್ ಇನ್"}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        footer={
          <View>
            <FlowButton
              label={en ? "Sign In" : "ಸೈನ್ ಇನ್"}
              icon="chevron-forward"
              disabled={!canSubmit}
              loading={busy}
              onPress={handleLogin}
            />
            <TouchableOpacity
              onPress={() => router.replace("/register")}
              style={styles.switchRow}
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>
                {en ? "New here? " : "ಹೊಸಬರೇ? "}
                <Text style={styles.switchLink}>{en ? "Create an account" : "ಖಾತೆ ತೆರೆಯಿರಿ"}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.header}>
          <Image source={require("@/assets/images/vgyan_logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{en ? "Welcome back" : "ಮರಳಿ ಸ್ವಾಗತ"}</Text>
          <Text style={styles.subtitle}>
            {en ? "Sign in with your participant ID or email." : "ನಿಮ್ಮ ಭಾಗವಹಿಸುವವರ ಐಡಿ ಅಥವಾ ಇಮೇಲ್ ಬಳಸಿ ಸೈನ್ ಇನ್ ಮಾಡಿ."}
          </Text>
        </View>

        {error ? <Notice tone="error" text={error} /> : null}

        <Field
          label={en ? "Participant ID or email" : "ಭಾಗವಹಿಸುವವರ ಐಡಿ ಅಥವಾ ಇಮೇಲ್"}
          placeholder="VG-2026-123456"
          value={identifier}
          onChangeText={(t) => {
            setIdentifier(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
        />
        <Field
          label={en ? "Password" : "ಪಾಸ್‌ವರ್ಡ್"}
          placeholder={en ? "Your password" : "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್"}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          secure
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity onPress={() => setShowForgot((v) => !v)} accessibilityRole="button">
          <Text style={styles.forgot}>{en ? "Forgot your password?" : "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?"}</Text>
        </TouchableOpacity>
        {showForgot ? (
          <Notice
            text={
              en
                ? "Ask your teacher or the research team to reset it for you."
                : "ಅದನ್ನು ಮರುಹೊಂದಿಸಲು ನಿಮ್ಮ ಶಿಕ್ಷಕರು ಅಥವಾ ಸಂಶೋಧನಾ ತಂಡವನ್ನು ಕೇಳಿ."
            }
          />
        ) : null}
      </FlowScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: 8, marginBottom: 22 },
  logo: { width: 72, height: 72, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: "800", color: C.forest },
  subtitle: { fontSize: 13.5, color: C.body, marginTop: 6, textAlign: "center", lineHeight: 19 },
  forgot: { fontSize: 13, fontWeight: "700", color: C.forest, marginBottom: 12 },
  switchRow: { alignItems: "center", paddingTop: 12 },
  switchText: { fontSize: 13.5, color: C.body },
  switchLink: { fontWeight: "800", color: C.forest, textDecorationLine: "underline" },
});
