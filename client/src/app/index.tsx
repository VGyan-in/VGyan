import React from "react";
import { View, StyleSheet, Image, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Palette } from "@/constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        {/* Exact Visual Mockup from Image with Status Bar Cleaned */}
        <Image
          source={require("@/assets/images/welcome_exact.png")}
          style={styles.mockupImage}
          resizeMode="cover"
        />

        {/* Interactive Overlay Layer */}
        <SafeAreaView style={styles.interactiveLayer}>
          {/* Top-Right "Skip" Touch Target */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/login")}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            style={styles.skipButton}
          />

          {/* Bottom "Get Started →" CTA Touch Target */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/onboarding1")}
            style={styles.getStartedButton}
          />
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
    position: "relative",
  },
  skipButton: {
    position: "absolute",
    top: "3.8%",
    right: "5%",
    width: 65,
    height: 38,
    borderRadius: 8,
  },
  getStartedButton: {
    position: "absolute",
    bottom: "7.5%",
    left: "8%",
    right: "8%",
    height: 58,
    borderRadius: 30,
  },
});
