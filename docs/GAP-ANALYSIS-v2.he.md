# ניתוח פערים — מהמצב הקיים לאפיון v2

> יולי 2026 · משווה את מה שממומש היום (לפי `SPEC.he.md` v1) מול האפיון החדש (`SPEC-v2.he.md`, `SPEC-PLAYER.he.md`, `SPEC-DM.he.md`), ומגדיר תוכנית מימוש בשלבים.
>
> **מערכת עיצוב מחייבת:** `docs/design-system/` — "Wayward Realms" v1.1 (index.html חי + design-tokens.json). כל רכיב חדש מיושר לדפוסים שם: כפתור ראשי wine מלא / משני מתאר זהב, לוחיות מגן ל-AC/יוזמה/HP, section-bar, roll-chips, stat-blocks לבסטיארי, קוביות אובסידיאן עם ספרות אדומות, radius 8/12/18, shadow soft/float.
>
> **סקופ נוסף מה-DS:** רכיב Conditions & Ongoing Effects מלא (`docs/design-system/CONDITIONS-COMPONENT.he.md`) — מצבים עם משך/הצלה/stacks/נראות/אוטומציית תורים + Undo. משתלב בשלבים 3–4 (דורש מודל נתונים חדש CharacterCondition + אוטומציה בקרב).

---

## 1. מה כבר קיים ותואם את v2

התשתית והלוגיקה — רוב "המוח" של v2 כבר בנוי:

- **חשבונות ואבטחה:** אימייל+סיסמה, Google, אימות אימייל, איפוס סיסמה, סשנים מאובטחים, RBAC בשרת, הגבלת קצב, ולידציה.
- **מנוע חוקים:** מודיפיירים, PB, הצלות, כישורים, AC, יוזמה, מהירות, פסיביים, Spell Attack/DC, חריצים בריבוי-מקצועות + Pact, משאבי מקצוע, עומס, הצלות מוות, ריכוז, מנוחות, זכאות עליית דרגה — כל רשימת "החוקים המחושבים" של v2 §3.3 קיימת ומכוסה בבדיקות.
- **גיליון דמות עשיר:** גלגול מכל ערך, הטלת לחשים עם שדרוג וצריכת חריץ, מוני משאבים, מנוחות וקוביות פגיעה, מלאי עם equip/attune ומשקל, פיצ'רים לפי דרגה, אשף יצירת דמות ואשף עליית דרגה, ייבוא/ייצוא JSON.
- **קמפיין:** חבורה חיה, XP, זהב, מנוחות קבוצתיות, קוד הזמנה.
- **קרב חי:** מפה+רשת, אסימונים נגררים עם הרשאות, יוזמה, זרימת התקפה מלאה, ערפל מלחמה **מסונן בשרת**, לוחמים מוסתרים לא משודרים, סרגל, AoE, ~50 מפות + העלאה.
- **קומפנדיום SRD מלא**, PWA, Realtime rooms (כולל ערוץ DM נפרד).

**המשמעות:** v2 הוא בעיקר שכבת מוצר וממשק חדשה מעל מנוע קיים ותקין — לא כתיבה מחדש.

---

## 2. פערים מרכזיים מול v2

### 2.1 שפה עיצובית (v2.2 §4 — Light Fantasy Rulebook) — יישור, לא היפוך

v2.2 קובעת **Visual Direction Override: הממשק הראשי בהיר** — בדיוק הכיוון שכבר ממומש. הפער הוא יישור עדין:

| v2.2 דורש | קיים היום | פעולה |
|---|---|---|
| טוקנים מחייבים: canvas `#F3ECD9`, paper `#FBF7EA`, wine `#7A2B2F`, gold `#B58A42`, sage, mist-blue, rust, magic | קלף `#eee5ce`, קרם `#faf4e3`, maroon `#58180d`, זהב `#b28d4e` | עדכון ערכי הטוקנים המרכזיים + הוספת סמנטיים (sage/mist-blue/rust/magic/success/warning/danger) |
| גוף טקסט serif (Crimson Pro), UI/כפתורים Inter, כותרות Cinzel | גוף Alegreya Sans, כותרות Cinzel | החלפת פונט גוף ל-Crimson Pro + Inter לרכיבי UI |
| שימוש סמנטי בצבע: wine לכותרות/פעולות, sage לריפוי, mist-blue לקסם/מידע, rust למפלצות/סכנה | חלקי (maroon/זהב בלבד) | הרחבת השימוש הסמנטי |
| איורים: header דמות, עמודי מפלצות (bestiary), watercolor washes, ink sketches | אין איורים | שכבת איור — בשלבים 3–4 |
| §20 Player Handbook Experience + §19 DM Grimoire (stat-block styling, plaques, seals, ledger) | סגנון כרטיסים אחיד | מיושם יחד עם שלדי הפורטלים |

