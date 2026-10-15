import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { C, FlowButton, FlowScreen, Notice } from "@/components/flow-ui";
import { Field, FormError } from "@/components/form-ui";
import { useApp } from "@/state/app-store";

const MIN_PASSWORD = 4;

export default function RegisterScreen() {
  const router = useRouter();
  const { lang, register } = useApp();
  const en = lang === "en";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = {
    fullName: fullName.trim().length < 2 ? (en ? "Enter your full name" : "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ") : null,
    email:
      email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())
        ? en ? "That doesn't look like an email address" : "ಇದು ಇಮೇಲ್ ವಿಳಾಸದಂತೆ ಕಾಣುತ್ತಿಲ್ಲ"
        : null,
    participantId:
      participantId.trim() && !/^[A-Za-z0-9-]{4,32}$/.test(participantId.trim())
        ? en ? "Use letters, numbers and dashes only" : "ಅಕ್ಷರಗಳು, ಸಂಖ್ಯೆಗಳು ಮತ್ತು - ಮಾತ್ರ ಬಳಸಿ"
        : null,
    password:
      password.length < MIN_PASSWORD
        ? en ? `At least ${MIN_PASSWORD} characters` : `ಕನಿಷ್ಠ ${MIN_PASSWORD} ಅಕ್ಷರಗಳು`
        : null,
    confirm: confirm !== password ? (en ? "Passwords don't match" : "ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದುತ್ತಿಲ್ಲ") : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e: string | null) => (touched ? e : null);

  const handleRegister = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const res = await register({ fullName, email, participantId, password });
    setBusy(false);
    if (res.ok) {
      router.replace("/");
      return;
    }
    setError(
      res.error === "participant-exists"
        ? en
          ? "An account with this participant ID already exists on this phone. Sign in instead."
          : "ಈ ಐಡಿಯ ಖಾತೆ ಈಗಾಗಲೇ ಇದೆ. ಸೈನ್ ಇನ್ ಮಾಡಿ."
        : en
        ? "An account with this email already exists on this phone. Sign in instead."
        : "ಈ ಇಮೇಲ್‌ನ ಖಾತೆ ಈಗಾಗಲೇ ಇದೆ. ಸೈನ್ ಇನ್ ಮಾಡಿ."
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlowScreen
        title={en ? "Create Account" : "ಖಾತೆ ತೆರೆಯಿರಿ"}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        footer={
          <View>
            <FormError
              text={touched && !valid ? (en ? "Please fix the highlighted fields." : "ಗುರುತಿಸಿದ ಕ್ಷೇತ್ರಗಳನ್ನು ಸರಿಪಡಿಸಿ.") : null}
            />
            <FlowButton
              label={en ? "Create Account" : "ಖಾತೆ ತೆರೆಯಿರಿ"}
              icon="chevron-forward"
              loading={busy}
              onPress={handleRegister}
            />
            <TouchableOpacity onPress={() => router.replace("/login")} style={styles.switchRow} accessibilityRole="button">
              <Text style={styles.switchText}>
                {en ? "Already have an account? " : "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ? "}
                <Text style={styles.switchLink}>{en ? "Sign in" : "ಸೈನ್ ಇನ್"}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.header}>
          <Image source={require("@/assets/images/vgyan_logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{en ? "Let's get you started" : "ಪ್ರಾರಂಭಿಸೋಣ"}</Text>
          <Text style={styles.subtitle}>
            {en
              ? "A parent, guardian or teacher can help fill this in."
              : "ಪೋಷಕರು, ರಕ್ಷಕರು ಅಥವಾ ಶಿಕ್ಷಕರು ಇದನ್ನು ತುಂಬಲು ಸಹಾಯ ಮಾಡಬಹುದು."}
          </Text>
        </View>

        {error ? <Notice tone="error" text={error} /> : null}

        <Field
          label={en ? "Student's full name" : "ವಿದ್ಯಾರ್ಥಿಯ ಪೂರ್ಣ ಹೆಸರು"}
          placeholder={en ? "e.g. Ananya Rao" : "ಉದಾ. ಅನನ್ಯ ರಾವ್"}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          error={show(errors.fullName)}
        />
        <Field
          label={en ? "Participant ID" : "ಭಾಗವಹಿಸುವವರ ಐಡಿ"}
          optionalLabel={en ? "If given by your school" : "ಶಾಲೆ ನೀಡಿದ್ದರೆ"}
          placeholder="VG-2026-123456"
          value={participantId}
          onChangeText={setParticipantId}
          autoCapitalize="characters"
          autoCorrect={false}
          hint={en ? "Leave empty and we'll create one for you." : "ಖಾಲಿ ಬಿಟ್ಟರೆ ನಾವು ಒಂದನ್ನು ರಚಿಸುತ್ತೇವೆ."}
          error={show(errors.participantId)}
        />
        <Field
          label={en ? "Email" : "ಇಮೇಲ್"}
          optionalLabel={en ? "Optional" : "ಐಚ್ಛಿಕ"}
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={show(errors.email)}
        />
        <Field
          label={en ? "Password" : "ಪಾಸ್‌ವರ್ಡ್"}
          placeholder={en ? `At least ${MIN_PASSWORD} characters` : `ಕನಿಷ್ಠ ${MIN_PASSWORD} ಅಕ್ಷರಗಳು`}
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          error={show(errors.password)}
        />
        <Field
          label={en ? "Confirm password" : "ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ"}
          placeholder={en ? "Type it again" : "ಮತ್ತೆ ಟೈಪ್ ಮಾಡಿ"}
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={handleRegister}
          error={show(errors.confirm)}
        />
      </FlowScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: 4, marginBottom: 20 },
  logo: { width: 64, height: 64, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: C.forest },
  subtitle: { fontSize: 13.5, color: C.body, marginTop: 6, textAlign: "center", lineHeight: 19 },
  switchRow: { alignItems: "center", paddingTop: 12 },
  switchText: { fontSize: 13.5, color: C.body },
  switchLink: { fontWeight: "800", color: C.forest, textDecorationLine: "underline" },
});
