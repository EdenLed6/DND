# Roadmap / מפת דרכים

בנייה מדורגת. כל milestone נותן ערך עצמאי וניתן להרצה. סימון: ✅ הושלם, 🚧 בעבודה, ⬜ מתוכנן.

## Milestone 0 — Planning & Data / תכנון ונתונים
- ✅ מסמכי תכנון מלאים (docs 00–09) — "מוח D&D"
- ✅ איסוף dataset SRD 5.1 מלא (`data/srd/srd.sqlite`)

## Milestone 1 — Foundation / תשתית
- ⬜ Scaffold: Next.js 15 + TS + Tailwind
- ⬜ Prisma schema (מודל מלא מ-`02-DATA-MODEL.md`)
- ⬜ Custom server + Socket.IO (`server.ts`)
- ⬜ Auth: register/login/session
- ⬜ Seed: ייבוא SRD + skills + backgrounds

## Milestone 2 — Rules Engine / מנוע החוקים
- ⬜ `lib/dnd/dice.ts` — מנוע קוביות + adv/dis + crit
- ⬜ `lib/dnd/rules.ts` — טבלאות (XP, PB, spell slots, currency, sizes)
- ⬜ `lib/dnd/character.ts` — כל הנגזרים
- ⬜ `lib/dnd/combat.ts` — attack/damage/save + parsing stat blocks
- ⬜ בדיקות יחידה לנוסחאות הקריטיות

## Milestone 3 — Compendium / קומפנדיום
- ⬜ דפדוף/חיפוש: spells, monsters, equipment, magic items, races, classes,
      conditions, rules
- ⬜ דפי פריט מלאים

## Milestone 4 — Character Management / ניהול דמות
- ⬜ אשף יצירת דמות (8 שלבים)
- ⬜ גיליון דמות live (כל 9 החלקים)
- ⬜ עריכה + broadcast
- ⬜ Level-up flow

## Milestone 5 — Campaign Management / ניהול קמפיין
- ⬜ יצירה/הזמנה/הצטרפות
- ⬜ לוח DM: Party, Progression (XP/level), Loot & Gold, Rest, Notes
- ⬜ DM edit-any-character
- ⬜ Live sync מלא לקמפיין

## Milestone 6 — Combat & Maps / קרב ומפות
- ⬜ מפות: העלאה + כיול רשת + ספריית מפות
- ⬜ טוקנים draggable (dnd-kit) עם live sync
- ⬜ Encounter lifecycle + initiative tracker
- ⬜ Attack flow (DM→players, multi-target, save-based)
- ⬜ CombatLog live

## Milestone 7 — Polish / ליטוש
- ⬜ ספריית מפות דוגמה (30–50)
- ⬜ Fog of war
- ⬜ ייצוא/ייבוא דמות (JSON)
- ⬜ נגישות + מובייל
- ⬜ i18n (עברית/אנגלית)

## Build Order Rationale / הגיון סדר הבנייה
תשתית → מנוע חוקים (הכל תלוי בו) → קומפנדיום (נתונים לצפייה) → דמות (הליבה
שהשחקן רואה) → קמפיין (ה-DM והחיבור) → קרב (המורכב ביותר, נשען על כל הקודם).

## Definition of Done (per feature)
1. Server-side logic + RBAC.
2. Prisma persistence.
3. Broadcast event (live).
4. Client UI + store handling.
5. חישוב תואם `03-DND-BRAIN.md`.
