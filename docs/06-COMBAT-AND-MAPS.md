# Combat & Maps / קרב ומפות

ניהול קרב מלא + ניהול מפות מלא, בקנה מידה 5e תקני (5 רגל למשבצת).

## A. Maps / מפות

### מקורות מפה
1. **העלאה** — ה-DM מעלה תמונה (PNG/JPG). מוגדר `gridSize` (px למשבצת),
   `offsetX/Y` לכיול הרשת לתמונה, ו-`gridCols/Rows`.
2. **ספריית מפות מובנית** — סט מפות דוגמה (מבוכים, טברנות, חדרים, מערות, יערות).
   כל מפה עם רשת מוגדרת מראש. (מתוכנן: 30–50 מפות; ניתן להרחבה.)
3. **מחולל רשת** — מפה ריקה עם רשת בגודל נבחר (battle grid) לשרטוט מהיר.

> **קנה מידה:** ברירת מחדל 70px = 5ft. המערכת שומרת מיקומי טוקנים ב-**קואורדינטות
> רשת** (gridX,gridY), לא בפיקסלים — כך המרחקים תמיד נכונים ל-5e (משבצת = 5ft;
> אלכסון = 5ft בכלל הפשוט, או 5/10 בכלל האופציונלי).

### שכבת המפה (rendering)
תמונת רקע → canvas/div עם overlay רשת → שכבת טוקנים (dnd-kit draggable) →
שכבת מדידה (סרגל מרחק בין 2 משבצות). Fog of war אופציונלי (v2).

## B. Tokens / טוקנים

- כל **Combatant** (שחקן/אויב) מקבל `Token` על המפה.
- גודל הטוקן = `sizeSquares` לפי גודל היצור (brain §16).
- טוקן מציג: label, צבע/תמונה, מד HP קטן (אם גלוי), טבעת מצב.
- **גרירה:** ה-DM גורר כל טוקן; שחקן גורר רק את הטוקן שלו (אם ה-DM מאפשר).
  הזזה → `token:moved` משודר → כולם רואים מיד.
- **הצבה ראשונית:** ה-DM מציב שחקנים ואויבים על הלוח לפני/בתחילת הקרב.

## C. Encounter Lifecycle / מחזור חיי הקרב

```
PLANNING → ACTIVE → ENDED
```
1. **PLANNING:** ה-DM בונה את הקרב — בוחר מפה, מוסיף שחקנים (מהקמפיין) ואויבים
   (מהבסטיאריון SRD או מותאם), מציב טוקנים.
2. **Roll Initiative:** לכל combatant מגלגלים d20+dexMod (או ה-DM מזין ידנית).
   השורות ממוינות → `Combatant.initiative`. `turnIndex=0`, `round=1`.
3. **ACTIVE:** מעקב תורים. הטראקר מדגיש את היצור הפעיל. כפתורי Next/Prev turn;
   בסוף הסבב `round++`.
4. **ENDED:** ה-DM מסיים → אופציה ל-Award XP לקבוצה.

## D. Initiative Tracker / מעקב יוזמה

טבלה ממוינת: initiative, שם, HP (current/max, נערך ישירות), AC, מצבים, תג "פעיל".
ה-DM יכול: לשנות HP (נזק/ריפוי), להוסיף/להסיר מצבים, להעלים/לחשוף אויב
(`isVisible`), לגלגל תקיפה. הכל live.

## E. Attack Rolls / גלגולי תקיפה (הדרישה המרכזית)

### DM תוקף עם אויב מול שחקנים
```
1. בחר Combatant תוקף (אויב) → נטען ה-stat block (SRD monster או snapshot)
2. בחר action מהרשימה (Scimitar, Bite, Multiattack...)
   → המנוע מפרסר "+X to hit", "reach/range", "Y (ZdW+B) type damage"
3. בחר מטרה/ות מבין השחקנים (multi-target נתמך — "לכל השחקנים שהוא תוקף")
4. לכל מטרה:
     toHit = d20 + attackBonus   (adv/dis לפי מצבים)
     HIT if toHit ≥ target.AC     (nat20 = crit, nat1 = miss)
     damage = roll(dice) + bonus  (crit → כפל קוביות)
     apply resist/vuln/immunity   → target.currentHp -= final
5. עדכן DB → שדר hp:changed + כתוב CombatLog
6. שחקן רואה מיד את הנזק ואת שורת היומן
```

### התקפות save-based (breath, AoE)
המטרה מגלגלת save מול DC; "half on save" → חצי נזק בהצלחה. תמיכה במטרות מרובות
בבת אחת (בחירת כל היצורים ברדיוס).

### שחקן תוקף
מגיליון הדמות (§Actions) — אותו מנוע: to-hit מול AC של יעד שה-DM/שחקן בוחר.

## F. Dice Engine / מנוע קוביות (`lib/dnd/dice.ts`)
- פרסינג ביטויים: `roll("2d6+3")`, `roll("1d20", {advantage:true})`.
- מחזיר: total, קוביות בודדות, crit flag, breakdown לתצוגה.
- כל גלגול נרשם ב-CombatLog ומשודר → כולם רואים את התוצאה (שקיפות).

## G. Enemy Management / ניהול אויבים
- **מהבסטיאריון:** חיפוש 334 מפלצות SRD לפי שם/CR/type; הוספה לקרב (snapshot של
  ה-stat block ל-`Combatant.statBlockJson` — מאפשר שינוי HP/AC פרטני).
- **כמות:** הוספת N עותקים ("Goblin 1..4") עם HP מגולגל/ממוצע לכל אחד.
- **מותאם/הומברו:** יצירת stat block ידני (שם, AC, HP, סטטים, actions).
- **עריכת סטטים:** ה-DM עורך כל שדה של כל אויב תוך כדי קרב.

## H. Live Combat / קרב חי
כל פעולה משודרת ל-`encounter:{id}` room: token:moved, hp:changed,
condition:changed, turn:advanced, log:appended, combatant:added/removed,
visibility:changed. השחקנים במסך הקרב רואים הכל בזמן אמת ללא רענון.
