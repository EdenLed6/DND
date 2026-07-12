# Character System / מערכת הדמות

מטרה: parity עם ניהול השחקן ב-D&D Beyond. להלן כל מה שהמערכת מכסה — חלוקה ל-
**יצירת דמות** (wizard) ו-**גיליון דמות** (live sheet).

## A. Character Creation Wizard / אשף יצירה

שלבים (כל שלב מונחה-SRD, עם ברירות מחדל חכמות):

1. **גזע (Race)** — בחירה מ-9 גזעי SRD + subrace. מחיל: ability bonuses, מהירות,
   גודל, שפות, traits (Darkvision, Fey Ancestry, ...), proficiencies גזעיים.
2. **מקצוע (Class)** — בחירה מ-12 מקצועות. מגדיר: hit die, saving throw prof,
   armor/weapon/tool prof, בחירת מיומנויות (choose N from list), starting equipment,
   spellcasting. (subclass נבחר ברמה הרלוונטית.)
3. **יכולות (Ability Scores)** — Standard array / Point buy / Roll (ראה brain §1),
   ואז בונוסים גזעיים.
4. **רקע (Background)** — נותן 2 skill prof, tool/language prof, feature, ו-
   starting gold/equipment. (סט רקעים מובנה — ראה §D.)
5. **פרטים** — שם, alignment, avatar, אישיות (traits/ideals/bonds/flaws — טקסט).
6. **ציוד פתיחה** — בחירה מחבילות ה-class/background או קניית starting gold.
7. **קסמים** (אם רלוונטי) — בחירת cantrips + spells known/prepared מרשימת המקצוע.
8. **סיכום** — המנוע מחשב את כל הנגזרים ומציג preview לפני שמירה.

## B. Character Sheet Sections / חלקי הגיליון

הגיליון הוא **live** — כל שדה נערך (בהתאם להרשאות) ומשודר. חלקים:

### 1. Header
שם, גזע/subrace, מקצוע+רמה (multiclass מוצג "Fighter 3 / Wizard 2"), רקע,
alignment, XP + progress bar לרמה הבאה, Inspiration toggle.

### 2. Ability Scores & Saves
6 בלוקים (score, mod). Saving throws: 6 שורות עם proficiency toggle, ערך מחושב.
Proficiency bonus מוצג בראש.

### 3. Skills
18 שורות: שם, יכולת, proficiency/expertise toggle, ערך מחושב. Passive Perception/
Investigation/Insight מחושבים ומוצגים.

### 4. Combat Block
AC, Initiative, Speed, HP (current/max/temp), Hit Dice (used/total), Death Saves
(3+3 checkboxes), Exhaustion (0–6), רשימת Conditions פעילים (הוספה/הסרה),
Concentration indicator.

### 5. Actions & Attacks
- **Attacks:** כל נשק מצויד → to-hit ו-damage מחושבים; כפתור "Roll Attack".
- **Actions/Bonus/Reactions:** מה-class features + נשקים.
- **Spells (אם caster):** רשימה לפי רמה, cantrips, spell save DC/attack, slots
  (עיגולים ללחיצה = ניצול/שחזור), prepared toggles, ritual/concentration תגים,
  כפתור "Cast".

### 6. Inventory
פריטים (SRD + הומברו), quantity, equipped/attuned toggles, משקל כולל מול carry
capacity, מטבעות (cp/sp/ep/gp/pp) עם המרה, כפתורי הוספה מהקומפנדיום.

### 7. Features & Traits
Race traits, class features לפי רמה, feats, background feature — עם תיאורים
מלאים (מ-SRD). Resources (Rage/Ki/Sorcery Points/Superiority Dice) עם מונה
used/max וכפתור reset.

### 8. Proficiencies & Languages
Armor, weapons, tools, languages — מרוכזים מכל המקורות.

### 9. Description / Roleplay
Personality traits, ideals, bonds, flaws, backstory, notes, avatar.

## C. Derived Calculations (המנוע) 

כל אלה מחושבים ב-`lib/dnd/character.ts` מהבחירות (ראה brain לנוסחאות):
proficiencyBonus, ability mods, AC (עם שריון/מגן/unarmored), maxHP,
saving throws ×6, skills ×18, passive scores, initiative, spell save DC,
spell attack bonus, spell slots (לפי caster type + multiclass), carry capacity.

**DM Override:** ה-DM יכול לדרוס כל ערך נגזר (למשל AC ידני, maxHpBonus, בונוס
מותאם) — נשמר בשדות `*Bonus`/`*Json`. השחקן רואה את הערך הסופי.

## D. Backgrounds (seed) / רקעים

ה-SRD sqlite אינו כולל טבלת backgrounds, לכן נזין סט מובנה (SRD + נפוצים):
Acolyte, Charlatan, Criminal, Entertainer, Folk Hero, Guild Artisan, Hermit,
Noble, Outlander, Sage, Sailor, Soldier, Urchin.
כל רקע: 2 skill prof, tool/language prof, feature (שם+תיאור), starting gold,
suggested equipment. מוגדר ב-`prisma/seed.ts` כ-`SrdBackground`.

## E. Multiclassing / רב-מקצועיות
נתמך דרך `CharacterClass[]`. totalLevel = סכום. PB לפי totalLevel. HP מצטבר לפי
כל class. Spell slots לפי caster-level מאוחד (brain §9.2). דרישות סף
(prerequisites) נבדקות אך ה-DM יכול לעקוף.
