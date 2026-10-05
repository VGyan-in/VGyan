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

export default function OnboardingScreen2() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/onboarding1");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        {/* Crystal Clear Ultra High-Res Enhanced Artwork */}
        <Image
          source={require("@/assets/images/onboarding2_exact.png")}
          style={styles.mockupImage}
          resizeMode="cover"
        />

        {/* Interactive Overlay Layer */}
        <SafeAreaView style={styles.interactiveLayer}>
          {/* Top Bar with Consistent Back Button and Skip Button */}
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

          {/* Bottom Floating Action Arrow Button Touch Target */}
          <View style={styles.bottomBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              activeOpacity={0.65}
              onPress={() => router.push("/login")}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={styles.fabTouchArea}
              accessibilityRole="button"
              accessibilityLabel="Finish onboarding and go to login"
            />
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
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
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
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0B3D2E",
    letterSpacing: 0.2,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 72,
    paddingRight: 24,
    paddingBottom: Platform.OS === "ios" ? 14 : 22,
  },
  fabTouchArea: {
    width: 66,
    height: 66,
    borderRadius: 33,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
});
