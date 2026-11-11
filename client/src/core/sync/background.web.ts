/** Background sync is Android-only; the web build (used for UI checks in CI) has none. */
export const BACKGROUND_SYNC_TASK = "vgyan-background-sync";

export async function registerBackgroundSync(): Promise<void> {}
