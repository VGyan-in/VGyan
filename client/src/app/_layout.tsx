import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  // Preload screen images in memory to completely eliminate the blank screen pause
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const assets = [
        require("@/assets/images/welcome_exact.png"),
        require("@/assets/images/onboarding1_exact.png"),
        require("@/assets/images/onboarding2_exact.png"),
        require("@/assets/images/login_exact.png"),
        require("@/assets/images/register_exact.png"),
      ];
      assets.forEach((src) => {
        const img = new Image();
        img.src = typeof src === "string" ? src : src.default || src;
      });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === "web" ? "fade" : "slide_from_right",
          animationDuration: 180,
          contentStyle: { backgroundColor: "#FAF5EB" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding1" />
        <Stack.Screen name="onboarding2" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </SafeAreaProvider>
  );
}
