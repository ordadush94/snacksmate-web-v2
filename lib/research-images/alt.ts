import type { ActivityId, PopulationId, VisualBrief } from "./types";

const ENGLISH_SUBJECT: Record<PopulationId, string> = {
  "older-adult": "an older adult",
  "young-adult": "a young adult",
  adult: "a person",
  unspecified: "a person",
};

const HEBREW_SUBJECT: Record<PopulationId, string> = {
  "older-adult": "אדם מבוגר",
  "young-adult": "אדם צעיר",
  adult: "אדם",
  unspecified: "אדם",
};

const ENGLISH_ACTION: Record<ActivityId, string> = {
  cycling: "performing a short stationary cycling session",
  "stair-climbing": "moving briskly up a flight of stairs",
  walking: "taking a short walk",
  resistance: "performing a short resistance exercise",
  "sedentary-interruption": "standing up from a desk for a short movement break",
  vilpa: "doing a brief burst of vigorous everyday movement",
  "exercise-snack": "performing a short bout of exercise",
  "general-activity": "doing a short bout of physical activity",
};

const HEBREW_ACTION: Record<ActivityId, string> = {
  cycling: "המבצע רכיבה קצרה על אופני כושר",
  "stair-climbing": "העולה במרץ במדרגות",
  walking: "היוצא להליכה קצרה",
  resistance: "המבצע תרגיל התנגדות קצר",
  "sedentary-interruption": "הקם מהשולחן להפסקת תנועה קצרה",
  vilpa: "המבצע פרץ קצר של תנועה נמרצת ביום-יום",
  "exercise-snack": "המבצע מקטע אימון קצר",
  "general-activity": "המבצע פעילות גופנית קצרה",
};

/** Localized alt from the visual brief. One sentence, describing only what is visible. */
export function buildResearchImageAlt(brief: VisualBrief, language: "en" | "he"): string {
  if (language === "he") {
    return `איור של ${HEBREW_SUBJECT[brief.population]} ${HEBREW_ACTION[brief.activity]}.`;
  }
  return `Illustration of ${ENGLISH_SUBJECT[brief.population]} ${ENGLISH_ACTION[brief.activity]}.`;
}

export function assertAltText(alt: string, language: "en" | "he", title?: string | null): void {
  const text = alt.trim();
  if (!text) throw new Error("ALT text is empty.");
  const studyTitle = title?.trim();
  if (studyTitle && text === studyTitle) {
    throw new Error("ALT text repeats the research title.");
  }
  if (language === "he") {
    if (!/[\u0590-\u05FF]/.test(text)) {
      throw new Error("Hebrew ALT must use Hebrew text.");
    }
    return;
  }
  if (!/[A-Za-z]/.test(text) || /[\u0590-\u05FF]/.test(text)) {
    throw new Error("English ALT must use English text.");
  }
}
