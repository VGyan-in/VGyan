export type Lang = "en" | "kn";
export type AssessmentLanguage = "English" | "Kannada";
export type Level = "Easy" | "Medium" | "Advanced";

export const LEVELS: Level[] = ["Easy", "Medium", "Advanced"];

export const levelLabel = (level: Level, lang: Lang) =>
  lang === "en"
    ? level
    : level === "Easy"
    ? "ಸುಲಭ"
    : level === "Medium"
    ? "ಮಧ್ಯಮ"
    : "ಕಠಿಣ";

export const languageLabel = (language: AssessmentLanguage, lang: Lang) =>
  lang === "en"
    ? language
    : language === "English"
    ? "ಇಂಗ್ಲಿಷ್"
    : "ಕನ್ನಡ";

export interface Passage {
  id: string;
  language: AssessmentLanguage;
  level: Level;
  title: string;
  kannadaTitle: string;
  text: string;
}

export interface WritingPrompt {
  id: string;
  language: AssessmentLanguage;
  prompt: string;
  kannadaPrompt: string;
  minWords: number;
  hint: string;
  kannadaHint: string;
}

/**
 * Bundled passages so reading works fully offline. When the backend serves
 * assignments, these become the fallback cache seed.
 */
export const PASSAGES: Passage[] = [
  {
    id: "P-EN-E1",
    language: "English",
    level: "Easy",
    title: "My Pet Cat",
    kannadaTitle: "ನನ್ನ ಸಾಕು ಬೆಕ್ಕು",
    text: "I have a pet cat. Her name is Minu. She is white and soft. Minu drinks milk every morning. She likes to sleep in the sun. I play with her after school. Minu is my best friend.",
  },
  {
    id: "P-EN-M1",
    language: "English",
    level: "Medium",
    title: "The Clever Crow",
    kannadaTitle: "ಜಾಣ ಕಾಗೆ",
    text: "One hot day, a thirsty crow flew all over the fields looking for water. At last he saw a pitcher under a tree. There was only a little water at the bottom. The crow could not reach it with his beak. He looked around and saw some pebbles. He dropped the pebbles into the pitcher one by one. Slowly the water rose to the top. The clever crow drank the water and flew away happily.",
  },
  {
    id: "P-EN-A1",
    language: "English",
    level: "Advanced",
    title: "The Honest Woodcutter",
    kannadaTitle: "ಪ್ರಾಮಾಣಿಕ ಮರಕಡಿಯುವವನು",
    text: "Long ago, a poor woodcutter lived near a dense forest. Every morning he walked to the river bank to cut wood for his family. One afternoon, his old iron axe slipped from his tired hands and disappeared into the deep water. As he sat weeping, a shining goddess rose from the river and offered him a golden axe. The woodcutter politely refused, explaining that it was not his. She then offered a silver axe, which he also declined. Finally she brought up his simple iron axe, and he accepted it gratefully. Pleased by his honesty, the goddess rewarded him with all three axes.",
  },
  {
    id: "P-KN-E1",
    language: "Kannada",
    level: "Easy",
    title: "ನನ್ನ ಶಾಲೆ (My School)",
    kannadaTitle: "ನನ್ನ ಶಾಲೆ",
    text: "ನನ್ನ ಶಾಲೆ ತುಂಬಾ ಸುಂದರವಾಗಿದೆ. ಶಾಲೆಯಲ್ಲಿ ದೊಡ್ಡ ಆಟದ ಮೈದಾನ ಇದೆ. ನಮ್ಮ ಶಿಕ್ಷಕರು ಒಳ್ಳೆಯವರು. ನಾನು ಪ್ರತಿದಿನ ಶಾಲೆಗೆ ಹೋಗುತ್ತೇನೆ. ನನಗೆ ಅನೇಕ ಸ್ನೇಹಿತರು ಇದ್ದಾರೆ.",
  },
  {
    id: "P-KN-M1",
    language: "Kannada",
    level: "Medium",
    title: "ಮಳೆ ಮತ್ತು ರೈತ (Rain & Farmer)",
    kannadaTitle: "ಮಳೆ ಮತ್ತು ರೈತ",
    text: "ಒಂದು ಹಳ್ಳಿಯಲ್ಲಿ ಒಬ್ಬ ರೈತ ವಾಸಿಸುತ್ತಿದ್ದನು. ಅವನು ಪ್ರತಿದಿನ ಹೊಲದಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದನು. ಆ ವರ್ಷ ಮಳೆ ಬರಲಿಲ್ಲ. ರೈತನು ಆಕಾಶವನ್ನು ನೋಡಿ ಕಾಯುತ್ತಿದ್ದನು. ಒಂದು ದಿನ ಜೋರಾಗಿ ಮಳೆ ಸುರಿಯಿತು. ಹೊಲದಲ್ಲಿ ಬೆಳೆಗಳು ಹಸಿರಾಗಿ ಬೆಳೆದವು. ರೈತನ ಮನೆಯಲ್ಲಿ ಸಮೃದ್ಧಿ ತುಂಬಿತು.",
  },
  {
    id: "P-KN-A1",
    language: "Kannada",
    level: "Advanced",
    title: "ಪರಿಸರ ಸಂರಕ್ಷಣೆ (Saving Nature)",
    kannadaTitle: "ಪರಿಸರ ಸಂರಕ್ಷಣೆ",
    text: "ನಮ್ಮ ಸುತ್ತಲಿನ ಪರಿಸರವು ನಮ್ಮ ಜೀವನದ ಆಧಾರವಾಗಿದೆ. ಮರಗಳು ನಮಗೆ ಶುದ್ಧ ಗಾಳಿ, ನೆರಳು ಮತ್ತು ಹಣ್ಣುಗಳನ್ನು ನೀಡುತ್ತವೆ. ಆದರೆ ಮನುಷ್ಯರು ಕಾಡುಗಳನ್ನು ಕಡಿದು ನಗರಗಳನ್ನು ನಿರ್ಮಿಸುತ್ತಿದ್ದಾರೆ. ಇದರಿಂದ ಮಳೆ ಕಡಿಮೆಯಾಗುತ್ತಿದೆ ಮತ್ತು ಭೂಮಿಯ ತಾಪಮಾನ ಹೆಚ್ಚುತ್ತಿದೆ. ಪ್ರತಿಯೊಬ್ಬ ವಿದ್ಯಾರ್ಥಿಯೂ ಗಿಡಗಳನ್ನು ನೆಟ್ಟು, ನೀರನ್ನು ಉಳಿಸಿ, ಪ್ಲಾಸ್ಟಿಕ್ ಬಳಕೆಯನ್ನು ಕಡಿಮೆ ಮಾಡಬೇಕು.",
  },
];

