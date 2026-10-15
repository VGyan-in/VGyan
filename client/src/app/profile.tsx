import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { AppIcon, IconName } from "@/components/ui/app-icon";
import { ButtonRow, C, Card, FlowButton, Notice, SectionTitle, TabScreen, flowStyles } from "@/components/flow-ui";
import { config } from "@/core/config";
import { mediaUsage } from "@/core/storage/files";
import { useApp } from "@/state/app-store";
import { confirmAction } from "@/utils/confirm";
import { formatBytes, formatSyncTime } from "@/utils/format";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    lang,
    profile,
    consent,
    hasActiveConsent,
    readingAttempts,
    writingAttempts,
    sync,
    pendingCount,
    failedCount,
    setAutoSync,
    syncNow,
    withdrawConsent,
    deleteLocalData,
    logout,
  } = useApp();
  const en = lang === "en";
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const attemptCount = readingAttempts.length + writingAttempts.length;
  // Recomputed when attempts are added or deleted.
  const usage = useMemo(
    () => (profile ? mediaUsage(profile.participantId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, attemptCount]
  );

  if (!profile) return <Redirect href="/" />;

  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const lastSynced = formatSyncTime(sync.lastSyncedAt);

  const handleSyncNow = async () => {
    setSyncResult(null);
    const r = await syncNow();
    if (r.skipped > 0 && r.synced === 0) {
      // The "server not connected" notice above already explains this.
      setSyncResult(null);
    } else if (r.failed > 0) {
      setSyncResult(
        en
          ? `${r.failed} item${r.failed === 1 ? "" : "s"} couldn't upload. They'll retry automatically.`
          : `${r.failed} ದಾಖಲೆಗಳು ಅಪ್‌ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಸ್ವಯಂ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲಾಗುತ್ತದೆ.`
      );
    } else {
      setSyncResult(
        en
          ? r.synced > 0
            ? `${r.synced} item${r.synced === 1 ? "" : "s"} uploaded.`
            : "Everything is already up to date."
          : "ಎಲ್ಲವೂ ಸಿಂಕ್ ಆಗಿದೆ."
      );
    }
  };

  const handleWithdraw = async () => {
    const ok = await confirmAction({
      title: en ? "Withdraw consent?" : "ಸಮ್ಮತಿ ಹಿಂಪಡೆಯುವುದೇ?",
      message: en
        ? "Reading and writing assessments will be locked, and the research team will be told to stop using this student's data. Consent can be given again later."
        : "ಮೌಲ್ಯಮಾಪನಗಳು ಲಾಕ್ ಆಗುತ್ತವೆ. ಈ ವಿದ್ಯಾರ್ಥಿಯ ಡೇಟಾ ಬಳಕೆ ನಿಲ್ಲಿಸಲು ಸಂಶೋಧನಾ ತಂಡಕ್ಕೆ ತಿಳಿಸಲಾಗುತ್ತದೆ.",
      confirmLabel: en ? "Withdraw" : "ಹಿಂಪಡೆಯಿರಿ",
      cancelLabel: en ? "Cancel" : "ರದ್ದುಮಾಡಿ",
      destructive: true,
    });
    if (ok) await withdrawConsent();
  };

  const handleDelete = async () => {
    const ok = await confirmAction({
      title: en ? "Delete data from this phone?" : "ಈ ಫೋನ್‌ನಿಂದ ಡೇಟಾ ಅಳಿಸುವುದೇ?",
      message: en
        ? `This removes ${attemptCount} saved attempt${attemptCount === 1 ? "" : "s"}, with recordings and photos, from this phone.${
            pendingCount > 0 ? ` ${pendingCount} of them have NOT been uploaded yet and will be lost.` : ""
          } This can't be undone.`
        : `ಈ ಫೋನ್‌ನಿಂದ ${attemptCount} ಪ್ರಯತ್ನಗಳನ್ನು ಅಳಿಸಲಾಗುತ್ತದೆ.${pendingCount > 0 ? " ಕೆಲವು ಇನ್ನೂ ಅಪ್‌ಲೋಡ್ ಆಗಿಲ್ಲ." : ""} ಇದನ್ನು ರದ್ದುಮಾಡಲಾಗದು.`,
      confirmLabel: en ? "Delete" : "ಅಳಿಸಿ",
      cancelLabel: en ? "Cancel" : "ರದ್ದುಮಾಡಿ",
      destructive: true,
    });
    if (ok) await deleteLocalData();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const syncHeading = sync.isSyncing
    ? en ? "Uploading…" : "ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…"
    : pendingCount > 0
    ? en
      ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting to upload`
      : `${pendingCount} ದಾಖಲೆಗಳು ಅಪ್‌ಲೋಡ್‌ಗೆ ಕಾಯುತ್ತಿವೆ`
    : en ? "Everything is uploaded" : "ಎಲ್ಲವೂ ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ";

  return (
    <TabScreen title={en ? "Profile" : "ಪ್ರೊಫೈಲ್"} activeTab="profile">
      {/* Student */}
      <Card>
        <View style={styles.studentRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <View style={styles.idChip}>
              <Text style={styles.idChipText}>{profile.participantId}</Text>
            </View>
          </View>
        </View>
        <View style={styles.metaGrid}>
          <Meta
            label={en ? "Class" : "ತರಗತಿ"}
            value={profile.grade ? `${profile.grade}${profile.section ? ` ${profile.section}` : ""}` : "–"}
          />
          <Meta label={en ? "School" : "ಶಾಲೆ"} value={profile.school || "–"} wide />
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/profile-setup", params: { mode: "edit" } })}
          style={styles.linkRow}
          accessibilityRole="button"
        >
          <AppIcon name="pencil" size={14} color={C.forest} />
          <Text style={styles.linkText}>{en ? "Edit details" : "ವಿವರ ತಿದ್ದಿ"}</Text>
        </TouchableOpacity>
      </Card>

      {/* Sync */}
      <SectionTitle title={en ? "Upload to research server" : "ಸಂಶೋಧನಾ ಸರ್ವರ್‌ಗೆ ಅಪ್‌ಲೋಡ್"} />
      <Card>
        <View style={styles.syncHead}>
          <View style={[styles.statusIcon, pendingCount > 0 && { backgroundColor: "#FEF3C7" }]}>
            <AppIcon
              name={sync.isSyncing ? "sync" : pendingCount > 0 ? "cloud-check" : "check"}
              size={18}
              color={pendingCount > 0 ? "#B45309" : C.forest}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.syncTitle}>{syncHeading}</Text>
            <Text style={flowStyles.muted}>
              {!sync.isOnline
                ? en ? "You're offline. Work is saved on this phone." : "ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ. ಕೆಲಸ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿದಿದೆ."
                : lastSynced
                ? `${en ? "Last upload" : "ಕೊನೆಯ ಅಪ್‌ಲೋಡ್"}: ${lastSynced}`
                : en ? "Nothing uploaded yet" : "ಇನ್ನೂ ಏನೂ ಅಪ್‌ಲೋಡ್ ಆಗಿಲ್ಲ"}
            </Text>
          </View>
        </View>

        {!sync.serverConfigured ? (
          <Notice
            tone="warn"
            text={
              en
                ? "Research server not connected yet. All work stays safely on this phone and will upload once it's set up."
                : "ಸಂಶೋಧನಾ ಸರ್ವರ್ ಇನ್ನೂ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. ಎಲ್ಲಾ ಕೆಲಸ ಈ ಫೋನ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿದೆ."
            }
          />
        ) : null}
        {syncResult ? <Notice text={syncResult} /> : null}

        <View style={styles.storageRow}>
          <Storage value={String(attemptCount)} label={en ? "Attempts" : "ಪ್ರಯತ್ನಗಳು"} />
          <Storage
            value={String(usage?.recordings.count ?? 0)}
            label={`${en ? "Recordings" : "ರೆಕಾರ್ಡಿಂಗ್"}${usage?.recordings.bytes ? ` · ${formatBytes(usage.recordings.bytes)}` : ""}`}
          />
          <Storage
            value={String(usage?.images.count ?? 0)}
            label={`${en ? "Photos" : "ಫೋಟೋಗಳು"}${usage?.images.bytes ? ` · ${formatBytes(usage.images.bytes)}` : ""}`}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>{en ? "Upload automatically on Wi-Fi" : "ವೈ-ಫೈನಲ್ಲಿ ಸ್ವಯಂ ಅಪ್‌ಲೋಡ್"}</Text>
            <Text style={flowStyles.muted}>
              {en ? "Mobile data is only used when you tap Upload now." : "ಮೊಬೈಲ್ ಡೇಟಾ ಕೈಯಾರೆ ಅಪ್‌ಲೋಡ್‌ಗೆ ಮಾತ್ರ."}
            </Text>
          </View>
          <Switch
            value={sync.autoSync}
            onValueChange={(v) => void setAutoSync(v)}
            trackColor={{ false: "#DCE9E2", true: C.forest }}
            thumbColor={C.white}
          />
        </View>

        <ButtonRow>
          <FlowButton
            variant="secondary"
            label={failedCount > 0 ? `${en ? "Details" : "ವಿವರ"} (${failedCount})` : en ? "Details" : "ವಿವರ"}
            icon={failedCount > 0 ? "alert" : undefined}
            onPress={() => router.push("/sync-details")}
          />
          <FlowButton label={en ? "Upload now" : "ಈಗ ಅಪ್‌ಲೋಡ್"} icon="sync" loading={sync.isSyncing} onPress={handleSyncNow} />
        </ButtonRow>
      </Card>

      {/* Consent */}
      <SectionTitle title={en ? "Research consent" : "ಸಂಶೋಧನಾ ಸಮ್ಮತಿ"} />
      <Card>
        <View style={styles.consentHead}>
          <View style={[styles.badge, !hasActiveConsent && styles.badgeWarn]}>
            <AppIcon name={hasActiveConsent ? "shield" : "alert"} size={13} color={hasActiveConsent ? C.forest : "#B45309"} />
            <Text style={[styles.badgeText, !hasActiveConsent && { color: "#B45309" }]}>
              {hasActiveConsent && consent
                ? `${en ? "Given" : "ನೀಡಲಾಗಿದೆ"} · v${consent.consentVersion}`
                : consent?.status === "withdrawn"
                ? en ? "Withdrawn" : "ಹಿಂಪಡೆಯಲಾಗಿದೆ"
                : en ? "Not given" : "ನೀಡಿಲ್ಲ"}
            </Text>
          </View>
        </View>
        {hasActiveConsent && consent ? (
          <>
            <Row label={en ? "Signed by" : "ಸಹಿ"} value={`${consent.signerName} (${consent.signerRelation})`} />
            <Row
              label={en ? "Date" : "ದಿನಾಂಕ"}
              value={new Date(consent.acceptedAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            />
            <ButtonRow style={{ marginTop: 10 }}>
              <FlowButton
                variant="secondary"
                label={en ? "View" : "ನೋಡಿ"}
                onPress={() => router.push({ pathname: "/consent", params: { viewOnly: "true" } })}
              />
              <FlowButton variant="secondary" label={en ? "Withdraw" : "ಹಿಂಪಡೆಯಿರಿ"} onPress={handleWithdraw} />
            </ButtonRow>
          </>
        ) : (
          <>
            <Text style={[flowStyles.bodyText, { marginBottom: 10 }]}>
              {en
                ? "Assessments are locked until a parent, guardian or the student gives consent."
                : "ಸಮ್ಮತಿ ನೀಡುವವರೆಗೆ ಮೌಲ್ಯಮಾಪನಗಳು ಲಾಕ್ ಆಗಿರುತ್ತವೆ."}
            </Text>
            <FlowButton
              label={en ? "Give consent" : "ಸಮ್ಮತಿ ನೀಡಿ"}
              icon="chevron-forward"
              onPress={() => router.push("/consent")}
            />
          </>
        )}
      </Card>

      {/* Device data */}
      <SectionTitle title={en ? "Data on this phone" : "ಈ ಫೋನ್‌ನಲ್ಲಿನ ಡೇಟಾ"} />
      <Card>
        <Text style={[flowStyles.bodyText, { marginBottom: 10 }]}>
          {en
            ? "Remove this student's recordings, photos and answers from this phone. Uploaded copies are handled by the research team."
            : "ಈ ವಿದ್ಯಾರ್ಥಿಯ ರೆಕಾರ್ಡಿಂಗ್, ಫೋಟೋ ಮತ್ತು ಉತ್ತರಗಳನ್ನು ಈ ಫೋನ್‌ನಿಂದ ಅಳಿಸಿ."}
        </Text>
        <FlowButton
          variant="secondary"
          label={en ? "Delete my data from this phone" : "ಈ ಫೋನ್‌ನಿಂದ ನನ್ನ ಡೇಟಾ ಅಳಿಸಿ"}
          icon="trash"
          disabled={attemptCount === 0}
          onPress={handleDelete}
        />
      </Card>

      {/* About */}
      <SectionTitle title={en ? "About this app" : "ಈ ಆ್ಯಪ್ ಬಗ್ಗೆ"} />
      <Card>
        <Engine icon="mic" label={en ? "Speech recognition" : "ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ"} status={en ? "Preview (simulated)" : "ಪೂರ್ವವೀಕ್ಷಣೆ"} />
        <Engine icon="doc" label={en ? "Handwriting reading (OCR)" : "ಕೈಬರಹ ಓದುವಿಕೆ (OCR)"} status={en ? "Preview (sample text)" : "ಪೂರ್ವವೀಕ್ಷಣೆ"} />
        <Engine icon="sparkles" label={en ? "Feedback" : "ಪ್ರತಿಕ್ರಿಯೆ"} status={en ? "On-device rules" : "ಸಾಧನದ ನಿಯಮಗಳು"} />
        <Engine
          icon="cloud-check"
          label={en ? "Research server" : "ಸಂಶೋಧನಾ ಸರ್ವರ್"}
          status={sync.serverConfigured ? (en ? "Connected" : "ಸಂಪರ್ಕಿತ") : en ? "Not set up" : "ಹೊಂದಿಸಿಲ್ಲ"}
        />
        <Text style={[flowStyles.muted, { marginTop: 8 }]}>
          {`Version ${config.appVersion} · Consent v${config.consentVersion}`}
        </Text>
      </Card>

      <TouchableOpacity onPress={handleLogout} style={styles.logout} accessibilityRole="button">
        <AppIcon name="logout" size={15} color="#B91C1C" />
        <Text style={styles.logoutText}>{en ? "Sign out" : "ಸೈನ್ ಔಟ್"}</Text>
      </TouchableOpacity>
      <Text style={[flowStyles.muted, { textAlign: "center", marginTop: 6 }]}>
        {en
          ? "Signing out keeps your saved work. Another student can then sign in on this phone."
          : "ಸೈನ್ ಔಟ್ ಮಾಡಿದರೂ ಕೆಲಸ ಉಳಿಯುತ್ತದೆ. ಬೇರೆ ವಿದ್ಯಾರ್ಥಿ ಸೈನ್ ಇನ್ ಮಾಡಬಹುದು."}
      </Text>
    </TabScreen>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.meta, wide && { flex: 2 }]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Storage({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.storageBox}>
      <Text style={styles.storageValue}>{value}</Text>
      <Text style={styles.storageLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Engine({ icon, label, status }: { icon: IconName; label: string; status: string }) {
  return (
    <View style={styles.engine}>
      <AppIcon name={icon} size={15} color={C.muted} />
      <Text style={styles.engineLabel}>{label}</Text>
      <Text style={styles.engineStatus}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  studentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.white, fontSize: 18, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "800", color: C.forest },
  idChip: {
    alignSelf: "flex-start",
    backgroundColor: C.mint,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  idChipText: { fontSize: 11.5, fontWeight: "700", color: C.forest },
  metaGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  meta: { flex: 1, backgroundColor: C.cream, borderRadius: 10, padding: 10 },
  metaLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },
  metaValue: { fontSize: 13.5, color: "#1C3A30", fontWeight: "700", marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start" },
  linkText: { fontSize: 13, fontWeight: "700", color: C.forest },
  syncHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  syncTitle: { fontSize: 14.5, fontWeight: "800", color: C.forest },
  storageRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  storageBox: { flex: 1, backgroundColor: C.cream, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  storageValue: { fontSize: 17, fontWeight: "800", color: C.forest },
  storageLabel: { fontSize: 10.5, color: C.muted, marginTop: 2, textAlign: "center" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginBottom: 10,
  },
  switchTitle: { fontSize: 13.5, fontWeight: "700", color: "#1C3A30" },
  consentHead: { flexDirection: "row", marginBottom: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.mint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeWarn: { backgroundColor: "#FEF3C7" },
  badgeText: { fontSize: 12, fontWeight: "800", color: C.forest },
  row: { flexDirection: "row", paddingVertical: 4 },
  rowLabel: { width: 84, fontSize: 12.5, color: C.muted },
  rowValue: { flex: 1, fontSize: 12.5, fontWeight: "600", color: "#1C3A30" },
  engine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  engineLabel: { flex: 1, fontSize: 13, color: "#1C3A30" },
  engineStatus: { fontSize: 11.5, fontWeight: "700", color: C.muted },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#F5C2C2",
    backgroundColor: "#FFF5F5",
    marginTop: 6,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  logoutText: { fontSize: 14, fontWeight: "700", color: "#B91C1C" },
});
