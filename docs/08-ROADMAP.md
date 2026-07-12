# Roadmap / מפת דרכים

בנייה מדורגת. כל milestone נותן ערך עצמאי וניתן להרצה. סימון: ✅ הושלם, 🚧 בעבודה, ⬜ מתוכנן.

## Milestone 0 — Planning & Data / תכנון ונתונים
- ✅ מסמכי תכנון מלאים (docs 00–09) — "מוח D&D"
- ✅ איסוף dataset SRD 5.1 מלא (`data/srd/srd.sqlite`)

## Milestone 1 — Foundation / תשתית ✅
- ✅ Scaffold: Next.js 15 + TS + Tailwind
- ✅ Prisma schema (מודל מלא מ-`02-DATA-MODEL.md`)
- ✅ Custom server + Socket.IO (`server.ts`)
- ✅ Auth: register/login/session
- ✅ Seed: ייבוא SRD + skills + backgrounds

## Milestone 2 — Rules Engine / מנוע החוקים ✅
- ✅ `lib/dnd/dice.ts` — מנוע קוביות + adv/dis + crit
- ✅ `lib/dnd/rules.ts` — טבלאות (XP, PB, spell slots, currency, sizes)
- ✅ `lib/dnd/character.ts` — כל הנגזרים
- ✅ `lib/dnd/combat.ts` — attack/damage/save + parsing stat blocks
- ✅ בדיקות יחידה (15 tests) לנוסחאות הקריטיות

## Milestone 3 — Compendium / קומפנדיום ✅
- ✅ דפדוף/חיפוש: spells, monsters, equipment, magic items, races, classes,
      conditions
- ⬜ דפי פריט מלאים (modal details) — עתידי

## Milestone 4 — Character Management / ניהול דמות ✅
- ✅ אשף יצירת דמות (race/class/abilities/background/skills/details)
- ✅ גיליון דמות live (abilities, saves, skills, combat, spells, currency, items)
- ✅ עריכה + broadcast
- ✅ Level-up flow (DM +L/−L, HP recompute)

## Milestone 5 — Campaign Management / ניהול קמפיין ✅
- ✅ יצירה/הזמנה/הצטרפות (invite code)
- ✅ לוח DM: Party, Progression (XP/level), Loot & Gold, Rest
- ✅ DM edit-any-character
- ✅ Live sync מלא לקמפיין

## Milestone 6 — Combat & Maps / קרב ומפות ✅
- ✅ מפות: יצירה + רשת + תמונת URL (העלאת קבצים — עתידי)
- ✅ טוקנים draggable (dnd-kit) עם live sync
- ✅ Encounter lifecycle + initiative tracker
- ✅ Attack flow (DM→players, multi-target, save-based)
- ✅ CombatLog live

## Milestone 7 — Polish / ליטוש ✅ (רובו)
- ✅ ספריית מפות דוגמה (63 מפות SVG פרוצדורליות) + העלאת קבצי מפה
- ✅ Fog of war (חשיפה/הסתרה חיה, מכחול DM)
- ✅ ייצוא/ייבוא דמות (JSON)
- ✅ ניהול inventory מלא מהקומפנדיום בגיליון (הצטיידות/attunement, AC מגיב)
- ✅ ניהול קסמים בגיליון + מודל פרטים בקומפנדיום
- ⬜ נגישות + מובייל · i18n מלא (עברית/אנגלית) — עתידי

## Milestone 8 — Advanced ✅ (mostly)
- ✅ English UI throughout (app is English-only)
- ✅ Level-up wizard: HP (average/roll/max), ASI or feat, subclass selection,
     multiclass with ability prerequisites
- ✅ Token avatars/images, distance ruler (5ft), AoE templates (circle/square/
     cone/line)
- ⬜ Automatic subclass feature grants by level (currently subclass is recorded;
     feature text not auto-applied) — future
- ⬜ Accessibility polish + full mobile layout — future
- ⬜ Optional: Postgres + Pusher/Ably for serverless deployment — future infra

## Build Order Rationale / הגיון סדר הבנייה
תשתית → מנוע חוקים (הכל תלוי בו) → קומפנדיום (נתונים לצפייה) → דמות (הליבה
שהשחקן רואה) → קמפיין (ה-DM והחיבור) → קרב (המורכב ביותר, נשען על כל הקודם).

## Definition of Done (per feature)
1. Server-side logic + RBAC.
2. Prisma persistence.
3. Broadcast event (live).
4. Client UI + store handling.
5. חישוב תואם `03-DND-BRAIN.md`.
