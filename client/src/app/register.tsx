import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Palette } from "@/constants/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        {/* Exact Visual Mockup from Design with Dummy Status Bar (charge, time, notch) Cleanly Removed */}
        <Image
          source={require("@/assets/images/register_exact.png")}
          style={styles.mockupImage}
          resizeMode="cover"
        />

        {/* Interactive Overlay Layer */}
        <SafeAreaView style={styles.interactiveLayer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            {/* 1. Full Name Input Overlay */}
            <View
              style={[
                styles.inputBox,
                { top: "39.8%" },
                fullName ? styles.filledInputBg : null,
              ]}
            >
              <TextInput
                style={styles.transparentInput}
                placeholder=""
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* 2. Email Address Input Overlay */}
            <View
              style={[
                styles.inputBox,
                { top: "45.5%" },
                email ? styles.filledInputBg : null,
              ]}
            >
              <TextInput
                style={styles.transparentInput}
                placeholder=""
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* 3. Participant ID (Optional) Input Overlay */}
            <View
              style={[
                styles.inputBox,
                { top: "50.0%", right: "23.0%" },
                participantId ? styles.filledInputBg : null,
              ]}
            >
              <TextInput
                style={styles.transparentInput}
                placeholder=""
                value={participantId}
                onChangeText={setParticipantId}
                autoCapitalize="none"
              />
            </View>

            {/* 4. Password Input Overlay */}
            <View
              style={[
                styles.inputBox,
                { top: "56.0%", right: "25.0%" },
                password ? styles.filledInputBg : null,
              ]}
            >
              <TextInput
                style={styles.transparentInput}
                placeholder=""
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.eyeTouchArea}
              />
            </View>

            {/* 5. Confirm Password Input Overlay */}
            <View
              style={[
                styles.inputBox,
                { top: "62.0%", right: "25.0%" },
                confirmPassword ? styles.filledInputBg : null,
              ]}
            >
              <TextInput
                style={styles.transparentInput}
                placeholder=""
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.eyeTouchArea}
              />
            </View>

            {/* 6. Terms & Conditions Agreement Checkbox */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setAgreeTerms(!agreeTerms)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.termsTouchArea}
            />

            {/* 7. Create Account CTA Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                // Register action and route to assessment / welcome
              }}
              style={styles.createAccountButtonTouchArea}
            />

            {/* 8. Already have an account? Login switch link */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/login")}
              hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
              style={styles.loginLinkTouchArea}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: Palette.softCream,
    alignItems: "center",
    justifyContent: "center",
  },
  screenWrapper: {
    width: "100%",
    height: "100%",
    maxWidth: 480,
    position: "relative",
    overflow: "hidden",
    backgroundColor: Palette.softCream,
  },
  mockupImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  interactiveLayer: {
    flex: 1,
    justifyContent: "center",
  },
  keyboardView: {
    flex: 1,
    position: "relative",
  },
  inputBox: {
    position: "absolute",
    left: "19.5%",
    right: "18.5%",
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
  },
  filledInputBg: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
  },
  transparentInput: {
    flex: 1,
    fontSize: 14.5,
    color: "#0F172A",
    fontWeight: "500",
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  eyeTouchArea: {
    position: "absolute",
    right: -32,
    width: 32,
    height: 32,
  },
  termsTouchArea: {
    position: "absolute",
    top: "67.2%",
    left: "14.5%",
    right: "14.5%",
    height: 30,
  },
  createAccountButtonTouchArea: {
    position: "absolute",
    top: "72.2%",
    left: "15.5%",
    right: "15.5%",
    height: 52,
    borderRadius: 26,
  },
  loginLinkTouchArea: {
    position: "absolute",
    top: "80.0%",
    left: "18%",
    right: "18%",
    height: 36,
  },
});
