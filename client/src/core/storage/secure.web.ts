// Web (development only): no secure enclave, so fall back to sessionStorage.
const store = () => globalThis.sessionStorage;

export const secureStore = {
  get: async (key: string) => store()?.getItem(key) ?? null,
  set: async (key: string, value: string) => store()?.setItem(key, value),
  remove: async (key: string) => store()?.removeItem(key),
};
