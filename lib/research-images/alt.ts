import type { ActivityId, ApproximateAge, ResearchVisualPlan, VisualBrief } from "./types";

const ENGLISH_ACTION: Record<ActivityId, string> = {
  cycling: "performing a short stationary cycling session",
  "stair-climbing": "climbing stairs during a brief bout of physical activity",
  walking: "taking a short walk",
  resistance: "performing a short resistance exercise",
  "sedentary-interruption": "standing up from a desk for a short movement break",
  vilpa: "doing a brief burst of vigorous everyday movement",
  "exercise-snack": "performing a short bout of exercise",
  "general-activity": "doing a short bout of physical activity",
};

const HEBREW_ACTION: Record<ActivityId, { masculine: string; feminine: string; plural: string }> = {
  cycling: {
    masculine: "המבצע רכיבה קצרה על אופני כושר",
    feminine: "המבצעת רכיבה קצרה על אופני כושר",
    plural: "המבצעים רכיבה קצרה על אופני כושר",
  },
  "stair-climbing": {
    masculine: "העולה במדרגות במהלך פעילות גופנית קצרה",
    feminine: "העולה במדרגות במהלך פעילות גופנית קצרה",
    plural: "העולים במדרגות במהלך פעילות גופנית קצרה",
  },
  walking: {
    masculine: "היוצא להליכה קצרה",
    feminine: "היוצאת להליכה קצרה",
    plural: "היוצאים להליכה קצרה",
  },
  resistance: {
    masculine: "המבצע תרגיל התנגדות קצר",
    feminine: "המבצעת תרגיל התנגדות קצר",
    plural: "המבצעים תרגיל התנגדות קצר",
  },
  "sedentary-interruption": {
    masculine: "הקם מהשולחן להפסקת תנועה קצרה",
    feminine: "הקמה מהשולחן להפסקת תנועה קצרה",
    plural: "הקמים מהשולחן להפסקת תנועה קצרה",
  },
  vilpa: {
    masculine: "המבצע פרץ קצר של תנועה נמרצת ביום-יום",
    feminine: "המבצעת פרץ קצר של תנועה נמרצת ביום-יום",
    plural: "המבצעים פרץ קצר של תנועה נמרצת ביום-יום",
  },
  "exercise-snack": {
    masculine: "המבצע מקטע אימון קצר",
    feminine: "המבצעת מקטע אימון קצר",
    plural: "המבצעים מקטע אימון קצר",
  },
  "general-activity": {
    masculine: "המבצע פעילות גופנית קצרה",
    feminine: "המבצעת פעילות גופנית קצרה",
    plural: "המבצעים פעילות גופנית קצרה",
  },
};

const ENGLISH_NONE: Record<ActivityId, string> = {
  cycling: "Illustration of a stationary bike prepared for a short cycling session, with no person in the frame.",
  "stair-climbing": "Illustration of a staircase prepared for a brief bout of stair climbing, with no person in the frame.",
  walking: "Illustration of a walking path prepared for a short walk, with no person in the frame.",
  resistance: "Illustration of space prepared for a short resistance exercise, with no person in the frame.",
  "sedentary-interruption": "Illustration of a workstation prepared for a short movement break, with no person in the frame.",
  vilpa: "Illustration of an everyday place prepared for a brief burst of vigorous movement, with no person in the frame.",
  "exercise-snack": "Illustration of a simple space prepared for a short bout of exercise, with no person in the frame.",
  "general-activity": "Illustration of a simple space prepared for a short bout of physical activity, with no person in the frame.",
};

const HEBREW_NONE: Record<ActivityId, string> = {
  cycling: "איור של אופני כושר המוכנים לרכיבה קצרה, ללא אדם בתמונה.",
  "stair-climbing": "איור של גרם מדרגות לפעילות קצרה של עליית מדרגות, ללא אדם בתמונה.",
  walking: "איור של שביל הליכה לפעילות הליכה קצרה, ללא אדם בתמונה.",
  resistance: "איור של מרחב לתרגיל התנגדות קצר, ללא אדם בתמונה.",
  "sedentary-interruption": "איור של עמדת עבודה להפסקת תנועה קצרה, ללא אדם בתמונה.",
  vilpa: "איור של סביבה יומיומית לפרץ קצר של תנועה נמרצת, ללא אדם בתמונה.",
  "exercise-snack": "איור של סביבה למקטע אימון קצר, ללא אדם בתמונה.",
  "general-activity": "איור של סביבה לפעילות גופנית קצרה, ללא אדם בתמונה.",
};

