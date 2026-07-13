# מסמך אפיון־על — D&D 5e Campaign Manager

> גרסה 2.0 · יולי 2026  
> מסמך זה מחליף את גרסה 1.0 ומפצל את המוצר לשתי חוויות מוצר מלאות: **Player Portal** ו־**Dungeon Master Portal**.  
> מסמכי העומק:
>
> - `SPEC-PLAYER.he.md`
> - `SPEC-DM.he.md`

---

## 1. חזון המוצר

אפליקציית PWA מלאה לניהול מבוכים ודרקונים מהדורה 5, שמחליפה דפי דמות, אפליקציות קוביות, כלי יוזמה, מפות, אקסלים, ספרי עזר ופתקים.

המוצר אינו "דשבורד SaaS עם עיצוב פנטזיה". הוא צריך להרגיש כמו **כלי משחק מקצועי** שנבנה סביב שולחן D&D אמיתי:

- מהיר בזמן משחק.
- עשיר ומפורט מחוץ למשחק.
- מחושב אוטומטית.
- מתאים קודם כול לנייד, אך מלא גם בדסקטופ.
- תומך בשחקן ובשה"מ באותה מערכת נתונים, עם ממשקים שונים לחלוטין.

---

## 2. מבנה המוצר

### 2.1 שער כניסה

לאחר התחברות המשתמש בוחר הקשר:

1. **Player Portal**
2. **Dungeon Master Portal**

משתמש יכול לעבור בין המצבים ללא יציאה מהחשבון, אם יש לו הרשאה מתאימה.

### 2.2 Player Portal

ממוקד בדמות אחת פעילה בכל רגע, עם אפשרות להחליף דמות.

מודולים ראשיים:

- Overview / Stats
- Abilities, Saves & Senses
- Skills
- Actions
- Spells
- Inventory
- Features & Traits
- Proficiencies & Training
- Background
- Notes
- Extras / Creatures
- Character Management
- Live Dice

### 2.3 Dungeon Master Portal

ממוקד בקמפיין פעיל, עם אפשרות לעבור בין קמפיינים.

מודולים ראשיים:

- Campaign Dashboard
- Party & Characters
- Sessions
- Encounters
- Live Combat
- Enemies
- Maps
- Loot & Party Inventory
- Notes & Secrets
- Progression
- Compendium / Homebrew
- Campaign Settings
- Permissions

---

## 3. עקרונות UX

### 3.1 Mobile-first אמיתי

המסכים של השחקן צריכים לעבוד היטב ברוחב 360–430px, כי בזמן משחק המשתמש מחזיק טלפון.

- Bottom navigation קבוע.
- Header דמות קבוע או collapsible.
- כפתורי פעולה בגובה מינימלי 44px.
- גלילה אנכית אחת.
- פעולות קריטיות נגישות ביד אחת.
- קובייה צפה נגישה תמיד.
- Safe areas של Android ו־iOS.

### 3.2 מידע צפוף אך קריא

D&D דורש הרבה מידע. אין לנסות "לפשט" באמצעות הסתרת תוכן חיוני.

המערכת תשתמש ב:

- היררכיה טיפוגרפית ברורה.
- כותרות מדור חזקות.
- שורות נתונים צפופות.
- Grid ו־List switch.
- מודולים מתקפלים.
- Sticky section headers במסכים ארוכים.
- Search ו־Filter בכל רשימה גדולה.

### 3.3 חוקים מחושבים אוטומטית

המשתמש בוחר החלטות משחק, והמנוע מחשב:

- Modifiers
- Proficiency Bonus
- Saving Throws
- Skills
- Armor Class
- Initiative
- Speed
- Passive Scores
- Spell Attack
- Spell Save DC
- Spell Slots
- Resources
- Encumbrance
- Death Saves
- Concentration
- Multiclass progression
- Rest recovery
- Level-up eligibility

### 3.4 Realtime

