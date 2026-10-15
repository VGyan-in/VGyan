import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { FlowButton, FlowScreen, flowStyles } from "@/components/flow-ui";
import { Chips, Field, FormError } from "@/components/form-ui";
import { useGoHome } from "@/hooks/use-go-home";
import { useApp } from "@/state/app-store";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/**
 * Student background details recorded with every assessment (README §8 profile).
 * Shown once after registration and consent; reachable later from Profile to edit.
 */
export default function ProfileSetupScreen() {
  const router = useRouter();
  const goHome = useGoHome();
  const { lang, profile, updateProfile } = useApp();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === "edit";
  const en = lang === "en";

  const [grade, setGrade] = useState(profile?.grade ?? "");
  const [section, setSection] = useState(profile?.section ?? "");
  const [school, setSchool] = useState(profile?.school ?? "");
  const [schoolType, setSchoolType] = useState(profile?.schoolType ?? "");
  const [medium, setMedium] = useState(profile?.medium ?? "");
  const [nativeLanguage, setNativeLanguage] = useState(profile?.nativeLanguage ?? "");
  const [otherLanguages, setOtherLanguages] = useState(profile?.otherLanguages ?? "");
  const [ageGroup, setAgeGroup] = useState(profile?.ageGroup ?? "");
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!profile) return <Redirect href="/" />;

  const errors = {
    grade: !grade ? (en ? "Choose a class" : "ತರಗತಿ ಆರಿಸಿ") : null,
    school: school.trim().length < 2 ? (en ? "Enter the school name" : "ಶಾಲೆಯ ಹೆಸರು ನಮೂದಿಸಿ") : null,
  };
  const valid = !errors.grade && !errors.school;

  const save = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    await updateProfile({
      grade,
      section: section.trim().toUpperCase(),
      school: school.trim(),
      schoolType,
      medium,
      nativeLanguage,
      otherLanguages: otherLanguages.trim(),
      ageGroup,
      gender,
    });
    setBusy(false);
    if (editing && router.canGoBack()) router.back();
    else goHome();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlowScreen
        title={editing ? (en ? "Edit Details" : "ವಿವರ ತಿದ್ದಿ") : en ? "About You" : "ನಿಮ್ಮ ಬಗ್ಗೆ"}
        subtitle={profile.participantId}
        hideBack={!editing}
        footer={
          <View>
            <FormError
              text={touched && !valid ? (en ? "Please choose a class and enter the school name." : "ತರಗತಿ ಆರಿಸಿ ಮತ್ತು ಶಾಲೆಯ ಹೆಸರು ನಮೂದಿಸಿ.") : null}
            />
            <FlowButton
              label={editing ? (en ? "Save" : "ಉಳಿಸಿ") : en ? "Continue" : "ಮುಂದುವರಿಸಿ"}
              icon="check"
              loading={busy}
              onPress={save}
            />
          </View>
        }
      >
        <Text style={[flowStyles.bodyText, { marginBottom: 16 }]}>
          {en
            ? "These details help researchers understand results. Only your participant ID is shared with them, not your name."
            : "ಈ ವಿವರಗಳು ಸಂಶೋಧಕರಿಗೆ ಫಲಿತಾಂಶ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಹಾಯ ಮಾಡುತ್ತವೆ. ನಿಮ್ಮ ಹೆಸರಲ್ಲ, ಐಡಿ ಮಾತ್ರ ಹಂಚಲಾಗುತ್ತದೆ."}
        </Text>

        <Chips
          label={en ? "Class" : "ತರಗತಿ"}
          options={GRADES.map((g) => ({ value: g, label: g }))}
          value={grade}
          onChange={setGrade}
          error={touched ? errors.grade : null}
        />
        <Field
          label={en ? "Section" : "ವಿಭಾಗ"}
          optionalLabel={en ? "Optional" : "ಐಚ್ಛಿಕ"}
          placeholder="A"
          value={section}
          onChangeText={setSection}
          autoCapitalize="characters"
          maxLength={4}
        />
        <Field
          label={en ? "School name" : "ಶಾಲೆಯ ಹೆಸರು"}
          placeholder={en ? "e.g. Govt Higher Primary School, Dharwad" : "ಉದಾ. ಸರ್ಕಾರಿ ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆ"}
          value={school}
          onChangeText={setSchool}
          autoCapitalize="words"
          error={touched ? errors.school : null}
        />
        <Chips
          label={en ? "School type" : "ಶಾಲೆಯ ಪ್ರಕಾರ"}
          options={[
            { value: "government", label: en ? "Government" : "ಸರ್ಕಾರಿ" },
            { value: "aided", label: en ? "Aided" : "ಅನುದಾನಿತ" },
            { value: "private", label: en ? "Private" : "ಖಾಸಗಿ" },
          ]}
          value={schoolType}
          onChange={setSchoolType}
        />
        <Chips
          label={en ? "Medium of instruction" : "ಬೋಧನಾ ಮಾಧ್ಯಮ"}
          options={[
            { value: "kannada", label: en ? "Kannada" : "ಕನ್ನಡ" },
            { value: "english", label: en ? "English" : "ಇಂಗ್ಲಿಷ್" },
            { value: "bilingual", label: en ? "Both" : "ಎರಡೂ" },
          ]}
          value={medium}
          onChange={setMedium}
        />
        <Chips
          label={en ? "Language spoken at home" : "ಮನೆಯಲ್ಲಿ ಮಾತನಾಡುವ ಭಾಷೆ"}
          options={[
            { value: "kannada", label: en ? "Kannada" : "ಕನ್ನಡ" },
            { value: "english", label: en ? "English" : "ಇಂಗ್ಲಿಷ್" },
            { value: "hindi", label: en ? "Hindi" : "ಹಿಂದಿ" },
            { value: "urdu", label: en ? "Urdu" : "ಉರ್ದು" },
            { value: "other", label: en ? "Other" : "ಇತರೆ" },
          ]}
          value={nativeLanguage}
          onChange={setNativeLanguage}
        />
        <Field
          label={en ? "Other languages you know" : "ನಿಮಗೆ ತಿಳಿದಿರುವ ಇತರ ಭಾಷೆಗಳು"}
          optionalLabel={en ? "Optional" : "ಐಚ್ಛಿಕ"}
          placeholder={en ? "e.g. Marathi, Telugu" : "ಉದಾ. ಮರಾಠಿ, ತೆಲುಗು"}
          value={otherLanguages}
          onChangeText={setOtherLanguages}
        />
        <Chips
          label={en ? "Age" : "ವಯಸ್ಸು"}
          options={["6-8", "8-10", "10-12", "12-14", "14-16"].map((a) => ({
            value: a,
            label: `${a}${en ? " yrs" : ""}`,
          }))}
          value={ageGroup}
          onChange={setAgeGroup}
        />
        <Chips
          label={en ? "Gender" : "ಲಿಂಗ"}
          options={[
            { value: "girl", label: en ? "Girl" : "ಹುಡುಗಿ" },
            { value: "boy", label: en ? "Boy" : "ಹುಡುಗ" },
            { value: "not-say", label: en ? "Prefer not to say" : "ಹೇಳಲು ಇಷ್ಟವಿಲ್ಲ" },
          ]}
          value={gender}
          onChange={setGender}
        />
      </FlowScreen>
    </KeyboardAvoidingView>
  );
}
