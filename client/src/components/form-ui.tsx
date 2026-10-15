import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { AppIcon } from "@/components/ui/app-icon";
import { C } from "@/components/flow-ui";

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  hint?: string;
  error?: string | null;
  optionalLabel?: string;
  secure?: boolean;
}

/** Labelled text input with focus ring, inline error, and an optional show/hide toggle. */
export function Field({ label, hint, error, optionalLabel, secure, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optionalLabel ? <Text style={styles.optional}>{optionalLabel}</Text> : null}
      </View>
      <View style={[styles.inputBox, focused && styles.inputFocused, !!error && styles.inputError]}>
        <TextInput
          {...input}
          secureTextEntry={secure ? hidden : undefined}
          placeholderTextColor="#94AA9F"
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={styles.input}
          accessibilityLabel={label}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={styles.eye}
          >
            <AppIcon name={hidden ? "eye" : "eye-off"} size={18} color={C.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface ChipsProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
  error?: string | null;
}

/** Single-choice chips, for short closed lists (class, gender, medium…). */
/** One-line message shown next to a form's submit button when fields need fixing. */
export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return <Text style={[styles.errorText, styles.formError]}>{text}</Text>;
}

export function Chips<T extends string>({ label, options, value, onChange, error }: ChipsProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipWrap} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              activeOpacity={0.8}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  label: { fontSize: 13.5, fontWeight: "700", color: "#1C3A30", marginBottom: 6 },
  optional: {
    fontSize: 11,
    fontWeight: "600",
    color: C.muted,
    backgroundColor: C.mint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D8E5DE",
    backgroundColor: C.white,
    paddingHorizontal: 14,
  },
  inputFocused: { borderColor: C.forest },
  inputError: { borderColor: C.red },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 15.5,
    color: "#1C3A30",
    ...Platform.select({ web: { outlineStyle: "none" } as object }),
  },
  eye: { paddingLeft: 10 },
  hint: { fontSize: 12, color: C.muted, marginTop: 5 },
  errorText: { fontSize: 12, color: C.red, marginTop: 5, fontWeight: "600" },
  formError: { textAlign: "center", marginTop: 0, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 44,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#D8E5DE",
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  chipSelected: { backgroundColor: C.forest, borderColor: C.forest },
  chipText: { fontSize: 13.5, fontWeight: "600", color: "#1C3A30" },
  chipTextSelected: { color: C.white },
});
