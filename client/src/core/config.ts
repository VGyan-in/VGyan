import Constants from "expo-constants";

/**
 * Runtime configuration from EXPO_PUBLIC_* environment variables (see .env.example).
 * No secrets live here: AI and OCR credentials stay on the backend.
 */
export const config = {
  /** Backend base URL. Empty means "no server yet": data stays on the phone and sync waits. */
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, ""),
  consentVersion: process.env.EXPO_PUBLIC_CONSENT_VERSION ?? "1.0",
  syncMaxRetries: Number(process.env.EXPO_PUBLIC_SYNC_MAX_RETRIES ?? 8),
  /** Delete local audio/images once the server confirms receipt. Off by default for the pilot. */
  purgeMediaAfterSync: process.env.EXPO_PUBLIC_PURGE_MEDIA_AFTER_SYNC === "true",
  /** Dev only: pretend uploads succeed when no server is configured. */
  simulateSync: process.env.EXPO_PUBLIC_SIMULATE_SYNC === "true",
  appVersion: Constants.expoConfig?.version ?? "0.0.0",
};

export const isServerConfigured = () => config.apiBaseUrl.length > 0;
