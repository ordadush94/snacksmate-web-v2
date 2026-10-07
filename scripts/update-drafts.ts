/**
 * Unpublished Snacksmate Update drafts.
 *
 * Public copy only states product behavior confirmed on the Snacksmate site,
 * the current marketing screenshots, or the public store listings. Unconfirmed
 * mechanics stay in translationReviewNote, which the public article page does
 * not render.
 *
 * Every id starts with drafts. Nothing in this module publishes a document.
 */

export type UpdateLanguage = "en" | "he";

export type UpdateBlock = {
  _key: string;
  _type: "block";
  style: "normal" | "h2";
  markDefs: Array<{ _key: string; _type: "link"; href: string }>;
  children: Array<{ _type: "span"; _key: string; text: string; marks: string[] }>;
};

export type UpdateDraft = {
  _id: string;
  _type: "article";
  title: string;
  slug: { _type: "slug"; current: string };
  language: UpdateLanguage;
  excerpt: string;
  body: UpdateBlock[];
  topic: "release" | "new-feature" | "product-update";
  author: "Snacksmate";
  /** Schema requires a datetime. This is not a confirmed public release date. */
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  translationSlug: string;
  translationSourceId?: string;
  translationStatus?: "needs_review";
  translationReviewNote: string;
};

type BlockInput =
  | { style: "h2" | "normal"; text: string }
  | { style: "normal"; before: string; label: string; href: string; after?: string };

/** Placeholder so Studio validation can preview a draft. Replace before publishing. */
export const UPDATE_DRAFT_PUBLISHED_AT = "2026-10-07T18:00:00.000Z";

const PUBLISHED_AT_NOTE =
  "publishedAt is set only because the Article schema requires a datetime for preview. It is not a confirmed public release date. Replace it before publishing.";

export const UPDATE_REVIEW_NOTES: Record<string, string> = {
  "snacksmate-2-0-whats-new": [
    PUBLISHED_AT_NOTE,
    "App Store version history lists 2.0.0 on 5 July 2026 and a later version, 3.1.1, with the same generic release notes. Do not publish this Update as the current app version or with a release date until a person confirms which version it describes.",
    "Ready-made examples (a short full-body snack, a strength snack, and a short interval snack) and the progress fields (weekly snack goal, current streak, best streak, sessions, time exercised, snacks earned) come from the current marketing screenshots, not from a 2.0 changelog.",
    "Activity level, goals, and exercise preferences are in the public site copy. Change Exercise, the timer, and visual guidance are on the workout screenshot.",
    "The draft does not claim an adaptive coach, automatic recommendations, a medical outcome, or feature parity between the App Store and Google Play.",
  ].join("\n"),
  "custom-exercise-snacks": [
    PUBLISHED_AT_NOTE,
    "A custom builder with snack name, description, work duration, rest duration, number of sets, and an exercise picker could not be confirmed in the website, screenshots, or store listings. Those fields were left out of the public text.",
    "The draft describes shaping one short session and the confirmed Change Exercise control on the workout screen. Confirm the actual custom-snack flow before publishing.",
    "This is not described as clinical personalization or a medical prescription.",
  ].join("\n"),
  "exercise-preferences": [
    PUBLISHED_AT_NOTE,
    "Public site copy confirms activity level, goals, and exercise preferences. The workout screenshot has Change Exercise. A dedicated screen for managing which exercises stay in the library was not found.",
    "The draft does not claim Snacksmate decides whether an exercise is medically safe. Confirm the exact preference controls before publishing.",
  ].join("\n"),
  "workout-effort-rating": [
    PUBLISHED_AT_NOTE,
    "The post-snack effort scale was not found in this repository, the marketing screenshots, or the store listings. The five labels are included from the content brief only.",
    "The draft does not say the rating is stored, shown in history, used by an algorithm, or used to change later snacks. Confirm the scale and that no downstream behavior should be described before publishing.",
    "Moderate and vigorous labels on ready-made snacks are visible on the home screenshot. The draft treats those as plan labels, separate from the effort rating.",
  ].join("\n"),
  "snacksmate-research-hub": [
    PUBLISHED_AT_NOTE,
    "Grounded in the public Research section: plain-language summaries, search, and filters for topic, study design, and year. DOI and the original-study link are kept when available.",
    "The public navigation label is Research / מחקרים. This Update calls that section the Research Hub. Confirm the public name before publishing.",
    "The draft does not claim that studies in the hub tested Snacksmate.",
  ].join("\n"),
};

const PAIRS = [
  {
    key: "snacksmate-2-0",
    translationSlug: "snacksmate-2-0-whats-new",
    topic: "release",
  },
  {
    key: "custom-exercise-snacks",
    translationSlug: "custom-exercise-snacks",
    topic: "new-feature",
  },
  {
    key: "exercise-preferences",
    translationSlug: "exercise-preferences",
    topic: "product-update",
  },
  {
    key: "workout-effort-rating",
    translationSlug: "workout-effort-rating",
    topic: "new-feature",
  },
  {
    key: "snacksmate-research-hub",
    translationSlug: "snacksmate-research-hub",
    topic: "product-update",
  },
] as const;

function blocks(parts: readonly BlockInput[]): UpdateBlock[] {
  return parts.map((part, index) => {
    if ("label" in part) {
      const linkKey = `l${index}`;
      const children = [
        { _key: `b${index}a`, _type: "span" as const, text: part.before, marks: [] },
        { _key: `b${index}b`, _type: "span" as const, text: part.label, marks: [linkKey] },
        { _key: `b${index}c`, _type: "span" as const, text: part.after ?? "", marks: [] },
      ].filter((child) => child.text.length > 0);
      return {
        _key: `b${index}`,
        _type: "block",
        style: "normal",
        markDefs: [{ _key: linkKey, _type: "link", href: part.href }],
        children,
      };
    }
    return {
      _key: `b${index}`,
      _type: "block",
      style: part.style,
      markDefs: [],
      children: [{ _key: `b${index}s`, _type: "span", text: part.text, marks: [] }],
    };
  });
}

