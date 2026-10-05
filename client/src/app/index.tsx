import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Palette } from "@/constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        {/* Crystal Clear Ultra High-Res Enhanced Artwork */}
        <Image
          source={require("@/assets/images/welcome_exact.png")}
          style={styles.mockupImage}
          resizeMode="cover"
        />

        {/* Interactive Overlay Layer */}
        <SafeAreaView style={styles.interactiveLayer}>
          {/* Top Bar with Clean Skip Action */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/login")}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip to login"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Interactive Navigation Section */}
          <View style={styles.bottomSection}>
            {/* Step Indicators */}
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>

            {/* "Get Started →" CTA Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/onboarding1")}
              style={styles.getStartedButton}
              accessibilityRole="button"
              accessibilityLabel="Get Started"
            >
              <View style={styles.buttonContent}>
                <Image
                  source={require("@/assets/images/leaf_icon.png")}
                  style={styles.buttonLeaf}
                  resizeMode="contain"
                />
                <Text style={styles.buttonText}>Get Started</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </View>
            </TouchableOpacity>

            {/* Footer Tagline */}
            <Text style={styles.footerCaption}>Learn in your language.</Text>
          </View>
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
    justifyContent: "space-between",
    position: "relative",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 6,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(11, 61, 46, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0B3D2E",
    letterSpacing: 0.2,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 18 : 26,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(11, 61, 46, 0.22)",
  },
  activeDot: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0B3D2E",
  },
  getStartedButton: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0A3E31",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#042019",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0px 6px 16px rgba(4, 32, 25, 0.28)",
        cursor: "pointer",
      },
    }),
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonLeaf: {
    width: 20,
    height: 20,
    tintColor: "#6EE7B7",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  buttonArrow: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },
  footerCaption: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "500",
    color: "#164A3D",
    letterSpacing: 0.2,
  },
});
