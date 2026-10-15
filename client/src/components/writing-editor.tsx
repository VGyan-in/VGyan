import React, { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { C } from "@/components/flow-ui";
import type { AssessmentLanguage, Lang } from "@/constants/content";
import { countSentences, countWords } from "@/features/writing/metrics";

interface WritingEditorProps {
  value: string;
  onChange: (text: string) => void;
  language: AssessmentLanguage;
  minWords: number;
  lang: Lang;
  placeholder?: string;
  minHeight?: number;
}

/** Multiline answer box with live word and sentence counts. */
export function WritingEditor({
  value,
  onChange,
  language,
  minWords,
  lang,
  placeholder,
  minHeight = 240,
}: WritingEditorProps) {
  const [focused, setFocused] = useState(false);
  const words = countWords(value);
  const sentences = countSentences(value);
  const reached = words >= minWords;

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor="#9DB3A8"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="sentences"
        style={[
          styles.input,
          { minHeight },
          language === "Kannada" && styles.inputKannada,
          focused && styles.inputFocused,
        ]}
        accessibilityLabel={lang === "en" ? "Your answer" : "ನಿಮ್ಮ ಉತ್ತರ"}
      />
      <View style={styles.countRow}>
        <Text style={[styles.count, reached && { color: C.forest }]}>
          {words} / {minWords} {lang === "en" ? "words" : "ಪದಗಳು"}
        </Text>
        <Text style={styles.count}>
          {sentences} {lang === "en" ? (sentences === 1 ? "sentence" : "sentences") : "ವಾಕ್ಯಗಳು"}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, (words / minWords) * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
    color: "#1C3A30",
    ...Platform.select({ web: { outlineStyle: "none" } as object }),
  },
  inputKannada: { fontSize: 17, lineHeight: 28 },
  inputFocused: { borderColor: C.forest },
  countRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 5 },
  count: { fontSize: 12, fontWeight: "700", color: C.muted },
  track: { height: 5, borderRadius: 3, backgroundColor: "#EAF0EC", overflow: "hidden", marginBottom: 12 },
  fill: { height: "100%", backgroundColor: C.forest, borderRadius: 3 },
});