function draft(input: {
  key: string;
  language: UpdateLanguage;
  title: string;
  excerpt: string;
  body: UpdateBlock[];
  seoTitle: string;
  seoDescription: string;
  topic: UpdateDraft["topic"];
  translationSlug: string;
}): UpdateDraft {
  const publishedId = `article-update-${input.key}-${input.language}`;
  const base: UpdateDraft = {
    _id: `drafts.${publishedId}`,
    _type: "article",
    title: input.title,
    slug: { _type: "slug", current: input.translationSlug },
    language: input.language,
    excerpt: input.excerpt,
    body: input.body,
    topic: input.topic,
    author: "Snacksmate",
    publishedAt: UPDATE_DRAFT_PUBLISHED_AT,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    translationSlug: input.translationSlug,
    translationReviewNote: UPDATE_REVIEW_NOTES[input.translationSlug] ?? PUBLISHED_AT_NOTE,
  };
  if (input.language === "he") {
    base.translationSourceId = `article-update-${input.key}-en`;
    base.translationStatus = "needs_review";
  }
  return base;
}

const englishBodies = {
  release: blocks([
    {
      style: "normal",
      text: "Snacksmate 2.0 is the next step in making short bouts of movement easier to fit into everyday life. The idea has not changed. An exercise snack is still a few focused minutes you can do at home, at work, or wherever you already are, usually without equipment and without clearing an hour in the day.",
    },
    { style: "h2", text: "What changed" },
    {
      style: "normal",
      text: "This version is a more complete Snacksmate, not a different product. Ready-made snacks are there when you want to start without planning a session. The home screen can offer a short full-body snack, a strength snack, or a short interval snack. Each one is a few minutes long, closer to a break than to a gym visit. More ready-made plans are on the way.",
    },
    {
      style: "normal",
      text: "The workout itself is easier to follow. You see the exercise, a short explanation of how to do it, and a timer. Visual guidance stays on screen while you move. You can pause, and you can change the exercise if the movement in front of you is not the right one for that moment.",
    },
    { style: "h2", text: "More personalization" },
    {
      style: "normal",
      text: "Snacksmate is built around your activity level, your goals, and your exercise preferences. The snack in front of you should feel closer to the time you have and the movements that work for you. If it does not, changing the exercise is part of the session, not a failure of it.",
    },
    {
      style: "normal",
      text: "That is practical personalization. It makes the next few minutes usable. It is not a medical plan, and Snacksmate does not decide whether an exercise is safe for your health.",
    },
    { style: "h2", text: "A better progress experience" },
    {
      style: "normal",
      text: "A short snack is easy to lose inside a busy day. Progress in Snacksmate keeps a simple record: your weekly snack goal, your current streak, your best streak, the sessions you have completed, the time you have spent moving, and the snacks you have earned. The weekly goal counts snacks. It does not ask you to find an hour.",
    },
    {
      style: "normal",
      text: "The point of the screen is that the minutes are visible. A handful of short sessions should look like what they are, not like a blank week.",
    },
    { style: "h2", text: "What comes next" },
    {
      style: "normal",
      text: "Snacksmate will keep developing short, accessible exercise snacks, in English and in Hebrew. The test for what comes next stays simple: can someone finish it on an ordinary day?",
    },
    {
      style: "normal",
      text: "Try Snacksmate the next time a few minutes open up. One snack is a complete session.",
    },
  ]),
  custom: blocks([
    {
      style: "normal",
      text: "A ready-made snack is the right start when you want the choice made for you. A custom exercise snack is for the moment when you already know what will fit: the time you have, the space you are standing in, and the movements you are willing to do.",
    },
    { style: "h2", text: "Build a short session that fits your day" },
    {
      style: "normal",
      text: "People do not arrive with the same ability, the same room, or the same gap in the schedule. A movement that works in a living room may not work beside a desk. A session that feels right on a quiet morning can be too much between meetings. Building your own snack is how that difference gets into the session, instead of asking you to match a plan that assumed another day.",
    },
    {
      style: "normal",
      text: "You are putting together one bout of movement, not a long program. It should still feel like an exercise snack: short enough to finish, and specific enough to start without a long briefing.",
    },
    { style: "h2", text: "What you decide" },
    {
      style: "normal",
      text: "The useful decisions are plain. Which movements belong in this snack, and how small can the session stay while still being worth doing? On the workout screen you see the exercise name, a short explanation, and a timer, and you can change the exercise without leaving the session. A custom snack starts from the same standard: the movements should be ones you chose, and the session should end while the day is still intact.",
    },
    { style: "h2", text: "Why that difference matters" },
    {
      style: "normal",
      text: "If the only option is too hard, needs more floor than you have, or is simply not a movement you want, it gets postponed. A session you shaped is easier to begin. Different abilities, different spaces, different exercise preferences, and different amounts of time are ordinary. The snack should be able to move with them.",
    },
    {
      style: "normal",
      text: "This is not clinical personalization, and it is not a program written around a diagnosis. It is a short session that fits the day you are actually having.",
    },
    { style: "h2", text: "Ready-made, or yours" },
    {
      style: "normal",
      text: "Start from a ready-made snack when you want speed. Build your own when the ready-made option is close but not quite right. Both sit in the same product, and both are still a few minutes of movement.",
    },
    {
      style: "normal",
      text: "Try Snacksmate and put together a short session that fits the rest of today.",
    },
  ]),
  preferences: blocks([
    {
      style: "normal",
      text: "An exercise snack only works if you can do the exercise. Snacksmate is more useful when the movements in front of you stay relevant: your ability today, the space you have, and the way you prefer to move.",
    },
    { style: "h2", text: "Ordinary reasons to set an exercise aside" },
    {
      style: "normal",
      text: "You do not need a dramatic reason. An exercise may feel too difficult. The room may not suit it. You may know the movement and simply prefer another one. Any of those is enough. Preferences exist so a mismatched exercise does not block a short session you would otherwise finish.",
    },
    { style: "h2", text: "What you can influence" },
    {
      style: "normal",
      text: "Snacksmate matches a snack to your activity level, your goals, and your exercise preferences, so you are not guessing from an undifferentiated list. During the session, the workout screen also lets you change the exercise without dropping the snack. Use that when the movement on screen is wrong for the room, or wrong for how you feel right now.",
    },
    {
      style: "normal",
      text: "The aim is a list of movements that feels usable the moment it opens. Personalization should make the experience easier to use and more appropriate for you. It should not make the session longer.",
    },
    {
      style: "normal",
      text: "Preferences sit inside the rest of Snacksmate, not off to the side. The weekly goal still counts snacks you finish. The workout screen still shows one movement at a time, with a short explanation and a timer. A preference is what keeps that movement from being the wrong one before you start, and Change Exercise is there if it still is.",
    },
    { style: "h2", text: "What preferences do not do" },
    {
      style: "normal",
      text: "Snacksmate does not decide whether an exercise is medically safe for you. Setting a preference is not a clinical assessment, and it does not replace advice from a clinician if you need that. You are choosing what fits. The app is not making a health ruling.",
    },
    { style: "h2", text: "A session you will actually start" },
    {
      style: "normal",
      text: "The best set of exercises is the one you do not have to negotiate with. When the movements in front of you are ones you can do, a few minutes stay a few minutes. That is the standard for this part of Snacksmate.",
    },
    {
      style: "normal",
      text: "Discover the feature the next time a movement does not fit. Change the exercise, or set your preferences so the next snack starts closer to you.",
    },
  ]),
  effort: blocks([
    {
      style: "normal",
      text: "Two snacks can take the same few minutes and feel nothing alike. Rating your effort at the end is a way to notice that while the session is still fresh.",
    },
    { style: "h2", text: "A scale in plain words" },
    {
      style: "normal",
      text: "When the snack ends, you can mark the effort as very easy, easy, moderate, hard, or max effort. The words are ordinary on purpose. Very easy means the snack barely rose above the rest of the day. Max effort means those minutes asked for everything you had. Easy, moderate, and hard sit between them. None of them is a grade you passed or failed.",
    },
    { style: "h2", text: "A plan label is not your rating" },
    {
      style: "normal",
      text: "A ready-made snack can already be described as moderate or vigorous before you start. That word belongs to the plan. The effort rating belongs to the session you just finished. A vigorous plan can feel moderate today. A moderate plan can feel hard. The rating is how you name that, for yourself.",
    },
    { style: "h2", text: "What the rating is for" },
    {
      style: "normal",
      text: "Use the rating to reflect on how the session felt. You might have expected something light and found it demanding, or the other way around. Pick the word that matches, and leave the workout there. The snack was the session. The rating is your read on it.",
    },
    {
      style: "normal",
      text: "Effort is not the same thing as whether the snack was worth doing. A moderate few minutes still count.",
    },
    {
      style: "normal",
      text: "Short sessions make the check-in more useful, not less. A few minutes of a demanding movement and a few minutes of a lighter one can share a timer and ask for very different effort. Naming that difference is a way to be honest about the day you had. There is no correct point on the scale. Max effort is not a prize, and very easy is not a miss. The useful choice is the word that matches the session, including the sessions that felt ordinary.",
    },
    {
      style: "normal",
      text: "The rating itself should take a moment. It is not another workout, and it should not turn the end of a snack into a second task. Choose the word that fits, then get on with the day.",
    },
    {
      style: "normal",
      text: "Try Snacksmate. At the end of your next snack, take a moment and rate the effort.",
    },
  ]),
  research: blocks([
    {
      style: "normal",
      text: "The Research Hub is the evidence-focused part of the Snacksmate website. It is a library of plain-language summaries for anyone who wants the research around short bouts of movement, without having to read every paper as a specialist.",
    },
    { style: "h2", text: "What the hub explores" },
    {
      style: "normal",
      text: "The Research Hub explores the evidence around the broader ideas that inform Snacksmate. Summaries cover topics such as exercise snacks, short bouts of exercise, VILPA, physical activity, and sedentary behavior. VILPA is vigorous intermittent lifestyle physical activity: brief, vigorous efforts that show up inside ordinary life, rather than only inside a planned workout. The hub explains that idea in everyday language and keeps the acronym as the research uses it.",
    },
    {
      style: "normal",
      text: "You can search the library and narrow it by topic, study design, and year. Each summary is written for a general reader. The original study remains the source.",
    },
    { style: "h2", text: "The paper stays attached" },
    {
      style: "normal",
      text: "Where a DOI or a link to the original study is available, Snacksmate keeps it on the page. The summary is a clearer explanation. It is not a substitute for the paper, and it is not a quotation presented as the authors' conclusion.",
    },
    {
      style: "normal",
      text: "What a study may mean in practice is marked as Snacksmate's reading of the evidence. The same is true of how the limitations are explained. None of that is personal advice.",
    },
    { style: "h2", text: "What a summary does not claim" },
    {
      style: "normal",
      text: "A study can inform the ideas behind Snacksmate without having tested Snacksmate. A place in the hub means the paper speaks to short activity, vigorous everyday movement, or time spent sitting. It does not mean the result is a verdict on the app, and it does not mean the finding applies in the same way to every reader.",
    },
    {
      style: "normal",
      text: "Where the details are available, a summary can say who took part, what the study did, what it found, and where its limits are. The journal and the year stay with that paper. Those details belong to the study. They are not a claim about what Snacksmate will do for any one person.",
    },
    {
      style: "normal",
      text: "If you want the practice, an exercise snack is still a few minutes of movement. If you want the evidence around that idea, start with the Research Hub.",
    },
    {
      style: "normal",
      before: "",
      label: "Explore the Research Hub",
      href: "/en/research/",
      after: ".",
    },
  ]),
} as const;

