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

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        {/* Exact Visual Mockup from Design with Dummy Status Bar (charge, time, notch) Cleanly Removed */}
        <Image
          source={require("@/assets/images/login_exact.png")}
          style={styles.mockupImage}
          resizeMode="cover"
        />

        {/* Interactive Overlay Layer */}
        <SafeAreaView style={styles.interactiveLayer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            {/* Email / Participant ID Input Overlay */}
            <View
              style={[
                styles.emailInputBox,
                identifier ? styles.filledInputBg : null,
              ]}
            >
              <TextInput
                style={styles.transparentInput}
                placeholder=""
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password Input Overlay */}
            <View
              style={[
                styles.passwordInputBox,
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

            {/* Remember Me Checkbox Touch Target */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setRememberMe(!rememberMe)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.rememberMeTouchArea}
            />

            {/* Forgot Password Touch Target */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                // Forgot password action
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.forgotPasswordTouchArea}
            />

            {/* Login CTA Button Touch Target */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                // Navigate to main assessment / home
              }}
              style={styles.loginButtonTouchArea}
            />

            {/* Register Switch Link Touch Target */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/register")}
              hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
              style={styles.registerLinkTouchArea}
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
  emailInputBox: {
    position: "absolute",
    top: "44.0%",
    left: "19.5%",
    right: "18.5%",
    height: 38,
    justifyContent: "center",
    borderRadius: 8,
  },
  passwordInputBox: {
    position: "absolute",
    top: "50.0%",
    left: "19.5%",
    right: "25.0%",
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
  rememberMeTouchArea: {
    position: "absolute",
    top: "58.0%",
    left: "15.5%",
    width: 125,
    height: 32,
  },
  forgotPasswordTouchArea: {
    position: "absolute",
    top: "58.0%",
    right: "15.5%",
    width: 115,
    height: 32,
  },
  loginButtonTouchArea: {
    position: "absolute",
    top: "64.0%",
    left: "15.5%",
    right: "15.5%",
    height: 52,
    borderRadius: 26,
  },
  registerLinkTouchArea: {
    position: "absolute",
    top: "72.0%",
    left: "18%",
    right: "18%",
    height: 36,
  },
});