/** Localized alt from the visual plan. One sentence, describing only what is visible. */
export function buildResearchImageAlt(brief: VisualBrief, language: "en" | "he"): string {
  return language === "he" ? hebrewAlt(brief.plan, brief.activity) : englishAlt(brief.plan, brief.activity);
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

function englishAlt(plan: ResearchVisualPlan, activity: ActivityId): string {
  if (plan.subjectCount === "none" || plan.subjectPresentation === "none") return ENGLISH_NONE[activity];
  return `Illustration of ${englishSubject(plan)} ${ENGLISH_ACTION[activity]}.`;
}

function englishSubject(plan: ResearchVisualPlan): string {
  const older = plan.approximateAge === "older";
  const young = plan.approximateAge === "young-adult";
  if (plan.subjectCount === "group" || plan.subjectPresentation === "small-group") {
    if (plan.subjectPresentation === "male") return older ? "a small group of older men" : young ? "a small group of young men" : "a small group of men";
    if (plan.subjectPresentation === "female") {
      return older ? "a small group of older women" : young ? "a small group of young women" : "a small group of women";
    }
    return older ? "a small group of older adults" : young ? "a small group of young adults" : "a small group of adults";
  }
  if (plan.subjectCount === "two" || plan.subjectPresentation === "mixed-pair") {
    if (older) return "an older man and an older woman";
    if (young) return "a young man and a young woman";
    return "two adults";
  }
  if (plan.subjectPresentation === "male") {
    if (older) return "an older man";
    if (young) return "a young man";
    return "a man";
  }
  if (plan.subjectPresentation === "female") {
    if (older) return "an older woman";
    if (young) return "a young woman";
    return "a woman";
  }
  if (older) return "an older adult";
  if (young) return "a young adult";
  return "a person";
}

function hebrewAlt(plan: ResearchVisualPlan, activity: ActivityId): string {
  if (plan.subjectCount === "none" || plan.subjectPresentation === "none") return HEBREW_NONE[activity];
  const verb = hebrewVerb(plan, activity);
  return `איור של ${hebrewSubject(plan)} ${verb}.`;
}

function hebrewVerb(plan: ResearchVisualPlan, activity: ActivityId): string {
  const actions = HEBREW_ACTION[activity];
  if (plan.subjectCount === "two" || plan.subjectCount === "group" || plan.subjectPresentation === "mixed-pair" || plan.subjectPresentation === "small-group") {
    return actions.plural;
  }
  if (plan.subjectPresentation === "female") return actions.feminine;
  return actions.masculine;
}

function hebrewSubject(plan: ResearchVisualPlan): string {
  const age = plan.approximateAge;
  if (plan.subjectCount === "group" || plan.subjectPresentation === "small-group") {
    if (plan.subjectPresentation === "male") return age === "older" ? "קבוצה קטנה של גברים מבוגרים" : age === "young-adult" ? "קבוצה קטנה של גברים צעירים" : "קבוצה קטנה של גברים";
    if (plan.subjectPresentation === "female") {
      return age === "older" ? "קבוצה קטנה של נשים מבוגרות" : age === "young-adult" ? "קבוצה קטנה של נשים צעירות" : "קבוצה קטנה של נשים";
    }
    return age === "older" ? "קבוצה קטנה של אנשים מבוגרים" : age === "young-adult" ? "קבוצה קטנה של צעירים" : "קבוצה קטנה של אנשים";
  }
  if (plan.subjectCount === "two" || plan.subjectPresentation === "mixed-pair") {
    if (age === "older") return "גבר מבוגר ואישה מבוגרת";
    if (age === "young-adult") return "גבר צעיר ואישה צעירה";
    return "גבר ואישה";
  }
  if (plan.subjectPresentation === "male") return agedHebrew("גבר", "גבר מבוגר", "גבר צעיר", age);
  if (plan.subjectPresentation === "female") return agedHebrew("אישה", "אישה מבוגרת", "אישה צעירה", age);
  return agedHebrew("אדם", "אדם מבוגר", "אדם צעיר", age);
}

function agedHebrew(adult: string, older: string, young: string, age: ApproximateAge): string {
  if (age === "older") return older;
  if (age === "young-adult") return young;
  return adult;
}