const hebrewBodies = {
  release: blocks([
    {
      style: "normal",
      text: "Snacksmate 2.0 היא הצעד הבא בדרך להכניס מקטעים קצרים של תנועה ליום רגיל. הרעיון לא התחלף. נשנוש כושר הוא עדיין כמה דקות ממוקדות, בבית, בעבודה או במקום שבו אתם כבר נמצאים, לרוב בלי ציוד ובלי לפנות שעה.",
    },
    { style: "h2", text: "מה השתנה" },
    {
      style: "normal",
      text: "זו Snacksmate שלמה יותר, לא מוצר אחר. כשאין זמן לתכנן אימון, נשנושי כושר מוכנים כבר שם. במסך הבית אפשר לפתוח, למשל, נשנוש קצר לכל הגוף, נשנוש כוח או נשנוש אינטרוולים קצר. כל אחד מהם נמשך כמה דקות, קרוב יותר להפסקה מאשר לביקור בחדר כושר. תוכניות מוכנות נוספות בדרך.",
    },
    {
      style: "normal",
      text: "מסך האימון עצמו קל יותר למעקב. רואים את התרגיל, הסבר קצר איך לבצע אותו, וטיימר. ההדגמה הוויזואלית נשארת על המסך בזמן התנועה. אפשר להשהות, ואפשר להחליף תרגיל אם התנועה שמופיעה לא מתאימה לרגע.",
    },
    { style: "h2", text: "התאמה אישית, בלי להפוך את זה לרפואה" },
    {
      style: "normal",
      text: "Snacksmate נבנית סביב רמת הפעילות, המטרות והעדפות התרגילים שלכם. הנשנוש שמופיע צריך להיות קרוב יותר לזמן שיש לכם ולתנועות שעובדות אצלכם. אם לא, החלפת תרגיל היא חלק מהמפגש, לא כישלון שלו.",
    },
    {
      style: "normal",
      text: "זו התאמה מעשית. היא הופכת את הדקות הבאות לאפשריות. זו לא תוכנית רפואית, ו־Snacksmate לא קובעת אם תרגיל בטוח לבריאות שלכם.",
    },
    { style: "h2", text: "התקדמות שאפשר לראות" },
    {
      style: "normal",
      text: "נשנוש כושר קצר נעלם בקלות בתוך יום עמוס. מסך ההתקדמות שומר תמונה פשוטה: יעד שבועי של נשנושים, הרצף הנוכחי, הרצף הטוב ביותר, המפגשים שהושלמו, הזמן שבו זזתם, והנשנושים שצברתם. היעד השבועי סופר נשנושים. הוא לא מבקש למצוא שעה פנויה.",
    },
    {
      style: "normal",
      text: "המסך הזה קיים כדי שהדקות יהיו גלויות. כמה מפגשים קצרים צריכים להיראות כמו מה שהם, לא כמו שבוע ריק.",
    },
    { style: "h2", text: "מה הלאה" },
    {
      style: "normal",
      text: "Snacksmate תמשיך לפתח נשנושי כושר קצרים ונגישים, בעברית ובאנגלית. המבחן למה שיבוא אחר כך נשאר פשוט: האם אפשר לסיים את זה ביום רגיל?",
    },
    {
      style: "normal",
      text: "נסו את Snacksmate בפעם הבאה שנפתחות כמה דקות. נשנוש כושר אחד הוא אימון שלם.",
    },
  ]),
  custom: blocks([
    {
      style: "normal",
      text: "נשנוש כושר מוכן הוא התחלה נכונה כשרוצים שמישהו אחר יבחר. נשנוש כושר אישי מתאים לרגע שבו כבר ברור מה יסתדר: הזמן שיש, המקום שבו עומדים, והתנועות שמוכנים לבצע.",
    },
    { style: "h2", text: "מפגש קצר שמתאים ליום" },
    {
      style: "normal",
      text: "לא כולם מגיעים עם אותה יכולת, אותו חדר, או אותו חלון ביומן. תנועה שנוחה בסלון לא תמיד נוחה ליד שולחן. מפגש שמרגיש נכון בבוקר שקט יכול להיות יותר מדי בין פגישות. נשנוש כושר שבניתם בעצמכם מכניס את ההבדל הזה לתוך המפגש, במקום לבקש מכם להתאים את עצמכם לתוכנית שנכתבה ליום אחר.",
    },
    {
      style: "normal",
      text: "זה מקטע אחד של תנועה, לא תוכנית ארוכה. הוא עדיין צריך להרגיש כמו נשנוש כושר: קצר מספיק כדי לסיים, וברור מספיק כדי להתחיל בלי תדריך ארוך.",
    },
    { style: "h2", text: "מה מחליטים" },
    {
      style: "normal",
      text: "ההחלטות שחשובות כאן פשוטות. אילו תנועות נכנסות לנשנוש, וכמה קצר המפגש יכול להישאר ועדיין להיות שווה. במסך האימון רואים את שם התרגיל, הסבר קצר וטיימר, ואפשר להחליף תרגיל בלי לצאת מהמפגש. נשנוש כושר אישי יוצא מאותו סטנדרט: התנועות צריכות להיות כאלה שבחרתם, והמפגש צריך להסתיים כשהיום עוד שלם.",
    },
    { style: "h2", text: "למה ההבדל הזה חשוב" },
    {
      style: "normal",
      text: "אם האפשרות היחידה קשה מדי, דורשת יותר רצפה ממה שיש, או פשוט אינה התנועה שרציתם, היא נדחית. מפגש שעיצבתם קל יותר להתחיל. יכולות שונות, מרחבים שונים, העדפות תרגיל שונות, וזמן פנוי שונה הם מצב רגיל. הנשנוש צריך לזוז יחד איתם.",
    },
    {
      style: "normal",
      text: "זו לא התאמה קלינית, וזו לא תוכנית שנכתבה סביב אבחנה. זה מפגש קצר שמתאים ליום שיש לכם בפועל.",
    },
    { style: "h2", text: "מוכן, או שלכם" },
    {
      style: "normal",
      text: "מתחילים מנשנוש כושר מוכן כשרוצים מהירות. בונים נשנוש משלכם כשהאפשרות המוכנה קרובה, אבל לא בדיוק נכונה. שניהם יושבים באותו מוצר, ושניהם עדיין כמה דקות של תנועה.",
    },
    {
      style: "normal",
      text: "נסו את Snacksmate, ובנו מפגש קצר שמתאים להמשך היום.",
    },
  ]),
  preferences: blocks([
    {
      style: "normal",
      text: "נשנוש כושר עובד רק אם אפשר לבצע את התרגיל. Snacksmate שימושית יותר כשהתנועות שמולכם נשארות רלוונטיות: ליכולת של היום, למרחב שיש, ולדרך שבה אתם מעדיפים לזוז.",
    },
    { style: "h2", text: "סיבות רגילות להניח תרגיל בצד" },
    {
      style: "normal",
      text: "לא צריך סיבה דרמטית. תרגיל יכול להרגיש קשה מדי. החדר יכול לא להתאים לו. ואפשר להכיר את התנועה ופשוט להעדיף אחרת. כל אחת מאלה מספיקה. העדפות קיימות כדי שתרגיל לא מתאים לא יחסום מפגש קצר שהייתם מסיימים.",
    },
    { style: "h2", text: "מה אפשר לכוון" },
    {
      style: "normal",
      text: "Snacksmate מתאימה נשנוש כושר לרמת הפעילות, למטרות ולהעדפות התרגילים שלכם, כדי שלא תנחשו מתוך רשימה אחידה. במהלך המפגש, מסך האימון גם מאפשר להחליף תרגיל בלי לוותר על הנשנוש. זה שימושי כשהתנועה על המסך לא מתאימה לחדר, או לא מתאימה לאיך שהגוף מרגיש עכשיו.",
    },
    {
      style: "normal",
      text: "המטרה היא מאגר שמרגיש שמיש ברגע שהוא נפתח. ההתאמה צריכה להפוך את החוויה לקלה יותר לשימוש ולמתאימה יותר לכם. היא לא צריכה להאריך את המפגש.",
    },
    { style: "h2", text: "מה ההעדפות לא עושות" },
    {
      style: "normal",
      text: "Snacksmate לא קובעת אם תרגיל בטוח עבורכם מבחינה רפואית. סימון העדפה אינו הערכה קלינית, והוא לא מחליף הנחיה של איש מקצוע כשצריך אותה. אתם בוחרים מה מסתדר. האפליקציה לא פוסקת בשאלת בריאות.",
    },
    { style: "h2", text: "מפגש שכן מתחילים" },
    {
      style: "normal",
      text: "המאגר הטוב הוא זה שלא צריך להתווכח איתו. כשהתנועות שמולכם הן תנועות שאפשר לבצע, כמה דקות נשארות כמה דקות. זה הסטנדרט של החלק הזה ב־Snacksmate.",
    },
    {
      style: "normal",
      text: "גלו את הפיצ'ר בפעם הבאה שתנועה לא מסתדרת. החליפו תרגיל, או כוונו את ההעדפות כדי שנשנוש הכושר הבא יתחיל קרוב יותר אליכם.",
    },
  ]),
  effort: blocks([
    {
      style: "normal",
      text: "שני נשנושי כושר יכולים לקחת אותן כמה דקות ולהרגיש אחרת לגמרי. דירוג המאמץ בסיום הוא דרך לשים לב לזה כל עוד המפגש עוד טרי.",
    },
    { style: "h2", text: "סולם במילים פשוטות" },
    {
      style: "normal",
      text: "כשהנשנוש נגמר, אפשר לסמן את המאמץ: קל מאוד, קל, בינוני, קשה, או מאמץ מקסימלי. המילים פשוטות בכוונה. קל מאוד אומר שהנשנוש בקושי עלה מעל שאר היום. מאמץ מקסימלי אומר שהדקות האלה ביקשו את כל מה שהיה לכם. קל, בינוני וקשה יושבים באמצע. אף אחד מהם אינו ציון של הצלחה או כישלון.",
    },
    { style: "h2", text: "תווית של תוכנית אינה הדירוג שלכם" },
    {
      style: "normal",
      text: "נשנוש כושר מוכן יכול להופיע מראש עם סימון של עצימות. הסימון הזה שייך לתוכנית. דירוג המאמץ שייך למפגש שזה עתה הסתיים. תוכנית שנראית עצימה יכולה להרגיש בינונית היום. תוכנית שנראית מתונה יכולה להרגיש קשה. הדירוג הוא הדרך שלכם לקרוא לזה, בשביל עצמכם.",
    },
    { style: "h2", text: "בשביל מה הדירוג" },
    {
      style: "normal",
      text: "השתמשו בדירוג כדי לשים לב איך המפגש הרגיש. אולי ציפיתם למשהו קל וגיליתם שהוא תובעני, או להפך. בחרו את המילה שמתאימה, והשאירו את האימון שם. הנשנוש היה המפגש. הדירוג הוא האופן שבו אתם מתארים אותו.",
    },
    {
      style: "normal",
      text: "מאמץ אינו אותו דבר כמו השאלה אם הנשנוש היה שווה. גם כמה דקות בעצימות בינונית נחשבות.",
    },
    {
      style: "normal",
      text: "נסו את Snacksmate. בסיום נשנוש הכושר הבא, קחו רגע ודרגו את המאמץ.",
    },
  ]),
  research: blocks([
    {
      style: "normal",
      text: "מרכז המחקר הוא החלק באתר של Snacksmate שמוקדש לראיות. זו ספרייה של סיכומים בשפה ברורה, למי שרוצה את המחקר על מקטעים קצרים של תנועה בלי לקרוא כל מאמר כאילו הוא נכתב למומחים.",
    },
    { style: "h2", text: "מה המרכז בוחן" },
    {
      style: "normal",
      text: "מרכז המחקר בוחן את הראיות סביב הרעיונות הרחבים שעומדים מאחורי Snacksmate. הסיכומים עוסקים בין השאר בנשנושי כושר, במקטעי אימון קצרים, ב־VILPA, בפעילות גופנית ובהתנהגות יושבנית. VILPA היא פעילות גופנית עצימה לסירוגין כחלק מחיי היום־יום: מאמצים קצרים ועצימים שמופיעים בתוך החיים עצמם, לא רק בתוך אימון מתוכנן. המרכז מסביר את הרעיון בשפה יומיומית ומשאיר את הקיצור כפי שהמחקר משתמש בו.",
    },
    {
      style: "normal",
      text: "אפשר לחפש בספרייה ולצמצם לפי נושא, סוג מחקר ושנה. כל סיכום נכתב לקורא הרחב. המחקר המקורי נשאר המקור.",
    },
    { style: "h2", text: "המאמר נשאר מחובר" },
    {
      style: "normal",
      text: "כשיש DOI או קישור למחקר המקורי, Snacksmate שומרת אותם בעמוד. הסיכום הוא הסבר ברור יותר. הוא לא תחליף למאמר, והוא לא ציטוט שמוצג כמסקנת המחברים.",
    },
    {
      style: "normal",
      text: "מה שמחקר עשוי להביע בפועל מסומן כקריאה של Snacksmate את הראיות. כך גם האופן שבו המגבלות מוסברות. אף אחד מאלה אינו עצה אישית.",
    },
    { style: "h2", text: "מה סיכום לא טוען" },
    {
      style: "normal",
      text: "מחקר יכול להזין את הרעיונות שמאחורי Snacksmate גם אם Snacksmate עצמה לא נבחנה בו. מקום במרכז אומר שהמאמר עוסק בפעילות קצרה, בתנועה עצימה ביומיום, או בזמן שיושבים. הוא לא אומר שהתוצאה היא פסק דין על האפליקציה, והוא לא אומר שהממצא חל באותו אופן על כל קורא.",
    },
    {
      style: "normal",
      text: "אם רוצים את המעשה, נשנוש כושר הוא עדיין כמה דקות של תנועה. אם רוצים את הראיות סביב הרעיון, מתחילים במרכז המחקר.",
    },
    {
      style: "normal",
      before: "",
      label: "גלו את מרכז המחקר",
      href: "/he/research/",
      after: ".",
    },
  ]),
} as const;

