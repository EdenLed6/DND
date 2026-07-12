// Seed the app DB from the SRD sqlite (data/srd/srd.sqlite) + code-side additions.
// Run: npm run seed
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import path from "node:path";
import { BACKGROUNDS } from "../src/lib/dnd/backgrounds";

const prisma = new PrismaClient();
const srdPath = path.join(process.cwd(), "data", "srd", "srd.sqlite");

const b = (v: unknown) => v === 1 || v === "1" || v === true;
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

async function main() {
  const srd = new Database(srdPath, { readonly: true });
  console.log("Importing SRD from", srdPath);

  // ---- Monsters ----
  const monsters = srd.prepare("SELECT * FROM monsters").all() as any[];
  await prisma.srdMonster.deleteMany();
  for (const m of monsters) {
    await prisma.srdMonster.create({
      data: {
        id: m.id, name: m.name, size: s(m.size), type: s(m.type), subtype: s(m.subtype),
        alignment: s(m.alignment), ac: n(m.ac), acType: s(m.ac_type), hp: n(m.hp),
        hitDice: s(m.hit_dice), speed: s(m.speed), str: n(m.str), dex: n(m.dex), con: n(m.con),
        int: n(m.int), wis: n(m.wis), cha: n(m.cha), cr: s(m.cr), xp: n(m.xp), senses: s(m.senses),
        languages: s(m.languages), traits: s(m.traits), actions: s(m.actions),
        legendaryActions: s(m.legendary_actions), reactions: s(m.reactions),
        resistances: s(m.resistances), immunities: s(m.immunities), vulnerabilities: s(m.vulnerabilities),
        conditionImmunities: s(m.condition_immunities), savingThrows: s(m.saving_throws),
        skills: s(m.skills), proficiencyBonus: n(m.proficiency_bonus),
      },
    });
  }
  console.log(`  monsters: ${monsters.length}`);

  // ---- Spells ----
  const spells = srd.prepare("SELECT * FROM spells").all() as any[];
  await prisma.srdSpell.deleteMany();
  for (const sp of spells) {
    await prisma.srdSpell.create({
      data: {
        id: sp.id, name: sp.name, level: Number(sp.level), school: s(sp.school),
        castingTime: s(sp.casting_time), range: s(sp.range), duration: s(sp.duration),
        concentration: b(sp.concentration), ritual: b(sp.ritual), componentsV: b(sp.components_v),
        componentsS: b(sp.components_s), componentsM: b(sp.components_m),
        materialDescription: s(sp.material_description), classes: s(sp.classes),
        description: s(sp.description), higherLevel: s(sp.higher_level),
        damageType: s(sp.damage_type), saveType: s(sp.save_type),
      },
    });
  }
  console.log(`  spells: ${spells.length}`);

  // ---- Equipment ----
  const equip = srd.prepare("SELECT * FROM equipment").all() as any[];
  await prisma.srdEquipment.deleteMany();
  for (const e of equip) {
    await prisma.srdEquipment.create({
      data: {
        id: e.id, name: e.name, category: s(e.category), costGp: n(e.cost_gp), costUnit: s(e.cost_unit),
        weight: n(e.weight), description: s(e.description), weaponProperties: s(e.weapon_properties),
        damageDice: s(e.damage_dice), damageType: s(e.damage_type), weaponRange: s(e.weapon_range),
        rangeNormal: n(e.range_normal), rangeLong: n(e.range_long), armorCategory: s(e.armor_category),
        acBase: n(e.ac_base), acDexBonus: e.ac_dex_bonus === null ? null : b(e.ac_dex_bonus),
        acMaxBonus: n(e.ac_max_bonus),
        stealthDisadvantage: e.stealth_disadvantage === null ? null : b(e.stealth_disadvantage),
        strMinimum: n(e.str_minimum),
      },
    });
  }
  console.log(`  equipment: ${equip.length}`);

  // ---- Magic items ----
  const magic = srd.prepare("SELECT * FROM magic_items").all() as any[];
  await prisma.srdMagicItem.deleteMany();
  for (const mi of magic) {
    await prisma.srdMagicItem.create({
      data: {
        id: mi.id, name: mi.name, rarity: s(mi.rarity), type: s(mi.type),
        requiresAttunement: b(mi.requires_attunement),
        attunementDescription: s(mi.attunement_description), description: s(mi.description),
      },
    });
  }
  console.log(`  magic items: ${magic.length}`);

  // ---- Classes ----
  const classes = srd.prepare("SELECT * FROM classes").all() as any[];
  await prisma.srdClass.deleteMany();
  for (const c of classes) {
    await prisma.srdClass.create({
      data: {
        id: c.id, name: c.name, hitDie: n(c.hit_die), savingThrows: s(c.saving_throws),
        proficiencies: s(c.proficiencies), spellcastingAbility: s(c.spellcasting_ability),
        features: s(c.features), subclasses: s(c.subclasses),
      },
    });
  }
  console.log(`  classes: ${classes.length}`);

  // ---- Races ----
  const races = srd.prepare("SELECT * FROM races").all() as any[];
  await prisma.srdRace.deleteMany();
  for (const r of races) {
    await prisma.srdRace.create({
      data: {
        id: r.id, name: r.name, speed: n(r.speed), size: s(r.size),
        abilityBonuses: s(r.ability_bonuses), traits: s(r.traits), languages: s(r.languages),
        subraces: s(r.subraces),
      },
    });
  }
  console.log(`  races: ${races.length}`);

  // ---- Conditions / Rules / Rollable tables ----
  const conditions = srd.prepare("SELECT * FROM conditions").all() as any[];
  await prisma.srdCondition.deleteMany();
  for (const c of conditions)
    await prisma.srdCondition.create({ data: { id: c.id, name: c.name, description: s(c.description) } });
  console.log(`  conditions: ${conditions.length}`);

  const rules = srd.prepare("SELECT * FROM rules").all() as any[];
  await prisma.srdRule.deleteMany();
  for (const r of rules)
    await prisma.srdRule.create({ data: { id: r.id, name: r.name, section: s(r.section), description: s(r.description) } });
  console.log(`  rules: ${rules.length}`);

  const tables = srd.prepare("SELECT * FROM rollable_tables").all() as any[];
  await prisma.srdRollableTable.deleteMany();
  for (const t of tables)
    await prisma.srdRollableTable.create({
      data: { id: t.id, name: t.name, category: s(t.category), description: s(t.description), dieType: s(t.die_type), entries: s(t.entries) },
    });
  console.log(`  rollable tables: ${tables.length}`);

  // ---- Backgrounds (code-side) ----
  await prisma.srdBackground.deleteMany();
  for (const bg of BACKGROUNDS) {
    await prisma.srdBackground.create({
      data: {
        name: bg.name, skills: JSON.stringify(bg.skills), tools: JSON.stringify(bg.tools ?? []),
        languages: s(bg.languages ?? null), featureName: bg.featureName, featureDesc: bg.featureDesc,
        startGp: bg.startGp, equipment: s(bg.equipment ?? null),
      },
    });
  }
  console.log(`  backgrounds: ${BACKGROUNDS.length}`);

  srd.close();
  console.log("✅ Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
