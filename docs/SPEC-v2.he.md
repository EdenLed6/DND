# מסמך אפיון־על — D&D 5e Campaign Manager
> **Visual Direction Override:** הממשק הראשי בהיר. אין להשתמש ב־dark UI כברירת מחדל. הכיוון המחייב הוא Light Fantasy Rulebook.

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


## שפה עיצובית מעודכנת — Light Fantasy Rulebook

### כיוון כללי

המוצר יהיה בהיר, עשיר ומאויר, בהשראת התחושה של ספרי חוקים ובסטיארי פנטזיים מודפסים:

- רקע קלף בהיר, לא לבן סטרילי.
- טקסט כהה בגוון דיו.
- מסגרות דקות ודקורטיביות.
- כותרות בגוון אדום־יין / חום עמוק.
- קווי הפרדה זהובים־חומים.
- אזורי מידע שמרגישים כמו stat blocks מתוך ספר.
- כתמי צבע מאוירים, watercolor washes ו־ink sketches.
- איורים גדולים משולבים בתוך המסך, בעיקר ב־headers, creature pages ו־campaign pages.
- שכבות נייר, סימני קיפול עדינים, קצוות דהויים וטקסטורות עדינות בלבד.
- העיצוב חייב להרגיש איכותי ומודרני, לא "אתר וינטג׳" ולא סריקה ישנה.

### עקרון מרכזי

ה־UX יכול להיות צפוף ורובסטי כמו D&D Beyond, אך המעטפת הגרפית תהיה של ספר חוקים פנטזי חי:

- תוכן נוח לסריקה.
- הרבה טבלאות ורשימות.
- כותרות חזקות.
- modules בהירים.
- sections ארוכים.
- sticky headers.
- כפתורים מודרניים.
- ללא רקע כהה כממשק ראשי.
- ללא neon.
- ללא purple gaming aesthetic.
- ללא cards לבנים גנריים בסגנון SaaS.

### טוקנים צבעוניים

- `--canvas: #F3ECD9`
- `--paper: #FBF7EA`
- `--paper-deep: #E9DFC5`
- `--ink: #2B241D`
- `--ink-soft: #5E5448`
- `--wine: #7A2B2F`
- `--wine-dark: #552025`
- `--gold: #B58A42`
- `--gold-soft: #D7C08A`
- `--sage: #8C9877`
- `--mist-blue: #8DA7B4`
- `--rust: #A85D3B`
- `--line: #CDBF9F`
- `--line-strong: #A38C62`
- `--success: #6F8A5B`
- `--warning: #B98338`
- `--danger: #A33F3F`
- `--magic: #6E5B9B`

### שימוש בצבע

- אדום־יין: כותרות, active states, section labels, primary actions.
- זהב: borders, accents, stat ornaments, focus rings.
- ירוק־מרווה: healing, nature, successful states.
- כחול מעושן: magic, arcane data, informational callouts.
- חלודה: monsters, fire, danger, destructive actions.
- שחור/דיו: גוף טקסט עיקרי.

### טיפוגרפיה

- Display headings: `Cinzel`, `Cormorant SC` או serif דקורטיבי דומה.
- Body: `Crimson Pro`, `Source Serif 4` או serif קריא.
- UI labels/buttons: `Inter` או sans נקי.
- Stat values: serif numerals עם tabular lining.
- Section labels: uppercase small caps.
- גוף טקסט בנייד: 16–18px.
- line-height: 1.45–1.6.
- אין להשתמש בפונט דקורטיבי בגוף טקסט ארוך.

### משטחים ורכיבים

#### Page Canvas
- רקע קלף עם noise עדין.
- watercolor stain אופציונלי בפינות.
- לא להשתמש בצל כבד.

#### Section Header
- פס כותרת בהיר עם קו זהב.
- אייקון מאויר קטן.
- כותרת ב־wine.
- grid/list toggle בצד.

#### Stat Block
- רקע parchment עמוק יותר.
- מסגרת כפולה או קו עליון/תחתון.
- כותרת אדומה.
- ערכים צפופים.
- שימוש בטבלאות דקות.

#### Cards
- לא כל דבר יהיה card.
- card רק לאובייקט עצמאי.
- border דק.
- radius קטן יחסית, 8–14px.
- shadow עדין מאוד.

#### Buttons
- Primary: wine על parchment.
- Secondary: outline gold.
- Ghost: שקוף.
- Danger: rust/red.
- כפתורי Roll: כחול־מעושן או wine עם אייקון קובייה.

### איורים

- איור דמות ב־character header.
- איור מפלצת ב־enemy detail.
- איורי environment בקמפיין ובמפות.
- ink sketches באזורי whitespace.
- watercolor background crops.
- איורים לעולם לא יפגעו בקריאות.
- יש להימנע מעומס של dragons/swords בכל מקום.

### דקורציה

- מסגרות פינתיות עדינות.
- botanical/arcane flourishes.
- sigils.
- runes.
- dividers בהשראת פרקי ספר.
- stat block bars.
- parchment tabs.
- map labels.
- wax seal רק במקומות טקסיים.

### מובייל

- הבהירות נשמרת גם במובייל.
- header דמות יכול להיות בגוון parchment עמוק יותר.
- bottom nav בהיר עם border עליון.
- floating dice button יכול להיות wine.
- sticky section headers על רקע paper אטום.
- אין מעבר אוטומטי למצב כהה.

### דסקטופ

- canvas רחב שמרגיש כמו spread של ספר.
- עמודת תוכן ראשית + side reference panels.
- אפשרות ל־two-column editorial layout.
- large illustrations as anchored side art.
- stat blocks יכולים לשבת לצד lore text.

### נגישות

- contrast מינימלי AA.
- טקסט לעולם לא מונח ישירות על איור עמוס ללא overlay.
- focus ring זהוב ברור.
- צבע אינו הסמן היחיד.
- supports reduced motion.



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