export const updateDrafts: readonly UpdateDraft[] = [
  draft({
    key: PAIRS[0].key,
    language: "en",
    title: "Snacksmate 2.0 – What’s New",
    excerpt:
      "Snacksmate 2.0 is a more complete way to fit short exercise snacks into a real day, with ready-made sessions, a clearer workout, and progress you can actually see.",
    body: englishBodies.release,
    seoTitle: "Snacksmate 2.0: What’s New for Everyday Movement",
    seoDescription:
      "Snacksmate 2.0 brings together ready-made exercise snacks, a clearer workout screen, and a progress view of the short sessions you finished.",
    topic: PAIRS[0].topic,
    translationSlug: PAIRS[0].translationSlug,
  }),
  draft({
    key: PAIRS[0].key,
    language: "he",
    title: "Snacksmate 2.0 – מה חדש",
    excerpt:
      "Snacksmate 2.0 היא דרך שלמה יותר להכניס נשנושי כושר קצרים ליום אמיתי: מפגשים מוכנים, מסך אימון ברור יותר, והתקדמות שאפשר לראות, בלי לפנות שעה. לרוב גם בלי ציוד.",
    body: hebrewBodies.release,
    seoTitle: "Snacksmate 2.0: מה חדש בחוויית נשנושי הכושר היומי",
    seoDescription:
      "Snacksmate 2.0 מרכזת נשנושי כושר מוכנים, מסך אימון ברור יותר, ומבט פשוט על ההתקדמות שמראה את הדקות הקצרות שבהן זזתם ביום רגיל. בלי חדר כושר.",
    topic: PAIRS[0].topic,
    translationSlug: PAIRS[0].translationSlug,
  }),
  draft({
    key: PAIRS[1].key,
    language: "en",
    title: "Create Your Own Exercise Snack",
    excerpt:
      "Build a short exercise snack around the time you have, the space you are in, and the movements you actually want to do. It is one session, not a long training plan.",
    body: englishBodies.custom,
    seoTitle: "Create Your Own Exercise Snack with Snacksmate",
    seoDescription:
      "Shape a short Snacksmate session around your time, your space, and the movements you want. A custom exercise snack stays one bout, not a long plan.",
    topic: PAIRS[1].topic,
    translationSlug: PAIRS[1].translationSlug,
  }),
  draft({
    key: PAIRS[1].key,
    language: "he",
    title: "יצירת נשנוש כושר בהתאמה אישית",
    excerpt:
      "בנו נשנוש כושר קצר סביב הזמן שיש לכם, המרחב שבו אתם נמצאים, והתנועות שאתם באמת רוצים לבצע. זה מפגש אחד ליום הזה, לא תוכנית אימונים ארוכה. לרוב אפשר גם בלי ציוד.",
    body: hebrewBodies.custom,
    seoTitle: "כך יוצרים ב־Snacksmate נשנוש כושר אישי ליום שלכם",
    seoDescription:
      "בנו ב־Snacksmate מפגש קצר לפי הזמן, המרחב והתנועות שמתאימים לכם. נשנוש כושר אישי נשאר מקטע אחד ליום הזה, לא תוכנית אימונים ארוכה ומחייבת. בלי ציוד.",
    topic: PAIRS[1].topic,
    translationSlug: PAIRS[1].translationSlug,
  }),
  draft({
    key: PAIRS[2].key,
    language: "en",
    title: "Make Snacksmate Fit You: Exercise Preferences",
    excerpt:
      "Exercise preferences keep Snacksmate closer to movements you can do and want to do, when an exercise feels too hard, the space is wrong, or you prefer another one.",
    body: englishBodies.preferences,
    seoTitle: "Make Snacksmate Fit You with Exercise Preferences",
    seoDescription:
      "Keep Snacksmate closer to exercises that suit you when a movement feels too hard, the room does not fit, or you simply prefer a different one.",
    topic: PAIRS[2].topic,
    translationSlug: PAIRS[2].translationSlug,
  }),
  draft({
    key: PAIRS[2].key,
    language: "he",
    title: "התאמת מאגר התרגילים אליכם",
    excerpt:
      "העדפות התרגילים שומרות את Snacksmate קרובה לתנועות שאפשר לבצע ושרוצים לבצע, כשמשהו קשה מדי, אין לו מספיק מקום, או שפשוט מעדיפים תנועה אחרת היום. זו התאמה לשימוש, לא שיפוט רפואי.",
    body: hebrewBodies.preferences,
    seoTitle: "איך מתאימים ב־Snacksmate את מאגר התרגילים אליכם",
    seoDescription:
      "כוונו את Snacksmate לתרגילים שמתאימים לכם, גם כשתנועה מרגישה קשה מדי, כשאין לה מספיק מקום בחדר, או כשפשוט מעדיפים תנועה אחרת. בלי לוותר על הנשנוש.",
    topic: PAIRS[2].topic,
    translationSlug: PAIRS[2].translationSlug,
  }),
  draft({
    key: PAIRS[3].key,
    language: "en",
    title: "New: Rate Your Effort After Every Snack",
    excerpt:
      "After a snack, rate how the effort felt: very easy, easy, moderate, hard, or max effort. The rating is a simple way to reflect on the session you just finished today.",
    body: englishBodies.effort,
    seoTitle: "Rate Your Effort After Every Snacksmate Snack",
    seoDescription:
      "Mark a finished Snacksmate snack from very easy to max effort. The rating is there so you can reflect on how that short session actually felt.",
    topic: PAIRS[3].topic,
    translationSlug: PAIRS[3].translationSlug,
  }),
  draft({
    key: PAIRS[3].key,
    language: "he",
    title: "חדש: דירוג המאמץ בסיום האימון",
    excerpt:
      "בסיום נשנוש כושר אפשר לסמן איך המאמץ הרגיש: קל מאוד, קל, בינוני, קשה או מאמץ מקסימלי. הדירוג הוא דרך לשים לב למפגש שזה עתה הסתיים, בלי להפוך אותו לציון. המילה שמתאימה מספיקה.",
    body: hebrewBodies.effort,
    seoTitle: "דירוג המאמץ ב־Snacksmate בסיום נשנוש הכושר שלכם",
    seoDescription:
      "בסיום נשנוש כושר ב־Snacksmate מסמנים את המאמץ, מקל מאוד ועד מאמץ מקסימלי. הדירוג הוא רגע להתבונן באיך שהמפגש הקצר הזה הרגיש לכם. בלי ציון ובלי יעד.",
    topic: PAIRS[3].topic,
    translationSlug: PAIRS[3].translationSlug,
  }),
  draft({
    key: PAIRS[4].key,
    language: "en",
    title: "Introducing the Snacksmate Research Hub",
    excerpt:
      "The Research Hub is where Snacksmate explains studies on exercise snacks, short bouts of exercise, VILPA, and sedentary behavior in plain language, and keeps the original source.",
    body: englishBodies.research,
    seoTitle: "The Snacksmate Research Hub, in Plain Language",
    seoDescription:
      "Read plain-language summaries of research on exercise snacks, short bouts, VILPA, and sedentary behavior. Snacksmate keeps the original study and DOI.",
    topic: PAIRS[4].topic,
    translationSlug: PAIRS[4].translationSlug,
  }),
  draft({
    key: PAIRS[4].key,
    language: "he",
    title: "הכירו את מרכז המחקר של Snacksmate",
    excerpt:
      "מרכז המחקר של Snacksmate מסביר בשפה ברורה מחקרים על נשנושי כושר, מקטעי אימון קצרים, VILPA והתנהגות יושבנית, ומשאיר בעמוד את המחקר המקורי ואת ה־DOI. הסיכום אינו תחליף למאמר.",
    body: hebrewBodies.research,
    seoTitle: "מרכז המחקר של Snacksmate: הסבר ברור לקהל הרחב",
    seoDescription:
      "מרכז המחקר של Snacksmate מסביר בשפה ברורה מחקרים על נשנושי כושר, מקטעים קצרים, VILPA והתנהגות יושבנית, ושומר את המאמר המקורי ואת ה־DOI. אפשר לקרוא גם את המקור.",
    topic: PAIRS[4].topic,
    translationSlug: PAIRS[4].translationSlug,
  }),
];

