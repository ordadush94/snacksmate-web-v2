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
      text: "ב־Snacksmate 2.0 הרעיון נשאר אותו דבר: כמה דקות של תנועה ממוקדת, בבית, בעבודה, או בכל מקום שבו אתם כבר נמצאים. בדרך כלל בלי ציוד, ובלי לפנות שעה. מה שכן נהיה פשוט יותר הוא להתחיל.",
    },
    { style: "h2", text: "מפגש מוכן, בלי לתכנן" },
    {
      style: "normal",
      text: "כשאין זמן לחשוב מה לעשות, יש חטיפי תנועה מוכנים. במסך הבית אפשר לפתוח חטיף תנועה קצר לכל הגוף, חטיף תנועה לכוח, או חטיף תנועה קצר של אינטרוולים. כל אחד נמשך כמה דקות, קרוב יותר להפסקה מאשר לאימון בחדר כושר. תוכניות מוכנות נוספות בדרך.",
    },
    {
      style: "normal",
      text: "בזמן התנועה רואים את התרגיל, הסבר קצר איך לבצע אותו, וטיימר. ההדגמה נשארת על המסך. אפשר לעצור, ואפשר להחליף תרגיל אם התנועה לא מתאימה לרגע.",
    },
    { style: "h2", text: "לפי היום שלכם" },
    {
      style: "normal",
      text: "רמת הפעילות, המטרות וההעדפות משפיעות על מה שמוצע. אם חטיף התנועה שמופיע לא מתאים לזמן שיש לכם או לתנועות שנוחות לכם, אפשר להחליף תרגיל באמצע המפגש. זה חלק מהשימוש, לא סימן שמשהו לא עבד.",
    },
    {
      style: "normal",
      text: "זו התאמה מעשית, לא תוכנית רפואית. Snacksmate לא קובעת אם תרגיל בטוח לכם.",
    },
    { style: "h2", text: "גם מפגש קצר נשאר על המסך" },
    {
      style: "normal",
      text: "מפגש קצר נעלם בקלות בתוך יום עמוס. במסך ההתקדמות אפשר לראות יעד שבועי של חטיפי תנועה, הרצף הנוכחי, הרצף הטוב ביותר, המפגשים שהושלמו, הזמן שבו זזתם, וחטיפי התנועה שצברתם. היעד סופר חטיפי תנועה. הוא לא מבקש מכם למצוא שעה פנויה.",
    },
    {
      style: "normal",
      text: "כמה מפגשים כאלה אמורים להיראות כמו שבוע שבו זזתם, לא כמו שבוע ריק.",
    },
    { style: "h2", text: "מה הלאה" },
    {
      style: "normal",
      text: "נמשיך לפתח מפגשים קצרים, בעברית ובאנגלית. המבחן פשוט: האם אפשר לסיים את זה ביום רגיל?",
    },
    {
      style: "normal",
      text: "יש לכם כמה דקות? חטיף תנועה אחד הוא אימון שלם.",
    },
  ]),
  custom: blocks([
    {
      style: "normal",
      text: "חטיף תנועה מוכן מתאים כשנוח שמישהו אחר יבחר בשבילכם. כשאתם כבר יודעים כמה זמן יש, איפה אתם עומדים, ומה אתם מוכנים לעשות, אפשר לבנות את המפגש בעצמכם.",
    },
    { style: "h2", text: "מפגש שמתאים ליום הזה" },
    {
      style: "normal",
      text: "לא לכולם יש אותה יכולת, אותו חדר, או אותו זמן פנוי. תנועה שנוחה בסלון לא תמיד נוחה ליד שולחן. מה שמרגיש נכון בבוקר שקט יכול להיות יותר מדי בין שתי פגישות. כשבונים את המפגש בעצמכם, ההבדל הזה נכנס אליו, במקום שתצטרכו להידחק לתוכנית שנכתבה ליום אחר.",
    },
    {
      style: "normal",
      text: "זה מפגש אחד, לא תוכנית ארוכה. הוא צריך להיות קצר מספיק כדי לסיים, וברור מספיק כדי להתחיל בלי הסבר ארוך.",
    },
    { style: "h2", text: "מה בוחרים" },
    {
      style: "normal",
      text: "שתי החלטות: אילו תנועות נכנסות לחטיף התנועה, וכמה קצר הוא יכול להיות ועדיין להיות שווה את זה. על המסך רואים שם, הסבר קצר וטיימר, ואפשר להחליף תרגיל בלי לצאת מהמפגש. התנועות הן אלה שבחרתם.",
    },
    { style: "h2", text: "למה זה עוזר להתחיל" },
    {
      style: "normal",
      text: "אם האפשרות היחידה קשה מדי, דורשת יותר רצפה ממה שיש, או פשוט אינה התנועה שרציתם, היא נדחית. מפגש שבניתם בעצמכם קל יותר להתחיל. יכולת שונה, מרחב שונה, העדפות שונות וזמן פנוי שונה הם דבר רגיל. חטיף התנועה צריך להתאים ליום.",
    },
    {
      style: "normal",
      text: "זו לא התאמה רפואית, וזו לא תוכנית שנכתבה סביב אבחנה. זה מפגש קצר ליום שיש לכם עכשיו.",
    },
    { style: "h2", text: "מוכן, או מפגש משלכם" },
    {
      style: "normal",
      text: "כשרוצים להתחיל מהר, מתחילים ממפגש מוכן. כשהאפשרות המוכנה קרובה אבל לא מדויקת, בונים חטיף תנועה משלכם. בשני המקרים אלה כמה דקות של תנועה.",
    },
    {
      style: "normal",
      text: "נסו לבנות מפגש קצר שמתאים להמשך היום.",
    },
  ]),
  preferences: blocks([
    {
      style: "normal",
      text: "חטיף תנועה עובד רק אם אפשר לבצע את התרגיל. Snacksmate שימושית יותר כשהתנועות מתאימות ליכולת של היום, למקום שיש לכם, ולדרך שבה אתם מעדיפים לזוז.",
    },
    { style: "h2", text: "סיבות רגילות להניח תרגיל בצד" },
    {
      style: "normal",
      text: "לא צריך סיבה גדולה. תרגיל יכול להרגיש קשה מדי, החדר יכול לא להתאים, או שאתם מכירים את התנועה ומעדיפים אחרת. כל אחת מהסיבות האלה מספיקה. ההעדפות קיימות כדי שתרגיל לא מתאים לא יחסום מפגש שהייתם מסיימים.",
    },
    { style: "h2", text: "מה אפשר לכוון" },
    {
      style: "normal",
      text: "ההתאמה היא לפי רמת הפעילות, המטרות וההעדפות, לא לפי רשימה אחת לכולם. באמצע המפגש אפשר להחליף תרגיל בלי לוותר על חטיף התנועה, אם התנועה על המסך לא מתאימה לחדר או לאיך שהגוף מרגיש עכשיו.",
    },
    {
      style: "normal",
      text: "המטרה היא רשימה שאפשר להשתמש בה מהרגע שהיא נפתחת. ההתאמה אמורה להקל על המפגש, לא להאריך אותו.",
    },
    {
      style: "normal",
      text: "ההעדפות הן חלק מהמוצר, לא מסך נפרד. היעד השבועי עדיין סופר חטיפי תנועה שסיימתם. על המסך עדיין מופיעה תנועה אחת, עם הסבר קצר וטיימר. ההעדפה אמורה לדאוג לכך שהתנועה הראשונה כבר תתאים. אם היא לא מתאימה, מחליפים תרגיל.",
    },
    { style: "h2", text: "מה זה לא" },
    {
      style: "normal",
      text: "Snacksmate לא קובעת אם תרגיל בטוח לכם מבחינה רפואית. סימון העדפה אינו בדיקה רפואית, והוא לא מחליף ייעוץ של איש מקצוע כשצריך אותו. אתם בוחרים מה מתאים לכם. האפליקציה לא נותנת פסיקה רפואית.",
    },
    { style: "h2", text: "מפגש שאפשר להתחיל" },
    {
      style: "normal",
      text: "המבחר הטוב הוא זה שאפשר פשוט לבצע. כשהתנועות שמולכם אפשריות, כמה דקות נשארות כמה דקות.",
    },
    {
      style: "normal",
      text: "בפעם הבאה שתנועה לא מסתדרת, החליפו תרגיל, או עדכנו את ההעדפות כדי שהמפגש הבא יתחיל קרוב יותר אליכם.",
    },
  ]),
  effort: blocks([
    {
      style: "normal",
      text: "שני מפגשים יכולים לקחת אותן כמה דקות ולהרגיש אחרת לגמרי. דירוג המאמץ בסיום הוא דרך לשים לב לזה, כל עוד המפגש עוד טרי.",
    },
    { style: "h2", text: "חמש מילים, בלי ציון" },
    {
      style: "normal",
      text: "כשחטיף התנועה נגמר אפשר לסמן: קל מאוד, קל, בינוני, קשה, או מאמץ מקסימלי. קל מאוד אומר שחטיף התנועה בקושי עלה מעל שאר היום. מאמץ מקסימלי אומר שהדקות האלה ביקשו את כל מה שהיה לכם. קל, בינוני וקשה נמצאים באמצע. אף אחת מהמילים אינה ציון של הצלחה או כישלון.",
    },
    { style: "h2", text: "התווית על התוכנית אינה הדירוג שלכם" },
    {
      style: "normal",
      text: "מפגש מוכן יכול להיות מסומן מראש כמתון או כעצים. הסימון הזה שייך לתוכנית. הדירוג שייך למפגש שזה עתה נגמר. תוכנית שמסומנת כעצימה יכולה להרגיש בינונית היום, ותוכנית שמסומנת כמתונה יכולה להרגיש קשה.",
    },
    { style: "h2", text: "בשביל מה מסמנים" },
    {
      style: "normal",
      text: "מסמנים כדי לשים לב איך המפגש הרגיש. אולי ציפיתם למשהו קל וגיליתם שהוא תובעני, או להפך. בוחרים את המילה שמתאימה, ושם זה נגמר. חטיף התנועה היה המפגש. הדירוג הוא איך שאתם מתארים אותו.",
    },
    {
      style: "normal",
      text: "מאמץ אינו אותו דבר כמו השאלה אם חטיף התנועה היה שווה. גם כמה דקות בעצימות בינונית נחשבות.",
    },
    {
      style: "normal",
      text: "דווקא כשהמפגש קצר כדאי לעצור לרגע. כמה דקות של תנועה תובענית וכמה דקות של תנועה קלה יכולות לחלוק אותו טיימר ולבקש מאמץ שונה. אין נקודה נכונה על הסולם. מאמץ מקסימלי אינו פרס, וקל מאוד אינו פספוס. גם מפגש שהרגיש רגיל מקבל מילה.",
    },
    {
      style: "normal",
      text: "הדירוג עצמו אמור לקחת רגע. הוא לא אימון נוסף, והוא לא אמור להפוך את סוף המפגש למשימה שנייה. בוחרים את המילה שמתאימה, וממשיכים ביום.",
    },
    {
      style: "normal",
      text: "בסיום המפגש הבא, קחו רגע וסמנו איך זה הרגיש.",
    },
  ]),
  research: blocks([
    {
      style: "normal",
      text: "מרכז המחקר הוא המקום באתר שבו אפשר לקרוא על תנועה קצרה בשפה רגילה, בלי לקרוא כל מאמר כאילו הוא נכתב למומחים.",
    },
    { style: "h2", text: "על מה הסיכומים" },
    {
      style: "normal",
      text: "הסיכומים עוסקים ברעיונות שמאחורי Snacksmate: חטיפי תנועה, מקטעי אימון קצרים, VILPA, פעילות גופנית והתנהגות יושבנית. VILPA היא פעילות גופנית עצימה לסירוגין כחלק מחיי היום־יום: מאמץ קצר ועצים שקורה בתוך היום, לא רק באימון מתוכנן. הקיצור נשאר כמו במחקר.",
    },
    {
      style: "normal",
      text: "אפשר לחפש ולסנן לפי נושא, סוג מחקר ושנה. כל סיכום נכתב לקורא הרחב. המחקר המקורי נשאר המקור.",
    },
    { style: "h2", text: "המאמר המקורי נשאר בעמוד" },
    {
      style: "normal",
      text: "כשיש DOI או קישור למאמר, הם מופיעים בעמוד. ה־DOI מפנה אל המאמר. הסיכום מסביר את המחקר בשפה פשוטה יותר. הוא לא מחליף את המאמר, והוא לא ציטוט שמוצג כאילו כך סיכמו המחברים.",
    },
    {
      style: "normal",
      text: "כשהסיכום אומר מה אפשר לקחת מזה ליום־יום, זו הקריאה של Snacksmate את הראיות. כך גם ההסבר על המגבלות. זו לא עצה אישית.",
    },
    { style: "h2", text: "מה סיכום לא טוען" },
    {
      style: "normal",
      text: "מחקר יכול לעמוד ברקע של הרעיון גם אם Snacksmate עצמה לא נבחנה בו. מאמר במרכז עוסק בפעילות קצרה, בתנועה עצימה ביום־יום, או בזמן שיושבים. זו לא פסיקה על האפליקציה, והממצא לא חל אותו דבר על כל אדם.",
    },
    {
      style: "normal",
      text: "כשיש פרטים, הסיכום יכול לומר מי השתתף, מה נעשה במחקר, מה נמצא, ואיפה המגבלות. כתב העת והשנה נשארים עם המאמר. זה תיאור של המחקר, לא הבטחה על מה ש־Snacksmate תעשה למישהו.",
    },
    {
      style: "normal",
      text: "אם בא לכם לזוז, חטיף תנועה הוא עדיין כמה דקות של תנועה. אם בא לכם להבין את הראיות, מתחילים במרכז המחקר.",
    },
    {
      style: "normal",
      before: "אפשר להמשיך ",
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
    title: "Snacksmate 2.0 – מה חדש",
    excerpt:
      "כמה דקות של תנועה, בבית או בעבודה, בלי ציוד ובלי לפנות שעה. ב־Snacksmate 2.0 יש חטיפי תנועה מוכנים, מסך אימון שקל לעקוב אחריו, ומקום שמראה שגם מפגשים קצרים נספרים.",
    body: hebrewBodies.release,
    seoTitle: "Snacksmate 2.0: כמה דקות של תנועה בלי לפנות שעה",
    seoDescription:
      "ב־Snacksmate 2.0 מתחילים מחטיף תנועה מוכן, עוקבים אחרי התרגיל על המסך, ורואים את המפגשים הקצרים שכבר הסתיימו. בלי חדר כושר ובלי שעה פנויה, לרוב גם בלי ציוד.",
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
    title: "בנו חטיף תנועה משלכם",
    excerpt:
      "יש לכם כמה דקות, חדר מסוים, ותנועות שאתם מוכנים לעשות עכשיו? בנו חטיף תנועה אחד סביב זה. זה מפגש אחד ליום הזה, לא תוכנית ארוכה שנכתבה למישהו אחר, ולרוב בלי ציוד.",
    body: hebrewBodies.custom,
    seoTitle: "כך בונים ב־Snacksmate חטיף תנועה לפי היום שלכם",
    seoDescription:
      "מרכיבים ב־Snacksmate מפגש אחד לפי הזמן, המקום והתנועות שמתאימים עכשיו. חטיף תנועה כזה נשאר קצר, ואפשר להחליף תרגיל בלי לצאת ממנו. לרוב בלי ציוד.",
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
    title: "בחרו את התרגילים שמתאימים לכם",
    excerpt:
      "לפעמים התרגיל קשה מדי, החדר קטן מדי, או שפשוט בא לכם היום תנועה אחרת. ההעדפות ב־Snacksmate קיימות כדי שמפגש קצר לא ייתקע בגלל זה. זו בחירה שלכם, לא בדיקה רפואית.",
    body: hebrewBodies.preferences,
    seoTitle: "העדפות תרגילים ב־Snacksmate, כדי שהמפגש יתחיל",
    seoDescription:
      "כשתנועה לא מתאימה לחדר, לגוף או להעדפה שלכם, מחליפים תרגיל בלי לוותר על חטיף התנועה. ההתאמה נשארת קצרה, והיא לא מאריכה את המפגש. זה כל הסיפור.",
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
    title: "חדש: דרגו את המאמץ בסיום חטיף תנועה",
    excerpt:
      "אותן כמה דקות יכולות להרגיש קלות או קשות, תלוי מאוד ביום. בסיום מסמנים קל מאוד, קל, בינוני, קשה או מאמץ מקסימלי. זו מילה על המפגש שזה עתה נגמר, לא ציון שצריך לעבור.",
    body: hebrewBodies.effort,
    seoTitle: "דירוג מאמץ ב־Snacksmate: מקל מאוד עד מאמץ מקסימלי",
    seoDescription:
      "בסיום חטיף תנועה ב־Snacksmate בוחרים מילה אחת, מקל מאוד ועד מאמץ מקסימלי. כך שמים לב איך המפגש הקצר הרגיש. זה לא ציון שצריך לעבור או להיכשל בו.",
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
      "במרכז המחקר של Snacksmate יש סיכומים בעברית פשוטה על חטיפי תנועה, על מקטעים קצרים, על VILPA ועל התנהגות יושבנית. המאמר המקורי וה־DOI נשארים בעמוד, ליד הסיכום עצמו.",
    body: hebrewBodies.research,
    seoTitle: "מרכז המחקר של Snacksmate: סיכום בעברית, והמקור",
    seoDescription:
      "סיכומים קצרים על חטיפי תנועה, מקטעים קצרים, VILPA והתנהגות יושבנית. ליד כל סיכום נשארים המאמר המקורי וה־DOI, כדי שאפשר יהיה לחזור אל המחקר עצמו.",
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
  "בנו חטיף תנועה משלכם",
  "בחרו את התרגילים שמתאימים לכם",
  "חדש: דרגו את המאמץ בסיום חטיף תנועה",
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