### 2.2 מבנה המוצר (v2 §2) — שני פורטלים

- אין היום **שער בחירת הקשר** (Player/DM) אחרי התחברות.
- אין **Player Portal shell**: header דמות קבוע/sticky על כל מסכי הדמות (עם AC/HP/יוזמה/מנוחות תמיד זמינים), Section Bar עם Grid/List, Section Drawer עם 12 מדורים, Bottom Nav של 5 יעדים, כפתור קובייה צף.
- אין **DM Portal shell**: sidebar בדסקטופ / bottom nav בנייד, DM Home Dashboard.
- היום הגיליון הוא עמוד יחיד ארוך; v2 דורש פירוק ל**מדורים** (Abilities / Skills / Actions / Spells / Inventory / Features / Proficiencies / Background / Notes / Extras / Manage).

### 2.3 מערכת קוביות תלת־ממדית (PLAYER §17+§19) — החלפה מלאה

מגש הקוביות הקיים (2D) מוחלף ב:

- **Overlay פיזיקלי** מעל כל המסך: Three.js + פיזיקה (cannon-es/Rapier), קוביות 3D אמיתיות d4–d100 שנזרקות, מתנגשות ונוחתות; זיהוי פאה עליונה.
- Roll Result Cards שקופים נערמים; Dice Builder Drawer; זריקה ידנית ב-flick; Themes; צליל/רטט; fallback 2D ו-reduced-motion.
- **פרסר נוסחאות מורחב:** kh/kl, drop, reroll, explode, success threshold.
- **Roll feed קמפייני עם visibility:** self / DM-only / public / hidden — נאכף בשרת.

### 2.4 עומק Player Portal (PLAYER §4–§16)

חסרים היום: קיבוץ פעולות לפי כלכלת-פעולה (Action/Bonus/Reaction) + רשימת פעולות כלליות (Dash, Dodge…); adv/dis ובונוס מצבי לכל גלגול; Pin לכישורים; Speed & Defenses (התנגדויות/חסינויות/פגיעויות, פירוק AC); מערכת Notes (קטגוריות, שיתוף עם DM); Extras/Creatures (פמיליאר, Wild Shape, בני לוויה); Manage Character מורחב (שכפול, ארכוב, overrides, milestone mode); תחמושת ו-charges לפריטים; Party Inventory מצד השחקן.

### 2.5 עומק DM Portal (SPEC-DM)

חסרים היום: DM Dashboard; מערכת **Sessions** (הכנה / מצב חי / recap); Encounter Builder עם **מחשבון קושי XP**; פאנל לוחם מלא עם stat block ופעולות; **Conditions עם משך ומקור**; לוג קרב עם **Undo** והסתרה; כלי מפה מתקדמים (ציור, ping, קירות/דלתות/תאורה, יישור רשת); ספריית אויבים עם פילטרים + **בונה מפלצות הומברו**; NPCs/Locations/Quests; **Notes & Secrets** עם visibility; Loot bundles + Party Inventory + חלוקה; אישור/נעילת עליות דרגה; הגדרות קמפיין (חוקי crit, נראות HP אויבים, נראות גלגולים, אישור הצטרפות); מטריצת הרשאות; **Audit log**; Impersonate player view.

### 2.6 רוחבי (v2 §6)

חסרים: Undo לפעולות קריטיות, Audit log, Skeleton loading, Empty states מסודרים, Print view, Shareable summary, קיצורי מקלדת.

---

## 3. תוכנית מימוש בשלבים — סטטוס

> **עודכן:** שלבים 1–6 מומשו. ✅ = הושלם, נבדק ונדחף. פערים שנשארו בכוונה מפורטים בסוף הסעיף.