כל שינוי רלוונטי בקמפיין מתעדכן בזמן אמת:

- HP
- Conditions
- Initiative
- Token location
- Spell slots
- Resources
- Shared inventory
- Encounter state
- Fog of war
- Session status
- Notes shared by DM

### 3.5 הפרדת מידע

מידע DM-only לעולם אינו נשלח ללקוח של שחקן:

- Hidden enemies
- Secret notes
- Unrevealed map areas
- Trap locations
- Encounter preparation
- Enemy HP when hidden by DM setting
- Private NPC data

---

## 4. שפה עיצובית

### 4.1 כיוון

Dark Fantasy Product UI:

- בסיס כהה מאוד, כמעט שחור.
- Surface בגווני slate / charcoal.
- Header בגוון blue-black.
- Accent ראשי crimson.
- Accent משני arcane blue.
- טקסט לבן/אפור בהיר.
- קווים דקים כחולים־אפורים.
- איורי טקסטורה ו־fantasy motifs רק כרקע משני.
- ללא קלף בהיר כממשק הראשי בנייד.
- ללא ניאון סגול.
- ללא "כרטיסים" לבנים בסגנון SaaS.

### 4.2 טוקנים ראשיים

- `--bg-deep: #0B1115`
- `--bg-app: #10181D`
- `--surface-1: #19242C`
- `--surface-2: #22313D`
- `--surface-3: #2B3D4A`
- `--line: #334754`
- `--text-primary: #F3F5F6`
- `--text-secondary: #95A5B2`
- `--accent-red: #D20A16`
- `--accent-blue: #2299E8`
- `--success: #65B84A`
- `--warning: #D89A33`
- `--danger: #E14949`
- `--magic: #9957D9`

### 4.3 טיפוגרפיה

- UI: Inter / Roboto / system sans
- Fantasy display: Cinzel, רק בכותרות נבחרות
- מספרים: tabular numerals
- גוף טקסט: 16–18px בנייד
- Labels: uppercase 11–13px
- Section titles: 22–28px

---

## 5. ניווט

### שחקן

Bottom navigation:

- Characters
- Campaigns
- Search / Compendium
- Dice History
- Profile

בתוך דמות:

- Section selector
- Grid/List switch
- Floating dice button

### שה"מ

Desktop sidebar / Mobile bottom navigation:

- Campaigns
- Party
- Encounters
- Live Combat
- Enemies
- More

---

## 6. דרישות רוחביות

- PWA
- Offline shell
- Realtime sockets
- Optimistic updates
- Audit log לפעולות DM
- Accessibility AA
- Keyboard navigation בדסקטופ
- Touch targets ≥44px
- `prefers-reduced-motion`
- Autosave
- Undo לפעולות קריטיות
- Confirmation לפעולות הרסניות
- Skeleton loading
- Empty states
- Error recovery
- Export / Import JSON
- Shareable character summary
- Print view

---

## 7. מסמכי המשך

היישום חייב להתבסס על שני מסמכי העומק המצורפים. כל מסך או רכיב שלא מוגדר במסמך־העל מפורט באחד מהם.

---

## 8. מערכת קוביות גלובלית

מערכת הקוביות היא שכבת מוצר גלובלית, לא רכיב מקומי.

- זמינה ב־Player Portal וב־DM Portal.
- מוצגת כ־3D overlay מעל המסך.
- תומכת בכמה קוביות וב־custom formulas.
- מתחברת לכל rollable entity.
- מפרסמת תוצאות ל־campaign log.
- מכבדת private/public/DM-only rolls.
- משתמשת באותו physics engine בכל הפורטלים.
- ה־DM יכול לראות roll feed בזמן אמת.
- ה־DM יכול לבצע hidden rolls.
- ה־DM יכול להגדיר אם שחקנים רואים enemy rolls.
- כללי הפיזיקה, האנימציה וה־UI מפורטים ב־`SPEC-PLAYER.he.md`, סעיף 19.
