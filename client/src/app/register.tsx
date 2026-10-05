import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/login");
    }
  };

  const handleRegister = () => {
    router.push("/login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top Bar with Exactly Positioned Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header & VGyan Branding */}
              <View style={styles.headerSection}>
                <Image
                  source={require("@/assets/images/vgyan_logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Join VGyan and begin your personalized reading journey
                </Text>
              </View>

              {/* Form Card */}
              <View style={styles.formCard}>
                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === "fullName" && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor="#8CA399"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      onFocus={() => setFocusedInput("fullName")}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                {/* Email Address */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === "email" && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#8CA399"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                {/* Participant ID (Optional) */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Participant ID</Text>
                    <Text style={styles.optionalBadge}>Optional</Text>
                  </View>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === "participantId" && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. STU-2026-01"
                      placeholderTextColor="#8CA399"
                      value={participantId}
                      onChangeText={setParticipantId}
                      autoCapitalize="none"
                      onFocus={() => setFocusedInput("participantId")}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === "password" && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Create a strong password"
                      placeholderTextColor="#8CA399"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.eyeButton}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    >
                      <Text style={styles.eyeIcon}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === "confirmPassword" && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter your password"
                      placeholderTextColor="#8CA399"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedInput("confirmPassword")}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.eyeButton}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      <Text style={styles.eyeIcon}>{showConfirmPassword ? "👁️" : "👁️‍🗨️"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Terms and Conditions Checkbox */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setAgreeTerms(!agreeTerms)}
                  style={styles.termsRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      agreeTerms && styles.checkboxChecked,
                    ]}
                  >
                    {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the <Text style={styles.termsHighlight}>Terms & Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>

                {/* Create Account CTA Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleRegister}
                  style={styles.registerButton}
                  accessibilityRole="button"
                  accessibilityLabel="Create Account"
                >
                  <Text style={styles.registerButtonText}>Create Account →</Text>
                </TouchableOpacity>
              </View>

              {/* Switch to Login */}
              <View style={styles.footerSection}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push("/login")}
                >
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    backgroundColor: "#FAF6EF",
    alignItems: "center",
    justifyContent: "center",
  },
  screenWrapper: {
    width: "100%",
    height: "100%",
    maxWidth: 480,
    backgroundColor: "#FAF6EF",
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    width: "100%",
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: Platform.OS === "android" ? 12 : 6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 61, 46, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#0B3D2E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 6px rgba(11, 61, 46, 0.1)",
        cursor: "pointer",
      },
    }),
  },
  backButtonText: {
    fontSize: 20,
    color: "#0B3D2E",
    fontWeight: "700",
    marginLeft: -1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 22,
  },
  logoImage: {
    width: 95,
    height: 70,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0B3D2E",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#4B6B60",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  formCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: "#E4EDE7",
    ...Platform.select({
      ios: {
        shadowColor: "#0B3D2E",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 8px 24px rgba(11, 61, 46, 0.06)",
      },
    }),
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  label: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#164A3D",
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  optionalBadge: {
    fontSize: 11.5,
    color: "#8CA399",
    fontWeight: "500",
    marginBottom: 7,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAF8",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D9E6DF",
    paddingHorizontal: 14,
    height: 48,
  },
  inputFocused: {
    borderColor: "#0B3D2E",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: "#0F2F24",
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 6,
    marginLeft: 6,
  },
  eyeIcon: {
    fontSize: 16,
    opacity: 0.7,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#B7CDC3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0B3D2E",
    borderColor: "#0B3D2E",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: "#4B6B60",
    lineHeight: 18,
  },
  termsHighlight: {
    color: "#0B3D2E",
    fontWeight: "600",
  },
  registerButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0B3D2E",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#052219",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 12px rgba(11, 61, 46, 0.25)",
        cursor: "pointer",
      },
    }),
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  footerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  footerText: {
    fontSize: 14,
    color: "#4B6B60",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3D2E",
  },
});