- ✅ **שלב 1** — טוקנים ל-Light Fantasy Rulebook, שער Player/DM, ‏Character Shell (header דביק + מדורים), DM Home עם sidebar. *(Grid/List switch לא מומש — המדורים בחרו את הפריסה המתאימה להם.)*
- ✅ **שלב 2** — Overlay תלת־ממדי (Three.js+cannon-es, 7 סוגי קוביות, פאה=תוצאה, Roll Cards, Builder, fallback), פרסר מורחב, Roll feed עם visibility בשרת. *(Themes לקוביות ו-flick ידני — לא מומשו.)*
- ✅ **שלב 3** — Actions economy, ‏adv/dis+situational, ‏Pin skills, ‏Speed & Defenses, ‏Notes לשחקן. *(Extras/Creatures ו-charges/ammo — לא מומשו.)*
- ✅ **שלב 4** — מחשבון קושי, מערכת Conditions מלאה עם אוטומציית תורים, ספריית אויבים + Homebrew builder, DM Dashboard. *(כלי מפה מתקדמים — ציור/קירות/תאורה — לא מומשו; ping/ruler/AoE קיימים.)*
- ✅ **שלב 5** — Sessions (prep/live/recap), ‏NPCs/Quests עם הפרדת סודות, DM Notes & Secrets עם חשיפה חיה, Party Inventory עם claims, הגדרות קמפיין, Audit log. *(Locations כישות נפרדת — מכוסה חלקית דרך שדה location ב-NPC וקטגוריית Location בהערות; אישור עליות דרגה — לא מומש.)*
- ✅ **שלב 6** — Undo לנזק בקרב, אישורי מחיקה, Empty states, Print view + Character Summary, עדכון מסמכים.

### תוכנית השלבים המקורית (לתיעוד)

### שלב 1 — שפה עיצובית + שלדי הפורטלים *(היסוד להכל)*
1. החלפת טוקנים ל-Dark Fantasy UI לפי v2 §4.2 (מרכזי — `globals.css` + Tailwind + מעבר קשיחים).
2. שער בחירת הקשר Player/DM אחרי התחברות.
3. Player Shell: header דמות קבוע (Expanded/Compact/Combat/0HP/ריכוז), Section Drawer + Section Bar (Grid/List), Bottom Nav, כפתור קובייה צף.
4. DM Shell: sidebar דסקטופ + bottom nav נייד, DM Home בסיסי.
5. פירוק הגיליון הקיים למדורי ה-Shell (התוכן הקיים ממופה למדורים).

### שלב 2 — מערכת הקוביות התלת־ממדית
1. Overlay פיזיקלי (Three.js + cannon-es), 7 סוגי קוביות, זיהוי פאה, fallback 2D.
2. Dice Builder, Roll Cards, זריקה ידנית, Themes בסיסיים.
3. פרסר נוסחאות מורחב (kh/kl/drop/reroll/explode).
4. חיבור כל ה-rollables הקיימים ל-overlay + Roll feed קמפייני עם visibility בשרת.

### שלב 3 — עומק Player Portal
Actions economy + פעולות כלליות · adv/dis + situational לכל גלגול · Pin skills · Speed & Defenses · Notes · Extras/Creatures · Manage Character מורחב · charges/ammo.

### שלב 4 — עומק DM Portal (ליבה)
DM Dashboard · Encounter Builder + מחשבון קושי · פאנל לוחם מלא · Conditions עם משך · לוג עם Undo · ספריית אויבים + Homebrew builder · כלי מפה מתקדמים.

### שלב 5 — שכבת העולם והקמפיין
Sessions (prep/live/recap) · NPCs/Locations/Quests · Notes & Secrets · Loot & Party Inventory · הגדרות קמפיין + הרשאות + Audit log · אישור עליות דרגה.

### שלב 6 — ליטוש רוחבי
Undo/confirmation בכל פעולה קריטית · Skeletons/Empty states · Print view · Shareable summary · נגישות AA מלאה · ביצועים.

---

## 4. הערות יישום

- **אין צורך במיגרציית DB הרסנית** לשלבים 1–2; שלבים 3–5 מוסיפים טבלאות (notes, sessions, npcs, quests, party_inventory, audit_log, creatures) בלי לשבור קיים.
- מנוע החוקים, ה-API וה-realtime הקיימים משרתים את שני הפורטלים כמעט ללא שינוי — v2 עצמו קובע: "תומך בשחקן ובשה"מ באותה מערכת נתונים, עם ממשקים שונים לחלוטין".
- מערכת הקוביות תיבנה כחבילה מבודדת (`src/dice3d/`) עם API יציב (`roll(expression, options) → RollResult`) כדי ששני הפורטלים יצרכו אותה זהה, כנדרש ב-v2 §8.
