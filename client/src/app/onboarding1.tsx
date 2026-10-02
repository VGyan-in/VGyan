import React from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Palette } from "@/constants/theme";

const { width, height } = Dimensions.get("window");

export default function OnboardingScreen1() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        {/* Exact Visual Mockup from Design */}
        <Image
          source={require("@/assets/images/onboarding1_exact.png")}
          style={styles.mockupImage}
          resizeMode="cover"
        />

        {/* Interactive Overlay Layer */}
        <SafeAreaView style={styles.interactiveLayer}>
          {/* Top Bar Skip Touch Target */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => router.push("/login")}
              hitSlop={{ top: 20, bottom: 20, left: 24, right: 24 }}
              style={styles.skipTouchArea}
            />
          </View>

          {/* Bottom Action Arrow Button Touch Target */}
          <View style={styles.bottomBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => router.push("/onboarding2")}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={styles.fabTouchArea}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 22,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 48,
  },
  skipTouchArea: {
    width: 64,
    height: 40,
    borderRadius: 20,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 60,
    paddingRight: 6,
    paddingBottom: 4,
  },
  fabTouchArea: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
});
