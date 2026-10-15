import { ErrorBoundaryProps, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "@/state/app-store";

const CREAM = "#FAF6EF";

/** Shown instead of a white screen if any screen throws while rendering. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>
        Your saved work is safe on this phone. Please try again.{"\n"}ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.
      </Text>
      <TouchableOpacity onPress={retry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppStack() {
  const { ready } = useApp();

  // Hold rendering until the database is open and the session is restored,
  // so route guards never act on half-loaded state.
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0B3D2E" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === "web" ? "fade" : "slide_from_right",
        animationDuration: 180,
        contentStyle: { backgroundColor: CREAM },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="home" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="sync-details" />
      <Stack.Screen name="reading" />
      <Stack.Screen name="writing" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <AppStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: CREAM, padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: "800", color: "#0B3D2E", marginBottom: 8 },
  errorBody: { fontSize: 14, color: "#3F5F53", textAlign: "center", lineHeight: 21, marginBottom: 18 },
  retry: { backgroundColor: "#0B3D2E", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  retryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
