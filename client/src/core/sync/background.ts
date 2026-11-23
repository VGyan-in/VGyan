import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { config, isServerConfigured } from "@/core/config";
import { createRepository } from "@/core/db/repository";
import { processQueue } from "./queue";
import { createUploader } from "./uploader";
import { acquireSyncLock, releaseSyncLock } from "./lock";

export const BACKGROUND_SYNC_TASK = "vgyan-background-sync";

/**
 * Headless upload of the sync queue (Android WorkManager via expo-background-task). Android may
 * defer or skip this on battery-restricted phones; the foreground triggers (app opened, network
 * back, "Sync now") remain the reliable path, and nothing is lost if this never runs.
 *
 * Only uploads: AI feedback and transcription run in the foreground, where the UI can show progress.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  if (!isServerConfigured()) return BackgroundTask.BackgroundTaskResult.Success;
  const repo = createRepository();
  try {
    await repo.init();
    if (!(await acquireSyncLock(repo, "background"))) return BackgroundTask.BackgroundTaskResult.Success;
    try {
      const result = await processQueue(repo, createUploader(repo), { maxRetries: config.syncMaxRetries });
      if (result.synced.length > 0) {
        await repo.setMeta("sync.last", new Date().toISOString());
        // Mark attempts synced so the UI shows it on next launch.
        for (const item of result.synced) {
          if (item.entityType === "reading") {
            const a = await repo.getReading(item.entityId);
            if (a) await repo.saveReading({ ...a, synced: true });
          } else if (item.entityType === "writing") {
            const a = await repo.getWriting(item.entityId);
            if (a) await repo.saveWriting({ ...a, synced: true });
          }
        }
      }
    } finally {
      await releaseSyncLock(repo, "background");
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;
    // WorkManager's minimum interval is 15 minutes; it also waits for network connectivity.
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 30 });
  } catch (e) {
    console.warn("background sync not registered", e instanceof Error ? e.message : e);
  }
}