export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: "W-EN-1",
    language: "English",
    prompt: "Describe your favorite festival and how your family celebrates it.",
    kannadaPrompt: "ನಿಮ್ಮ ನೆಚ್ಚಿನ ಹಬ್ಬ ಮತ್ತು ನಿಮ್ಮ ಕುಟುಂಬ ಅದನ್ನು ಹೇಗೆ ಆಚರಿಸುತ್ತದೆ ಎಂದು ವಿವರಿಸಿ.",
    minWords: 50,
    hint: "Write about the food, clothes, decorations and people.",
    kannadaHint: "ಆಹಾರ, ಬಟ್ಟೆ, ಅಲಂಕಾರ ಮತ್ತು ಜನರ ಬಗ್ಗೆ ಬರೆಯಿರಿ.",
  },
  {
    id: "W-EN-2",
    language: "English",
    prompt: "Write about a day you will never forget.",
    kannadaPrompt: "ನೀವು ಎಂದಿಗೂ ಮರೆಯದ ಒಂದು ದಿನದ ಬಗ್ಗೆ ಬರೆಯಿರಿ.",
    minWords: 50,
    hint: "Say where you were, who was with you and how you felt.",
    kannadaHint: "ನೀವು ಎಲ್ಲಿದ್ದಿರಿ, ಯಾರು ಜೊತೆಗಿದ್ದರು, ನಿಮಗೆ ಹೇಗೆ ಅನಿಸಿತು ಎಂದು ಹೇಳಿ.",
  },
  {
    id: "W-KN-1",
    language: "Kannada",
    prompt: "How can we protect our environment?",
    kannadaPrompt: "ನಮ್ಮ ಪರಿಸರವನ್ನು ಹೇಗೆ ಸಂರಕ್ಷಿಸಬಹುದು?",
    minWords: 40,
    hint: "Think about trees, water, and plastic.",
    kannadaHint: "ಮರಗಳು, ನೀರು ಮತ್ತು ಪ್ಲಾಸ್ಟಿಕ್ ಬಗ್ಗೆ ಯೋಚಿಸಿ.",
  },
  {
    id: "W-KN-2",
    language: "Kannada",
    prompt: "Write about your mother.",
    kannadaPrompt: "ನಿಮ್ಮ ತಾಯಿಯ ಬಗ್ಗೆ ಬರೆಯಿರಿ.",
    minWords: 40,
    hint: "What does she do every day? Why do you love her?",
    kannadaHint: "ಅವರು ಪ್ರತಿದಿನ ಏನು ಮಾಡುತ್ತಾರೆ? ನೀವು ಅವರನ್ನು ಏಕೆ ಪ್ರೀತಿಸುತ್ತೀರಿ?",
  },
];

export const findPassage = (language: AssessmentLanguage, level: Level) =>
  PASSAGES.find((p) => p.language === language && p.level === level) ??
  PASSAGES[0];

export const getPassage = (id: string | undefined) =>
  PASSAGES.find((p) => p.id === id);

export const getWritingPrompt = (id: string | undefined) =>
  WRITING_PROMPTS.find((p) => p.id === id);
