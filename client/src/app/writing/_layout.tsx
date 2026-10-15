import { Redirect, Stack } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useApp } from "@/state/app-store";

export default function WritingLayout() {
  const { hasActiveConsent } = useApp();

  // Consent gate: assessments are unreachable without an active consent record.
  if (!hasActiveConsent) return <Redirect href="/consent" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === "web" ? "fade" : "slide_from_right",
        animationDuration: 180,
        contentStyle: { backgroundColor: "#FAF6EF" },
      }}
    >
      <Stack.Screen name="prompt" />
      <Stack.Screen name="input" />
      <Stack.Screen name="type" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="ocr-correction" />
      <Stack.Screen name="result" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