export function blockText(body: readonly UpdateBlock[]): string {
  return body
    .map((block) => block.children.map((child) => child.text).join(""))
    .join("\n");
}

export function publicText(document: UpdateDraft): string {
  return [document.title, document.excerpt, document.seoTitle, document.seoDescription, blockText(document.body)].join(
    "\n",
  );
}

export function englishWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type UpdateValidation = {
  errors: string[];
  warnings: string[];
};

const ENGLISH_TITLES = [
  "Snacksmate 2.0 – What’s New",
  "Create Your Own Exercise Snack",
  "Make Snacksmate Fit You: Exercise Preferences",
  "New: Rate Your Effort After Every Snack",
  "Introducing the Snacksmate Research Hub",
] as const;

const HEBREW_TITLES = [
  "Snacksmate 2.0 – מה חדש",
  "יצירת נשנוש כושר בהתאמה אישית",
  "התאמת מאגר התרגילים אליכם",
  "חדש: דירוג המאמץ בסיום האימון",
  "הכירו את מרכז המחקר של Snacksmate",
] as const;

const TOPICS = {
  "snacksmate-2-0-whats-new": "release",
  "custom-exercise-snacks": "new-feature",
  "exercise-preferences": "product-update",
  "workout-effort-rating": "new-feature",
  "snacksmate-research-hub": "product-update",
} as const;

