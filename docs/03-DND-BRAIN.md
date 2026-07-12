# The D&D Brain — Rules Engine / מוח החוקים

מסמך זה הוא **מקור האמת של המכניקה**. כל נוסחה כאן ממומשת ב-`src/lib/dnd/`.
כשקוד וחוק מתנגשים — החוק כאן קובע. (מבוסס SRD 5.1.)

---

## 1. Ability Scores & Modifiers / יכולות ומודיפיקטורים

6 יכולות: **STR, DEX, CON, INT, WIS, CHA**. טווח רגיל 1–20 (מפלצות עד 30).

```
modifier(score) = floor((score - 10) / 2)
```
| Score | 1 | 8–9 | 10–11 | 12–13 | 14–15 | 16–17 | 18–19 | 20 | 30 |
|---|---|---|---|---|---|---|---|---|---|
| Mod | −5 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +10 |

**שיטות יצירת סטטים (character creation):**
- **Standard array:** 15, 14, 13, 12, 10, 8
- **Point buy:** 27 נקודות, כל סטט 8–15 לפני גזע. עלות: 8→0,9→1,10→2,11→3,
  12→4,13→5,14→7,15→9.
- **Roll:** 4d6 drop lowest, ×6.
- מוסיפים **בונוסים גזעיים** (ability_bonuses מה-race) אחרי הבחירה.
- **ASI/Feat:** ב-levels 4,8,12,16,19 (משתנה לפי מקצוע) — +2 לסטט אחד או +1+1,
  או feat במקום. תקרה 20.

## 2. Proficiency Bonus / בונוס מיומנות

תלוי ברמה **הכוללת** של הדמות (סכום כל רמות ה-multiclass):

```
proficiencyBonus(totalLevel):
  1–4 → +2   |  5–8 → +3   |  9–12 → +4   |  13–16 → +5   |  17–20 → +6
```
נוסחה: `2 + floor((level - 1) / 4)`.

למפלצות: השדה `proficiency_bonus` נתון ישירות ב-stat block.

## 3. Hit Points / נקודות פגיעה

```
Level 1 HP     = max(hitDie) + conMod                     // e.g. Fighter d10 → 10 + conMod
Each level up  = roll(hitDie) OR average(hitDie) + conMod  // ממוצע = floor(die/2)+1
maxHP          = Σ(levels) + (conMod × totalLevel) + maxHpBonus
```
Hit die לפי מקצוע: Barbarian d12; Fighter/Paladin/Ranger d10;
Bard/Cleric/Druid/Monk/Rogue/Warlock d8; Sorcerer/Wizard d6.

**Temp HP:** לא מצטבר; לוקחים את הגבוה. נפגע ראשון לפני HP רגיל. לא מתרפא.
**Death Saves:** ב-0 HP. גלגול d20: ≥10 הצלחה, <10 כישלון; 3 הצלחות → יציב;
3 כישלונות → מוות; טבעי 20 → קם עם 1 HP; טבעי 1 → 2 כישלונות. נזק ב-0 HP =
כישלון אוטומטי (crit = 2). נזק ≥ maxHP בבת אחת → מוות מיידי (massive damage).

## 4. Armor Class / דרגת שריון

```
ללא שריון:            AC = 10 + dexMod
שריון קל (Light):      AC = baseAC + dexMod
שריון בינוני (Medium): AC = baseAC + min(dexMod, 2)
שריון כבד (Heavy):     AC = baseAC                    // dex לא נספר
מגן (Shield):          +2
Unarmored Defense:
  Barbarian → 10 + dexMod + conMod
  Monk      → 10 + dexMod + wisMod
```
ערכי baseAC וה-`ac_dex_bonus`/`ac_max_bonus`/`str_minimum`/`stealth_disadvantage`
מגיעים מטבלת `equipment` (armor_category). שריון עם str_minimum שלא מתקיים →
מהירות −10.

## 5. Initiative / יוזמה

```
initiative = d20 + dexMod (+ בונוסים כמו Alert +5)
```
תיקו נשבר לפי dexMod, אח"כ החלטת DM. במנוע הקרב מיוצג ב-`Combatant.initiative`.

## 6. Saving Throws / הצלות

```
save(ability) = d20 + abilityMod + (proficient ? proficiencyBonus : 0) + misc
```
כל מקצוע נותן proficiency ב-2 הצלות (שדה `saving_throws` ב-class). מפלצות:
`saving_throws` ב-stat block. Advantage/Disadvantage — ראה §11.

## 7. Skills / מיומנויות (18)

כל מיומנות קשורה ליכולת:
| מיומנות | יכולת | | מיומנות | יכולת |
|---|---|---|---|---|
| Athletics | STR | | Acrobatics | DEX |
| Sleight of Hand | DEX | | Stealth | DEX |
| Arcana | INT | | History | INT |
| Investigation | INT | | Nature | INT |
| Religion | INT | | Animal Handling | WIS |
| Insight | WIS | | Medicine | WIS |
| Perception | WIS | | Survival | WIS |
| Deception | CHA | | Intimidation | CHA |
| Performance | CHA | | Persuasion | CHA |

