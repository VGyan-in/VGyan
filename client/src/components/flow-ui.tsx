import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppIcon, IconName } from "@/components/ui/app-icon";
import { useApp } from "@/state/app-store";

export const C = {
  forest: "#0B3D2E",
  cream: "#FAF6EF",
  border: "#E2ECE6",
  mint: "#EAF3EF",
  muted: "#688478",
  body: "#4E6D61",
  white: "#FFFFFF",
  amber: "#D97706",
  red: "#DC2626",
  blue: "#2563EB",
  green: "#10B981",
};

interface FlowScreenProps {
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  hideBack?: boolean;
  scroll?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Shell for reading/writing flow screens: back arrow, title, language pill, step bar, sticky footer. */
export function FlowScreen({
  title,
  subtitle,
  step,
  totalSteps,
  onBack,
  hideBack,
  scroll = true,
  footer,
  children,
}: FlowScreenProps) {
  const router = useRouter();
  const { lang, toggleLang } = useApp();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenWrapper}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            {!hideBack ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleBack}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <AppIcon name="arrow-back" size={18} color={C.forest} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backPlaceholder} />
            )}
            <View style={styles.titleBlock}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleLang}
              style={styles.langPill}
              accessibilityRole="button"
              accessibilityLabel="Switch language"
            >
              <AppIcon name="globe" size={13} color={C.forest} />
              <Text style={styles.langPillText}>{lang === "en" ? "ಕನ್ನಡ" : "EN"}</Text>
            </TouchableOpacity>
          </View>

          {step && totalSteps ? (
            <View style={styles.stepTrack}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View key={i} style={[styles.stepSeg, i < step && styles.stepSegActive]} />
              ))}
            </View>
          ) : null}

          {scroll ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.scrollContent, { flex: 1 }]}>{children}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </View>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FlowButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  loading,
  style,
}: ButtonProps) {
  const fg = variant === "secondary" ? C.forest : C.white;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "danger" && styles.btnDanger,
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
          {icon ? <AppIcon name={icon} size={14} color={fg} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

interface OptionCardProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  badge?: string;
  selected?: boolean;
  onPress: () => void;
}

export function OptionCard({ title, subtitle, icon, badge, selected, onPress }: OptionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      {icon ? (
        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
          <AppIcon name={icon} size={18} color={selected ? C.white : C.forest} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <View style={styles.optionTitleRow}>
          <Text style={styles.optionTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  color = C.forest,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={styles.metricTile}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreLine}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{value}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
      </View>
    </View>
  );
}

export function Notice({
  text,
  tone = "info",
}: {
  text: string;
  tone?: "info" | "warn" | "error";
}) {
  const color = tone === "error" ? C.red : tone === "warn" ? C.amber : C.forest;
  return (
    <View
      style={[
        styles.notice,
        tone === "warn" && { backgroundColor: "#FEF6E7", borderColor: "#F6DFB0" },
        tone === "error" && { backgroundColor: "#FDECEC", borderColor: "#F5C2C2" },
      ]}
    >
      <AppIcon name={tone === "info" ? "sparkles" : "alert"} size={14} color={color} />
      <Text style={[styles.noticeText, { color }]}>{text}</Text>
    </View>
  );
}

export const flowStyles = StyleSheet.create({
  bodyText: { fontSize: 13, color: C.body, lineHeight: 19 },
  muted: { fontSize: 11.5, color: C.muted },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  footerRow: { flexDirection: "row", gap: 10 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  screenWrapper: { width: "100%", height: "100%", maxWidth: 480, backgroundColor: C.cream },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  backPlaceholder: { width: 36, height: 36 },
  titleBlock: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: C.forest },
  headerSubtitle: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE9E2",
    gap: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  langPillText: { color: C.forest, fontSize: 11.5, fontWeight: "700" },
  stepTrack: { flexDirection: "row", gap: 4, paddingHorizontal: 20, paddingTop: 10 },
  stepSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#DCE9E2" },
  stepSegActive: { backgroundColor: C.forest },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.cream,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  btnSecondary: { backgroundColor: C.white, borderWidth: 1, borderColor: "#CFE0D7" },
  btnDanger: { backgroundColor: C.red },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 14, fontWeight: "700" },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: C.forest },
  sectionRight: { fontSize: 11.5, color: C.muted },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 10,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  optionSelected: { borderColor: C.forest, backgroundColor: "#F6FBF8" },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconSelected: { backgroundColor: C.forest },
  optionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  optionTitle: { fontSize: 14.5, fontWeight: "800", color: C.forest },
  optionSubtitle: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 16 },
  badge: { backgroundColor: C.mint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: "700", color: C.forest },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#B9CEC3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: C.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.forest },
  metricTile: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  metricValue: { fontSize: 20, fontWeight: "800" },
  metricLabel: { fontSize: 11, color: C.muted, marginTop: 2, textAlign: "center" },
  metricSub: { fontSize: 10, color: C.muted, marginTop: 1 },
  scoreLine: { marginBottom: 12 },
  scoreHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  scoreLabel: { fontSize: 12.5, fontWeight: "600", color: "#164A3D" },
  scoreValue: { fontSize: 12.5, fontWeight: "800", color: C.forest },
  track: { height: 7, borderRadius: 4, backgroundColor: "#EAF0EC", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: C.forest },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.mint,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D3E5DB",
    padding: 10,
    marginBottom: 12,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" },
});