export function validateUpdateDrafts(
  documents: readonly UpdateDraft[] = updateDrafts,
): UpdateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  if (documents.length !== 10) {
    errors.push(`Expected 10 drafts, found ${documents.length}.`);
  }

  for (const document of documents) {
    const label = document._id;
    if (document._type !== "article") errors.push(`${label} is not an article.`);
    if (!document._id.startsWith("drafts.")) {
      errors.push(`${label} is not a draft id.`);
    }
    if (document._id.replace(/^drafts\./, "").startsWith("drafts.")) {
      errors.push(`${label} has a nested drafts prefix.`);
    }
    if (seen.has(document._id)) errors.push(`Duplicate id ${label}.`);
    seen.add(document._id);
    if ("mainImage" in document) errors.push(`${label} sets mainImage.`);
    if ("canonicalUrl" in document) errors.push(`${label} sets canonicalUrl.`);
    if (!document.title.trim()) errors.push(`${label} is missing a title.`);
    if (!document.slug.current.trim()) errors.push(`${label} is missing a slug.`);
    if (document.slug.current !== document.translationSlug) {
      errors.push(`${label} slug does not match translationSlug.`);
    }
    const excerptLength = document.excerpt.length;
    if (excerptLength < 160 || excerptLength > 300) {
      errors.push(`${label} excerpt is ${excerptLength} characters.`);
    }
    if (document.seoTitle.length > 60) {
      errors.push(`${label} seoTitle is ${document.seoTitle.length} characters.`);
    } else if (document.seoTitle.length < 45) {
      warnings.push(`${label} seoTitle is ${document.seoTitle.length} characters.`);
    }
    const descriptionLength = document.seoDescription.length;
    if (descriptionLength > 160) {
      errors.push(`${label} seoDescription is ${descriptionLength} characters.`);
    } else if (descriptionLength < 140) {
      warnings.push(`${label} seoDescription is ${descriptionLength} characters.`);
    }
    if (!document.publishedAt) errors.push(`${label} is missing publishedAt.`);
    if (!document.body.some((block) => block.style === "h2")) {
      errors.push(`${label} has no section headings.`);
    }
    const expectedTopic = TOPICS[document.translationSlug as keyof typeof TOPICS];
    if (document.topic !== expectedTopic) {
      errors.push(`${label} topic is ${document.topic}, expected ${expectedTopic}.`);
    }
    const words = englishWordCount(blockText(document.body));
    if (document.language === "en" && words > 650) {
      errors.push(`${label} body is ${words} English words.`);
    } else if (document.language === "en" && words < 350) {
      warnings.push(`${label} body is ${words} English words. Shorter than 350 is acceptable only when the update is complete.`);
    }
    const forbidden = [
      "revolutionary",
      "game-changing",
      "life-changing",
      "work duration",
      "rest duration",
      "number of sets",
      "adaptive coach",
    ];
    const visible = publicText(document).toLowerCase();
    for (const phrase of forbidden) {
      if (visible.includes(phrase)) errors.push(`${label} public text includes "${phrase}".`);
    }
    if (document.translationSlug === "workout-effort-rating") {
      const effortClaims = ["stored", "algorithm", "recommendation", "future workout", "artificial intelligence"];
      for (const phrase of effortClaims) {
        if (visible.includes(phrase)) errors.push(`${label} effort text includes "${phrase}".`);
      }
    }
  }

  for (const translationSlug of Object.keys(TOPICS)) {
    const pair = documents.filter((document) => document.translationSlug === translationSlug);
    if (pair.length !== 2) {
      errors.push(`${translationSlug} has ${pair.length} documents.`);
      continue;
    }
    const languages = pair.map((document) => document.language).sort();
    if (languages.join(",") !== "en,he") {
      errors.push(`${translationSlug} languages are ${languages.join(", ")}.`);
    }
    const slugs = new Set(pair.map((document) => document.slug.current));
    if (slugs.size !== 1) errors.push(`${translationSlug} does not share one slug.`);
    const hebrew = pair.find((document) => document.language === "he");
    const english = pair.find((document) => document.language === "en");
    if (!hebrew?.translationSourceId || !english) {
      errors.push(`${translationSlug} is missing a Hebrew source link.`);
    } else if (hebrew.translationSourceId !== english._id.replace(/^drafts\./, "")) {
      errors.push(`${translationSlug} Hebrew source id does not match the English draft.`);
    }
    if (hebrew?.translationStatus !== "needs_review") {
      errors.push(`${translationSlug} Hebrew translationStatus is not needs_review.`);
    }
    if (english?.translationStatus) {
      errors.push(`${translationSlug} English draft sets translationStatus.`);
    }
  }

  const englishTitles = documents.filter((document) => document.language === "en").map((document) => document.title);
  const hebrewTitles = documents.filter((document) => document.language === "he").map((document) => document.title);
  for (const title of ENGLISH_TITLES) {
    if (!englishTitles.includes(title)) errors.push(`Missing English title: ${title}`);
  }
  for (const title of HEBREW_TITLES) {
    if (!hebrewTitles.includes(title)) errors.push(`Missing Hebrew title: ${title}`);
  }

  const slugsByLanguage = new Map<string, Set<string>>();
  for (const document of documents) {
    const bucket = slugsByLanguage.get(document.language) ?? new Set<string>();
    if (bucket.has(document.slug.current)) {
      errors.push(`Duplicate ${document.language} slug ${document.slug.current}.`);
    }
    bucket.add(document.slug.current);
    slugsByLanguage.set(document.language, bucket);
  }

  return { errors, warnings };
}

export function formatUpdateDraftReport(
  documents: readonly UpdateDraft[] = updateDrafts,
): string {
  const validation = validateUpdateDrafts(documents);
  const lines = [
    "Snacksmate Update drafts",
    "Published: no",
    "mainImage: empty",
    "",
  ];
  for (const document of documents) {
    lines.push(
      [
        document.language,
        document.topic,
        document._id,
        document.title,
        `slug=${document.slug.current}`,
        `seoTitle=${document.seoTitle.length}`,
        `seoDescription=${document.seoDescription.length}`,
        `excerpt=${document.excerpt.length}`,
        `bodyWords=${englishWordCount(blockText(document.body))}`,
      ].join(" | "),
    );
  }
  lines.push("", "Validation errors:");
  lines.push(...(validation.errors.length ? validation.errors.map((error) => `- ${error}`) : ["- none"]));
  lines.push("", "Validation warnings:");
  lines.push(...(validation.warnings.length ? validation.warnings.map((warning) => `- ${warning}`) : ["- none"]));
  return lines.join("\n");
}
