# SRD Data / נתוני SRD

מקור: `data/srd/srd.sqlite` — SRD 5.1 (CC-BY-4.0 / OGL). מיובא ב-`prisma/seed.ts`
לטבלאות `Srd*`. שדות המכילים אובייקטים נשמרים כמחרוזת JSON (מפוענחים בשירות).

## היקף / Coverage
| טבלה | רשומות |
|---|---|
| monsters | 334 (CR 0 עד 30) |
| spells | 319 (levels 0–9) |
| equipment | 237 (נשק/שריון/ציוד/כלים/רכבים) |
| magic_items | 239 |
| classes | 12 (כל מקצועות הליבה) |
| races | 9 |
| conditions | 15 |
| rules | 33 |
| rollable_tables | 9 |

## מיפוי שדות / Field Mapping

### monsters
`name, size, type, subtype, alignment, ac, ac_type, hp, hit_dice,
speed(JSON {walk,fly,...}), str/dex/con/int/wis/cha, cr, xp, senses, languages,
traits(JSON [{name,description}]), actions(JSON), legendary_actions, reactions,
resistances, immunities, vulnerabilities, condition_immunities,
saving_throws, skills(JSON [{name,bonus}]), proficiency_bonus`

> ה-actions מכילים טקסט תקיפה: `"Melee Weapon Attack: +4 to hit, reach 5 ft.,
> one target. Hit: 5 (1d6 + 2) slashing damage."` → `combat.ts` מפרסר bonus ו-dice.

### spells
`name, level, school, casting_time, range, duration, concentration(0/1),
ritual(0/1), components_v/s/m, material_description, classes(JSON []),
description, higher_level, damage_type, save_type`

### equipment
`name, category, cost_gp, cost_unit, weight, description,
weapon_properties(JSON), damage_dice, damage_type, weapon_range,
range_normal, range_long, armor_category, ac_base, ac_dex_bonus, ac_max_bonus,
stealth_disadvantage, str_minimum`
קטגוריות: Adventuring Gear(116), Mounts/Vehicles(40), Tools(31), Martial Melee(18),
Armor(13), Simple Melee(10), Martial Ranged(5), Simple Ranged(4).

### magic_items
`name, rarity, type, requires_attunement(0/1), attunement_description, description`

### classes
`name, hit_die, saving_throws(JSON ["INT","WIS"]),
proficiencies(JSON {armor,weapons,tools,skills:{choose,from}}),
spellcasting_ability, features(JSON [{level,name,description}]),
subclasses(JSON)`

### races
`name, speed, size, ability_bonuses(JSON [{ability,bonus}]),
traits(JSON [{name,description}]), languages, subraces(JSON)`

### conditions
`name, description` (15 — כולל Exhaustion)

### rules
`name, section, description(Markdown)` — 33 קטעי חוקים ליבה.

### rollable_tables
`name, category, die_type, description, entries(JSON [{min,max,text}])`

## תוספות בקוד (לא ב-sqlite) / Code-side additions
נזרעות ב-seed מקבועים ב-`lib/dnd/rules.ts`:
- **18 Skills** (שם→יכולת) — brain §7
- **Backgrounds** (13) — character-system §D
- **XP→level table**, **proficiency bonus**, **spell-slot tables**,
  **currency ratios**, **creature sizes→squares** — brain

## רישוי / Licensing
תוכן SRD 5.1 מופץ תחת Creative Commons Attribution 4.0 (וגם OGL 1.0a). ייחוס:
"This work includes material from the System Reference Document 5.1 by Wizards
of the Coast LLC, available under CC-BY-4.0." תוכן שאינו-SRD (ספרים) אינו כלול.

## הרחבה עתידית / Extensibility
מבנה ה-`Srd*` פתוח להוספת מקורות: הזנת רשומות נוספות (הומברו/ספרים בבעלות
המשתמש) לאותן טבלאות עם `source` tag. אין תלות ב-schema במקור SRD דווקא.
