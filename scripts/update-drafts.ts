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
      text: "Snacksmate 2.0 נועדה להקל על הרגע שבו מתחילים לזוז. הרעיון נשאר כפי שהיה: כמה דקות של תנועה ממוקדת בבית, בעבודה או בכל מקום שבו אתם כבר נמצאים, בדרך כלל בלי ציוד ובלי צורך לפנות שעה ביומן.",
    },
    { style: "h2", text: "אותו רעיון, בגרסה שלמה יותר" },
    {
      style: "normal",
      text: "זה לא מוצר אחר. זו גרסה שלמה יותר של Snacksmate, שבה הדרך מהרצון לזוז ועד לתנועה עצמה קצרה יותר.",
    },
    { style: "h2", text: "חטיפי תנועה מוכנים לימים שבהם אין חשק לתכנן" },
    {
      style: "normal",
      text: "לפעמים אתם רוצים לזוז, אבל לא רוצים להחליט מה בדיוק לעשות. בשביל זה יש חטיפי תנועה מוכנים. במסך הבית אפשר לפתוח, למשל, חטיף תנועה קצר לכל הגוף, חטיף תנועה לכוח, או חטיף תנועה קצר של אינטרוולים.",
    },
    {
      style: "normal",
      text: "כל אחד מהם נמשך כמה דקות, והוא קרוב יותר להפסקה מאשר לביקור בחדר כושר. תוכניות מוכנות נוספות נמצאות בדרך.",
    },
    { style: "h2", text: "מה רואים במהלך חטיף התנועה" },
    {
      style: "normal",
      text: "במהלך חטיף התנועה מופיעים על המסך התרגיל, הסבר קצר וטיימר. ההדרכה החזותית נשארת מולכם לאורך כל התרגיל, כך שאין צורך לזכור בעל פה מה לעשות. אפשר לעצור באמצע, ואפשר להחליף תרגיל אם התנועה לא מתאימה לכם באותו רגע.",
    },
    {
      style: "normal",
      text: "חטיף התנועה שמופיע מותאם לרמת הפעילות שלכם, למטרות שלכם ולהעדפות התרגילים שלכם. ובכל זאת, יש רגעים שבהם תרגיל מסוים פשוט לא מתאים. החלפת תרגיל היא חלק מחטיף התנועה, ולא כישלון.",
    },
    {
      style: "normal",
      text: "חשוב לומר את זה בבירור: מדובר בכלי מעשי ולא בתוכנית רפואית. Snacksmate לא קובעת אם תרגיל מסוים בטוח עבורכם.",
    },
    { style: "h2", text: "לראות שבוע שבו זזתם" },
    {
      style: "normal",
      text: "מפגש קצר נבלע בקלות בתוך יום עמוס. כמה דקות של תנועה בבוקר כבר נשכחות עד הערב, ובסוף השבוע קשה לזכור שהן בכלל היו. לכן מסך ההתקדמות מרכז את מה שעשיתם.",
    },
    {
      style: "normal",
      text: "במסך ההתקדמות מופיעים יעד שבועי של חטיפי תנועה, הרצף הנוכחי, הרצף הארוך ביותר, המפגשים שהושלמו, הזמן שהקדשתם לתנועה וחטיפי התנועה שצברתם.",
    },
    {
      style: "normal",
      text: "היעד השבועי סופר חטיפי תנועה, ולא מבקש מכם למצוא שעה פנויה. כמה מפגשים קצרים צריכים להיראות כמו שבוע שבו זזתם, ולא כמו שבוע ריק.",
    },
    { style: "h2", text: "מה הלאה" },
    {
      style: "normal",
      text: "נמשיך ליצור ב־Snacksmate חטיפי תנועה קצרים בעברית ובאנגלית. המבחן שלנו פשוט: האם אפשר לסיים חטיף תנועה ביום רגיל? חטיף תנועה אחד הוא מפגש שלם.",
    },
  ]),
  custom: blocks([
    { style: "h2", text: "חטיף מוכן או חטיף משלכם" },
    {
      style: "normal",
      text: "חטיף תנועה מוכן נועד לרגעים שבהם נוח לכם שהבחירה כבר נעשתה. חטיף תנועה משלכם נועד לרגעים שבהם אתם כבר יודעים כמה זמן יש לכם, באיזה מרחב אתם נמצאים ואילו תנועות אתם מוכנים לעשות.",
    },
    {
      style: "normal",
      text: "אנשים שונים זה מזה ביכולת, במקום שעומד לרשותם ובזמן הפנוי שלהם. תנועה שמתאימה לסלון לא תמיד מתאימה לעמידה ליד שולחן העבודה. מפגש שמרגיש נכון בבוקר שקט עלול להיות יותר מדי בין שתי פגישות. כשאתם בונים חטיף תנועה בעצמכם, ההבדל הזה נכנס לתוך המפגש, ואתם לא צריכים להתאים את עצמכם לתוכנית שנכתבה ליום אחר.",
    },
    { style: "h2", text: "מפגש אחד ולא תוכנית ארוכה" },
    {
      style: "normal",
      text: "חטיף תנועה שאתם בונים הוא מפגש אחד ולא תוכנית ארוכה. הוא קצר מספיק כדי שתסיימו אותו, וברור מספיק כדי שתוכלו להתחיל בלי הסבר ארוך.",
    },
    {
      style: "normal",
      text: "אתם מחליטים אילו תנועות נכנסות לחטיף התנועה, ועד כמה קצר הוא יכול להישאר ועדיין להיות שווה את המאמץ. על המסך מופיעים שם התרגיל, הסבר קצר וטיימר. אפשר להחליף תרגיל בלי לצאת מהמפגש. התנועות הן אלה שבחרתם, והמפגש מסתיים כשיתר היום עדיין לפניכם.",
    },
    { style: "h2", text: "למה קל יותר להתחיל" },
    {
      style: "normal",
      text: "כשהאפשרות היחידה קשה מדי, דורשת יותר מקום על הרצפה ממה שיש לכם או פשוט אינה תנועה שאתם רוצים לעשות, קל לדחות אותה לפעם אחרת. מפגש שעיצבתם בעצמכם קל יותר להתחיל.",
    },
    {
      style: "normal",
      text: "הבדלים ביכולת, במרחב, בהעדפות ובזמן הם דבר רגיל לגמרי. חטיף התנועה צריך להתאים ליום, ולא היום לחטיף התנועה.",
    },
    { style: "h2", text: "מה זה לא" },
    {
      style: "normal",
      text: "זו לא התאמה אישית קלינית, וזו לא תוכנית שנכתבה סביב אבחנה. זה מפגש קצר שמתאים ליום שאתם עוברים בפועל.",
    },
    { style: "h2", text: "מתי לבחור בכל אחת מהדרכים" },
    {
      style: "normal",
      text: "כשאתם רוצים להתחיל מהר, התחילו מחטיף תנועה מוכן. כשהאפשרות המוכנה קרובה למה שאתם צריכים אבל לא בדיוק, בונים חטיף תנועה משלכם. בשני המקרים מדובר בכמה דקות.",
    },
  ]),
  preferences: blocks([
    { style: "h2", text: "כשתרגיל לא מתאים" },
    {
      style: "normal",
      text: "חטיף תנועה עובד רק אם אפשר לבצע את התרגיל. העדפות התרגילים נועדו לשמור על תנועות שמתאימות ליכולת שלכם היום, למרחב שבו אתם נמצאים ולאופן שבו אתם אוהבים לזוז.",
    },
    {
      style: "normal",
      text: "הסיבות יכולות להיות רגילות לגמרי: התרגיל קשה מדי, החדר לא מתאים לו, או שאתם מכירים את התנועה ופשוט מעדיפים אחרת. ההעדפות קיימות כדי שתרגיל אחד שלא מתאים לא יעצור מפגש קצר שהייתם מסיימים בלעדיו.",
    },
    { style: "h2", text: "התאמה במקום רשימה אחת לכולם" },
    {
      style: "normal",
      text: "ההתאמה נשענת על רמת הפעילות שלכם, על המטרות שלכם ועל ההעדפות שבחרתם, ולא על רשימה אחת שאמורה להתאים לכולם. גם באמצע המפגש אפשר להחליף תרגיל, בלי לוותר על חטיף התנועה.",
    },
    {
      style: "normal",
      text: "הרשימה צריכה להיות שימושית מהרגע שהיא נפתחת. ההתאמה האישית לא אמורה להאריך את המפגש.",
    },
    { style: "h2", text: "חלק מהמוצר כולו" },
    {
      style: "normal",
      text: "ההעדפות משתלבות בשאר חלקי Snacksmate. היעד השבועי ממשיך לספור חטיפי תנועה שהושלמו, והמסך עדיין מציג תנועה אחת, הסבר קצר וטיימר.",
    },
    {
      style: "normal",
      text: "המטרה היא שכבר התנועה הראשונה תתאים לכם. אם היא בכל זאת לא מתאימה, מחליפים תרגיל וממשיכים.",
    },
    { style: "h2", text: "מה ההעדפות לא עושות" },
    {
      style: "normal",
      text: "Snacksmate לא קובעת אם תרגיל בטוח עבורכם מבחינה רפואית. העדפה איננה הערכה קלינית, והיא לא מחליפה איש מקצוע בתחום הבריאות. אתם בוחרים מה מתאים לכם, והאפליקציה לא קובעת בשאלות רפואיות.",
    },
    {
      style: "normal",
      text: "המבחר הטוב ביותר הוא זה שאתם פשוט יכולים לעשות. כשהתנועות אפשריות, כמה דקות נשארות כמה דקות.",
    },
  ]),
  effort: blocks([
    { style: "h2", text: "חמש מילים בסוף המפגש" },
    {
      style: "normal",
      text: "שני מפגשים יכולים להימשך אותן כמה דקות ולהרגיש שונים לגמרי. דירוג המאמץ בסוף המפגש מאפשר לשים לב להבדל הזה כל עוד התחושה עדיין ברורה.",
    },
    {
      style: "normal",
      text: "כשחטיף התנועה נגמר, אתם בוחרים מילה אחת מתוך חמש: קל מאוד, קל, בינוני, קשה, מאמץ מקסימלי.",
    },
    {
      style: "normal",
      text: "קל מאוד פירושו שחטיף התנועה בקושי עלה מעל שאר היום. מאמץ מקסימלי פירושו שהדקות האלה דרשו מכם את כל מה שהיה לכם. אף אחת מהמילים אינה ציון של עובר או של נכשל.",
    },
    { style: "h2", text: "התוכנית לעומת מה שהרגשתם" },
    {
      style: "normal",
      text: "חטיף תנועה מוכן יכול להיות מסומן מראש כמתון או כעצים. הסימון הזה שייך לתוכנית, והדירוג שייך למפגש שזה עתה עשיתם. תוכנית עצימה יכולה להרגיש היום מתונה, ותוכנית מתונה יכולה להרגיש קשה.",
    },
    {
      style: "normal",
      text: "הדירוג עוזר לכם לשים לב לפער בין מה שציפיתם לבין מה שהרגשתם בפועל. חטיף התנועה היה המפגש, והדירוג רק מתאר אותו.",
    },
    { style: "h2", text: "המאמץ לא קובע אם היה שווה" },
    {
      style: "normal",
      text: "המאמץ הוא דבר אחד, והשאלה אם חטיף התנועה היה שווה היא דבר אחר. גם כמה דקות במאמץ בינוני נחשבות.",
    },
    { style: "h2", text: "למה זה שימושי דווקא במפגשים קצרים" },
    {
      style: "normal",
      text: "במפגשים קצרים הבדיקה הזו שימושית במיוחד, כי אותו טיימר יכול ללוות תנועה תובענית ותנועה קלה. אין נקודה נכונה בסולם. מאמץ מקסימלי אינו פרס. קל מאוד אינו פספוס. גם יום רגיל מקבל מילה משלו.",
    },
    {
      style: "normal",
      text: "הדירוג אמור לקחת רגע, ולא להפוך לאימון שני או למשימה נוספת. בוחרים מילה וממשיכים ביום.",
    },
  ]),
  research: blocks([
    { style: "h2", text: "ספרייה של סיכומים בשפה פשוטה" },
    {
      style: "normal",
      text: "מרכז המחקר הוא המקום שבו אתר Snacksmate מסביר מחקרים על תנועה קצרה בשפה פשוטה, ושומר לצד כל הסבר את המקור. זו ספרייה של סיכומים נגישים, כדי שלא תצטרכו לקרוא כל מאמר כמו מומחים.",
    },
    {
      style: "normal",
      text: "הנושאים כוללים חטיפי תנועה, פרקי פעילות קצרים, VILPA, פעילות גופנית והתנהגות יושבנית. המשמעות של VILPA היא פעילות גופנית עצימה לסירוגין כחלק מחיי היום־יום. הכוונה למאמץ קצר ועצים בתוך החיים הרגילים, ולא רק בתוך אימון מתוכנן.",
    },
    { style: "h2", text: "איך מוצאים מחקר" },
    {
      style: "normal",
      text: "אפשר לחפש ולסנן לפי נושא, לפי סוג מחקר ולפי שנה. הסיכום כתוב לקורא הכללי, אבל המקור נשאר המחקר עצמו.",
    },
    {
      style: "normal",
      text: "כשיש למחקר DOI או קישור, הם נשארים בעמוד. ה־DOI והקישור מובילים אל המאמר המקורי. הסיכום מסביר, אבל הוא לא מחליף את המאמר, והוא גם לא ציטוט שמוצג כמסקנה של החוקרים.",
    },
    { style: "h2", text: "מה שייך למחקר ומה שייך לנו" },
    {
      style: "normal",
      text: "מה שמחקר עשוי לומר על חיי היום־יום מסומן כקריאה של Snacksmate, וכך גם ההסבר על המגבלות שלו. זו לא עצה אישית.",
    },
    {
      style: "normal",
      text: "מחקר יכול לעמוד מאחורי הרעיון גם אם Snacksmate עצמה לא נבחנה בו. מאמר שמופיע במרכז המחקר עוסק בפעילות קצרה, בתנועה עצימה בחיי היום־יום או בזמן שמבלים בישיבה. הוא אינו פסק דין על האפליקציה, והממצא שלו לא חל באותו אופן על כל אדם.",
    },
    {
      style: "normal",
      text: "כשהפרטים קיימים, הסיכום יכול לומר מי השתתף, מה נעשה, מה נמצא ואיפה עוברים הגבולות של המחקר. שם כתב העת ושנת הפרסום נשארים צמודים למאמר. כל אלה מתארים את המחקר, ואינם הבטחה למה ש־Snacksmate תעשה עבור מישהו.",
    },
    { style: "h2", text: "מאיפה מתחילים" },
    {
      style: "normal",
      text: "אם אתם רוצים לזוז, חטיף תנועה הוא עדיין עניין של כמה דקות. אם אתם רוצים לקרוא את הראיות, התחילו במרכז המחקר.",
    },
    {
      style: "normal",
      before: "",
      label: "למרכז המחקר",
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
    title: "Snacksmate 2.0: קל יותר להתחיל לזוז לכמה דקות",
    excerpt:
      "גרסה 2.0 של Snacksmate לא משנה את הרעיון, אלא מקלה על ההתחלה. עדיין מדובר בכמה דקות של תנועה ממוקדת בבית, בעבודה או בכל מקום שבו אתם כבר נמצאים, בדרך כלל בלי ציוד ובלי לפנות שעה שלמה ביומן.",
    body: hebrewBodies.release,
    seoTitle: "Snacksmate 2.0: חטיפי תנועה קצרים שקל יותר להתחיל",
    seoDescription:
      "גרסה 2.0 של Snacksmate מקלה על ההתחלה: חטיפי תנועה מוכנים של כמה דקות, בדרך כלל בלי ציוד, הדרכה ברורה על המסך ומסך התקדמות שמראה שבוע שבו באמת זזתם.",
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
    title: "בונים חטיף תנועה שמתאים ליום שלכם",
    excerpt:
      "חטיף תנועה מוכן מתאים לרגעים שבהם נוח לכם שהבחירה כבר נעשתה. חטיף תנועה משלכם מתאים לרגעים שבהם אתם כבר יודעים כמה זמן יש לכם, באיזה מקום אתם נמצאים ואילו תנועות אתם מוכנים לעשות.",
    body: hebrewBodies.custom,
    seoTitle: "לבנות חטיף תנועה משלכם ב־Snacksmate לפי היום שלכם",
    seoDescription:
      "חטיף תנועה משלכם ב־Snacksmate הוא מפגש קצר אחד שמתאים לזמן שיש לכם, למקום שבו אתם נמצאים ולתנועות שאתם מוכנים לעשות, בלי תוכנית ארוכה ובלי הסבר ארוך.",
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
    title: "העדפות תרגילים: תנועות שמתאימות לכם היום",
    excerpt:
      "חטיף תנועה עובד רק אם אתם יכולים לבצע את התרגיל. העדפות התרגילים ב־Snacksmate שומרות על תנועות שמתאימות ליכולת שלכם היום, למקום שבו אתם נמצאים ולדרך שבה אתם אוהבים לזוז.",
    body: hebrewBodies.preferences,
    seoTitle: "העדפות תרגילים ב־Snacksmate: תנועות שאפשר לבצע היום",
    seoDescription:
      "העדפות תרגילים ב־Snacksmate מתאימות את התנועות ליכולת, למקום ולמה שנוח לכם, ומאפשרות להחליף תרגיל בלי לוותר על חטיף התנועה כשמשהו לא מתאים לכם היום.",
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
    title: "דירוג מאמץ: איך הרגיש חטיף התנועה שעשיתם",
    excerpt:
      "שני חטיפי תנועה יכולים להימשך אותן כמה דקות ולהרגיש שונים לגמרי. דירוג המאמץ בסוף המפגש הוא דרך לשים לב להבדל הזה כל עוד אתם עדיין זוכרים איך זה הרגיש, ואז להמשיך ביום.",
    body: hebrewBodies.effort,
    seoTitle: "דירוג מאמץ ב־Snacksmate: איך הרגיש חטיף התנועה",
    seoDescription:
      "בסוף כל חטיף תנועה ב־Snacksmate אתם בוחרים מילה אחת מתוך חמש, מקל מאוד ועד מאמץ מקסימלי, כדי לשים לב לפער בין מה שציפיתם לבין מה שהרגשתם בפועל.",
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
    title: "מרכז המחקר: מחקרים על תנועה קצרה בשפה פשוטה",
    excerpt:
      "מרכז המחקר הוא המקום שבו אתר Snacksmate מסביר מחקרים על תנועה קצרה בשפה פשוטה. כל סיכום כתוב לקורא הכללי, והמחקר המקורי נשאר זמין לצדו כמקור, כולל ה־DOI או קישור כשהם קיימים.",
    body: hebrewBodies.research,
    seoTitle: "מרכז המחקר של Snacksmate: מחקרים על תנועה קצרה",
    seoDescription:
      "במרכז המחקר של Snacksmate תמצאו סיכומים בשפה פשוטה של מחקרים על חטיפי תנועה, VILPA, פעילות גופנית והתנהגות יושבנית, עם חיפוש, סינון וקישור למחקר המקורי.",
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
  "Snacksmate 2.0: קל יותר להתחיל לזוז לכמה דקות",
  "בונים חטיף תנועה שמתאים ליום שלכם",
  "העדפות תרגילים: תנועות שמתאימות לכם היום",
  "דירוג מאמץ: איך הרגיש חטיף התנועה שעשיתם",
  "מרכז המחקר: מחקרים על תנועה קצרה בשפה פשוטה",
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
