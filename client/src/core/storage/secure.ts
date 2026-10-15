import * as SecureStore from "expo-secure-store";

/** Auth token storage in the Android Keystore / iOS Keychain. Never AsyncStorage. */
export const secureStore = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