```
skillCheck = d20 + abilityMod + (proficient ? PB : 0) + (expertise ? PB : 0) + misc
passivePerception = 10 + wisMod + (prof ? PB : 0) + (expertise ? PB : 0) + (advantage? +5 : disadvantage? -5 : 0)
```
**Expertise** (Rogue/Bard): מכפיל את ה-PB (סה"כ +2×PB). Jack of All Trades (Bard):
חצי PB (עגול מטה) לכל בדיקה שאין בה proficiency.

## 8. XP & Leveling / ניסיון ורמות

טבלת XP → level (Character Advancement):
| Lvl | XP | Lvl | XP | Lvl | XP | Lvl | XP |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 6 | 14,000 | 11 | 85,000 | 16 | 195,000 |
| 2 | 300 | 7 | 23,000 | 12 | 100,000 | 17 | 225,000 |
| 3 | 900 | 8 | 34,000 | 13 | 120,000 | 18 | 265,000 |
| 4 | 2,700 | 9 | 48,000 | 14 | 140,000 | 19 | 305,000 |
| 5 | 6,500 | 10 | 64,000 | 15 | 165,000 | 20 | 355,000 |

DM יכול לנהל בשתי שיטות: **XP-based** (הצטברות אוטומטית → הצעת level-up) או
**Milestone** (DM כופה level-up ידנית). ראה `05-CAMPAIGN-SYSTEM.md`.

**Encounter XP (לחישוב תגמול):** סכום XP של המפלצות × multiplier לפי כמות:
1 מפלצה ×1; 2 ×1.5; 3–6 ×2; 7–10 ×2.5; 11–14 ×3; 15+ ×4. מחלקים בין השחקנים.

## 9. Spellcasting / הטלת קסמים

### 9.1 מאפייני קסם
```
spellSaveDC     = 8 + proficiencyBonus + spellcastingAbilityMod
spellAttackBonus= proficiencyBonus + spellcastingAbilityMod
```
היכולת לפי מקצוע (`spellcasting_ability`): Wizard=INT, Cleric/Druid/Ranger=WIS,
Bard/Paladin/Sorcerer/Warlock=CHA.

### 9.2 Spell Slots — Full Casters (Bard, Cleric, Druid, Sorcerer, Wizard)
עמודות = רמת משבצת 1–9, שורות = רמת מקצוע:
```
Lv  1  2  3  4  5  6  7  8  9
 1  2  -  -  -  -  -  -  -  -
 2  3  -  -  -  -  -  -  -  -
 3  4  2  -  -  -  -  -  -  -
 4  4  3  -  -  -  -  -  -  -
 5  4  3  2  -  -  -  -  -  -
 6  4  3  3  -  -  -  -  -  -
 7  4  3  3  1  -  -  -  -  -
 8  4  3  3  2  -  -  -  -  -
 9  4  3  3  3  1  -  -  -  -
10  4  3  3  3  2  -  -  -  -
11  4  3  3  3  2  1  -  -  -
12  4  3  3  3  2  1  -  -  -
13  4  3  3  3  2  1  1  -  -
14  4  3  3  3  2  1  1  -  -
15  4  3  3  3  2  1  1  1  -
16  4  3  3  3  2  1  1  1  -
17  4  3  3  3  2  1  1  1  1
18  4  3  3  3  3  1  1  1  1
19  4  3  3  3  3  2  1  1  1
20  4  3  3  3  3  2  2  1  1
```
**Half casters** (Paladin, Ranger): מתחילים ב-level 2, משתמשים בטבלה עם
`slotLevel = ceil(classLevel/2)` (ראה `rules.ts`). **Warlock — Pact Magic:** נפרד
לגמרי (1–4 משבצות באותה רמה, מתחדשות ב-short rest). **Multiclass:** מחשבים
"caster level" = full מלא + half חצי (עגול) ומשתמשים בטבלה המאוחדת.

### 9.3 Known vs Prepared
- **Prepared casters** (Cleric, Druid, Paladin, Wizard*): מכינים כל יום
  `abilityMod + level` (Wizard מספרו, Cleric/Druid כל הרשימה).
- **Known casters** (Bard, Ranger, Sorcerer, Warlock): רשימה קבועה שגדלה עם רמה.
- **Cantrips:** תמיד ידועים, לא צורכים משבצת, מתחזקים ברמות 5/11/17.
- **Ritual:** קסם עם תג ritual ניתן להטלה ללא משבצת (+10 דקות).
- **Concentration:** קסם ריכוז אחד בו-זמנית; נזק → CON save DC max(10, נזק/2).

## 10. Combat Resolution / חישוב קרב

### 10.1 Attack Roll
```
attackRoll = d20 + abilityMod + (proficient ? PB : 0) + magicBonus
  melee   → STR (או DEX אם Finesse)
  ranged  → DEX
  spell   → spellAttackBonus
hit if attackRoll ≥ target.AC
natural 20 → automatic hit + CRIT
natural 1  → automatic miss
```

### 10.2 Damage
```
damage = roll(damageDice) + abilityMod (+ magicBonus)
CRIT   → מכפילים את מספר קוביות הנזק (לא את המודיפיקטור)
resistance   → נזק ÷ 2 (עגול מטה)
vulnerability→ נזק × 2
immunity     → 0
```
מפלצות: פורמט הנזק ב-`actions` (למשל "+4 to hit ... 5 (1d6+2) slashing").
המנוע מפרסר bonus-to-hit ו-`XdY+Z` מתוך הטקסט (`lib/dnd/combat.ts`).

### 10.3 DM Attack Flow (הדרישה: "לגלגל תקיפה לכל אויב מול השחקנים")
```
1. DM בוחר אויב (Combatant/monster) ופעולה (action מה-stat block)
2. DM בוחר מטרות (שחקן אחד או רבים)
3. עבור כל מטרה: gלגל to-hit → השווה ל-AC של המטרה
4. HIT → גלגל נזק (crit אם nat20), החל resist/vuln/immunity
5. עדכן currentHp של המטרה ב-DB → שדר ל-room (live)
6. רשום ב-CombatLog ("Goblin → Aragorn: 18 vs AC16 HIT 6 slashing")
```
תקיפה עם save (למשל דרקון-breath): המטרה מגלגלת save מול DC; כישלון=נזק מלא,
הצלחה=חצי (אם "half on save").

## 11. Advantage / Disadvantage / יתרון וחיסרון

גלגול 2d20 ולקיחת הגבוה (advantage) או הנמוך (disadvantage). מקורות מרובים אינם
מצטברים — או/או. אם יש גם advantage וגם disadvantage → מבטלים זה את זה (גלגול רגיל).

## 12. Conditions / מצבים (15)

Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated,
Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious.

השפעות מכניות עיקריות שהמנוע מיישם:
| מצב | אפקט מכני מיושם |
|---|---|
| Prone | disadvantage בתקיפה; תוקפים בטווח קצר → advantage |
| Poisoned | disadvantage בתקיפות ובבדיקות יכולת |
| Restrained | מהירות 0; disadvantage בתקיפה ובהצלות DEX; תוקפים → advantage |
| Paralyzed | incapacitated; תקיפות מרחק 5ft → crit; נכשל בהצלות STR/DEX |
| Stunned | incapacitated; נכשל בהצלות STR/DEX; תוקפים → advantage |
| Prone/Blinded/Frightened... | לפי הטבלה המלאה ב-`conditions` (SRD) |

**Exhaustion (6 רמות):** 1 disadv בבדיקות; 2 מהירות ½; 3 disadv בתקיפות והצלות;
4 HP max ½; 5 מהירות 0; 6 מוות. long rest מוריד רמה אחת.

## 13. Rest & Recovery / מנוחה

**Short Rest (1 שעה):** בזבוז Hit Dice לריפוי (`roll(hitDie)+conMod` לכל die);
מתחדשים משאבים עם `resetOn=SHORT` (Warlock slots, חלק מ-Ki, Superiority Dice).
**Long Rest (8 שעות):** HP מלא; מחזירים חצי מ-hit dice (מינ' 1); כל spell slots;
כל המשאבים; exhaustion −1. הדמות לא יכולה long rest פעמיים ב-24 שעות.

ה-DM שולט: יכול לכפות rest על יחיד/כל הקבוצה ("שליטה בשינה/חידוש קסמים").
המימוש: פונקציית `applyRest(character, type)` מאפסת שדות → משדרת לכולם.

## 14. Currency / מטבעות

יחסי המרה (הכל נשמר פנימית ב-**cp**):
```
1 pp = 10 gp = 20 ep = 100 sp = 1000 cp
1 gp = 2 ep = 10 sp = 100 cp
1 sp = 10 cp
```
`totalGp = cp/100`. פונקציות `toCopper()/fromCopper()` ב-`lib/dnd/rules.ts`.
זהב קבוצתי נשמר ב-`Campaign.partyGold` (ב-cp); ה-DM מעביר בין הקופה הקבוצתית
לדמויות.

## 15. Encumbrance / נשיאה (אופציונלי)

```
carryCapacity = STR × 15 (lb)
push/drag/lift = STR × 30
Variant: > STR×5  → מהירות −10 (encumbered); > STR×10 → −20 + disadvantage
```

## 16. Size & Grid / גודל ורשת

| גודל | משבצות (5ft) |
|---|---|
| Tiny | 0.5 (2 בתא) | Small/Medium | 1×1 |
| Large | 2×2 | Huge | 3×3 | Gargantuan | 4×4 |
`Token.sizeSquares` נגזר מ-`monster.size`. הרשת = 5 רגל למשבצת (קנה מידה 5e תקני).

---

### קבצי המימוש
- `src/lib/dnd/rules.ts` — כל הטבלאות והקבועים כאן (XP, PB, slots, currency, sizes)
- `src/lib/dnd/character.ts` — נגזרים (AC, HP, saves, skills, DC, slots לדמות)
- `src/lib/dnd/combat.ts` — attack/damage/save resolution, parsing של stat blocks
- `src/lib/dnd/dice.ts` — מנוע קוביות (`roll("2d6+3")`, adv/dis, crit)
