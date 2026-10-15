import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { AppIcon, IconName } from "@/components/ui/app-icon";
import { C, Card, FlowButton, FlowScreen, Notice, flowStyles } from "@/components/flow-ui";
import { config } from "@/core/config";
import { useApp } from "@/state/app-store";
import type { SyncItem } from "@/types/models";
import { formatSyncTime } from "@/utils/format";

const STATUS_COLOR: Record<SyncItem["status"], string> = {
  pending: "#B45309",
  uploading: C.blue,
  synced: C.forest,
  failed: C.red,
};

/** Per-record upload status, with the last error and a manual retry (README §9). */
export default function SyncDetailsScreen() {
  const { lang, profile, queue, readingAttempts, writingAttempts, retrySyncItem, sync, syncNow } = useApp();
  const en = lang === "en";

  if (!profile) return <Redirect href="/" />;

  const describe = (item: SyncItem): { icon: IconName; title: string } => {
    if (item.entityType === "reading") {
      const a = readingAttempts.find((x) => x.id === item.entityId);
      return { icon: "mic", title: a ? (en ? a.title : a.kannadaTitle) : en ? "Reading" : "ಓದು" };
    }
    if (item.entityType === "writing") {
      const a = writingAttempts.find((x) => x.id === item.entityId);
      return {
        icon: "pencil",
        title: a ? (a.language === "Kannada" ? a.kannadaPrompt : a.prompt) : en ? "Writing" : "ಬರಹ",
      };
    }
    return { icon: "shield", title: en ? "Consent record" : "ಸಮ್ಮತಿ ದಾಖಲೆ" };
  };

  const statusLabel = (item: SyncItem) => {
    if (item.status === "synced") return en ? "Uploaded" : "ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ";
    if (item.status === "uploading") return en ? "Uploading" : "ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ";
    if (item.status === "pending") return en ? "Waiting" : "ಕಾಯುತ್ತಿದೆ";
    if (item.permanent) return en ? "Needs attention" : "ಗಮನ ಬೇಕು";
    if (item.attempts >= config.syncMaxRetries) return en ? "Stopped retrying" : "ಪ್ರಯತ್ನ ನಿಲ್ಲಿಸಿದೆ";
    return en ? "Will retry" : "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸುತ್ತದೆ";
  };

  // Problems first, then waiting, then done; newest first within each.
  const order: Record<SyncItem["status"], number> = { failed: 0, uploading: 1, pending: 2, synced: 3 };
  const items = [...queue].sort(
    (a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt)
  );

  return (
    <FlowScreen
      title={en ? "Upload Details" : "ಅಪ್‌ಲೋಡ್ ವಿವರ"}
      subtitle={profile.participantId}
      footer={
        <FlowButton
          label={en ? "Upload now" : "ಈಗ ಅಪ್‌ಲೋಡ್"}
          icon="sync"
          loading={sync.isSyncing}
          onPress={() => void syncNow()}
        />
      }
    >
      {!sync.serverConfigured ? (
        <Notice
          tone="warn"
          text={
            en
              ? "No research server is configured in this build, so items wait here. Nothing is lost."
              : "ಈ ಆವೃತ್ತಿಯಲ್ಲಿ ಸರ್ವರ್ ಹೊಂದಿಸಿಲ್ಲ. ದಾಖಲೆಗಳು ಇಲ್ಲಿ ಕಾಯುತ್ತವೆ. ಏನೂ ಕಳೆದುಹೋಗುವುದಿಲ್ಲ."
          }
        />
      ) : null}

      {items.length === 0 ? (
        <Text style={[flowStyles.bodyText, { textAlign: "center", paddingVertical: 30 }]}>
          {en ? "Nothing to upload yet." : "ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಇನ್ನೂ ಏನೂ ಇಲ್ಲ."}
        </Text>
      ) : null}

      {items.map((item) => {
        const d = describe(item);
        const canRetry = item.status === "failed";
        return (
          <Card key={item.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.icon}>
                <AppIcon name={d.icon} size={15} color={C.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text style={flowStyles.muted}>
                  {formatSyncTime(item.updatedAt)}
                  {item.attempts > 0 ? ` · ${item.attempts} ${en ? "tries" : "ಪ್ರಯತ್ನ"}` : ""}
                </Text>
              </View>
              <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{statusLabel(item)}</Text>
            </View>
            {item.lastError && item.status !== "synced" ? (
              <Text style={styles.error} selectable>
                {item.lastError}
              </Text>
            ) : null}
            {canRetry ? (
              <FlowButton
                variant="secondary"
                label={en ? "Retry" : "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ"}
                icon="refresh"
                onPress={() => void retrySyncItem(item)}
                style={{ height: 38, marginTop: 10 }}
              />
            ) : null}
          </Card>
        );
      })}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13.5, fontWeight: "700", color: "#1C3A30" },
  status: { fontSize: 11.5, fontWeight: "800" },
  error: {
    fontSize: 11.5,
    color: C.muted,
    backgroundColor: C.cream,
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
});
