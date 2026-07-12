// SRD 5.1 subclass features (one subclass per class in the SRD). CC-BY-4.0.
// Used to auto-derive a character's subclass features by level.
export interface FeatureDef { level: number; name: string; description: string; }

export const SUBCLASS_FEATURES: Record<string, FeatureDef[]> = {
  // Barbarian
  "Path of the Berserker": [
    { level: 3, name: "Frenzy", description: "When you rage, you can go into a frenzy: make a single melee weapon attack as a bonus action each turn. When your rage ends you suffer one level of exhaustion." },
    { level: 6, name: "Mindless Rage", description: "You can't be charmed or frightened while raging; suspended effects resume when the rage ends." },
    { level: 10, name: "Intimidating Presence", description: "As an action, frighten a creature within 30 ft (Wis save vs your DC 8 + prof + Cha)." },
    { level: 14, name: "Retaliation", description: "When you take damage from a creature within 5 ft, you can use your reaction to make a melee weapon attack against it." },
  ],
  // Bard
  "College of Lore": [
    { level: 3, name: "Bonus Proficiencies", description: "Gain proficiency with three skills of your choice." },
    { level: 3, name: "Cutting Words", description: "As a reaction, expend a Bardic Inspiration die to subtract it from a creature's attack, ability check, or damage roll." },
    { level: 6, name: "Additional Magical Secrets", description: "Learn two spells of your choice from any class; they count as bard spells for you." },
    { level: 14, name: "Peerless Skill", description: "When you make an ability check, you can expend a Bardic Inspiration die and add it to the roll." },
  ],
  // Cleric
  "Life Domain": [
    { level: 1, name: "Bonus Proficiency", description: "You gain proficiency with heavy armor." },
    { level: 1, name: "Disciple of Life", description: "Your healing spells of 1st level or higher restore additional HP equal to 2 + the spell's level." },
    { level: 2, name: "Channel Divinity: Preserve Life", description: "Restore HP equal to five times your cleric level, divided among creatures within 30 ft (up to half their max HP each)." },
    { level: 6, name: "Blessed Healer", description: "When you cast a healing spell on another creature, you regain HP equal to 2 + the spell's level." },
    { level: 8, name: "Divine Strike", description: "Once per turn, deal an extra 1d8 (2d8 at 14th) radiant damage with a weapon attack." },
    { level: 17, name: "Supreme Healing", description: "When you would roll dice to restore HP with a spell, use the maximum value instead." },
  ],
  // Druid
  "Circle of the Land": [
    { level: 2, name: "Bonus Cantrip", description: "Learn one additional druid cantrip." },
    { level: 2, name: "Natural Recovery", description: "During a short rest, recover expended spell slots with a combined level up to half your druid level (once per day)." },
    { level: 3, name: "Circle Spells", description: "Gain access to additional always-prepared spells based on your chosen land (levels 3, 5, 7, 9)." },
    { level: 6, name: "Land's Stride", description: "Move through nonmagical difficult terrain without penalty; advantage on saves vs plants that impede movement." },
    { level: 10, name: "Nature's Ward", description: "You can't be charmed or frightened by elementals or fey, and are immune to poison and disease." },
    { level: 14, name: "Nature's Sanctuary", description: "Beasts and plants must succeed on a Wis save to attack you." },
  ],
  // Fighter
  "Champion": [
    { level: 3, name: "Improved Critical", description: "Your weapon attacks score a critical hit on a roll of 19 or 20." },
    { level: 7, name: "Remarkable Athlete", description: "Add half your proficiency bonus to Str, Dex, and Con checks that don't already use it; running long jump increases." },
    { level: 10, name: "Additional Fighting Style", description: "Choose a second Fighting Style option." },
    { level: 15, name: "Superior Critical", description: "Your weapon attacks score a critical hit on a roll of 18-20." },
    { level: 18, name: "Survivor", description: "At the start of each of your turns, regain HP equal to 5 + your Con modifier if you have no more than half your HP left." },
  ],
  // Monk
  "Way of the Open Hand": [
    { level: 3, name: "Open Hand Technique", description: "When you hit with Flurry of Blows, you can knock prone, push 15 ft, or deny reactions (Dex/Str save)." },
    { level: 6, name: "Wholeness of Body", description: "As an action, regain HP equal to three times your monk level (once per long rest)." },
    { level: 11, name: "Tranquility", description: "At the end of a long rest, gain the effect of a sanctuary spell until your next long rest." },
    { level: 17, name: "Quivering Palm", description: "Set up lethal vibrations in a creature; later, force a Con save or drop it to 0 HP." },
  ],
  // Paladin
  "Oath of Devotion": [
    { level: 3, name: "Oath Spells", description: "Gain always-prepared oath spells (protection from evil and good, sanctuary, and more at higher levels)." },
    { level: 3, name: "Channel Divinity: Sacred Weapon", description: "Imbue a weapon with positive energy: add your Cha modifier to attack rolls and it emits light for 1 minute." },
    { level: 3, name: "Channel Divinity: Turn the Unholy", description: "Each fiend or undead within 30 ft must make a Wis save or be turned for 1 minute." },
    { level: 7, name: "Aura of Devotion", description: "You and friendly creatures within 10 ft can't be charmed while you're conscious (30 ft at 18th)." },
    { level: 15, name: "Purity of Spirit", description: "You are always under the effects of a protection from evil and good spell." },
    { level: 20, name: "Holy Nimbus", description: "As an action, emanate sunlight for 1 minute: enemies take 10 radiant damage in it and you have advantage vs fiend/undead spells." },
  ],
  // Ranger
  "Hunter": [
    { level: 3, name: "Hunter's Prey", description: "Choose Colossus Slayer, Giant Killer, or Horde Breaker for extra damage/attacks." },
    { level: 7, name: "Defensive Tactics", description: "Choose Escape the Horde, Multiattack Defense, or Steel Will." },
    { level: 11, name: "Multiattack", description: "Choose Volley (ranged AoE) or Whirlwind Attack (melee AoE)." },
    { level: 15, name: "Superior Hunter's Defense", description: "Choose a defensive reaction such as Evasion, Stand Against the Tide, or Uncanny Dodge." },
  ],
  // Rogue
  "Thief": [
    { level: 3, name: "Fast Hands", description: "Use your Cunning Action bonus action to make Sleight of Hand checks, use thieves' tools, or Use an Object." },
    { level: 3, name: "Second-Story Work", description: "Climbing costs no extra movement; your running jump distance increases by your Dex modifier (ft)." },
    { level: 9, name: "Supreme Sneak", description: "You have advantage on Stealth checks if you move no more than half your speed on the same turn." },
    { level: 13, name: "Use Magic Device", description: "Ignore all class, race, and level requirements on the use of magic items." },
    { level: 17, name: "Thief's Reflexes", description: "Take two turns during the first round of combat (the second at initiative − 10)." },
  ],
  // Sorcerer
  "Draconic Bloodline": [
    { level: 1, name: "Dragon Ancestor", description: "Choose a dragon type; you can speak Draconic and double your proficiency bonus on Cha checks with dragons." },
    { level: 1, name: "Draconic Resilience", description: "Your HP maximum increases by 1 per sorcerer level, and your unarmored AC becomes 13 + Dex modifier." },
    { level: 6, name: "Elemental Affinity", description: "Add your Cha modifier to one damage roll of a spell dealing your dragon's element; optionally gain resistance for 1 hour." },
    { level: 14, name: "Dragon Wings", description: "Sprout wings and gain a flying speed equal to your current speed." },
    { level: 18, name: "Draconic Presence", description: "Expend 5 sorcery points to exude an aura of awe or fear (60 ft) for 1 minute." },
  ],
  // Warlock
  "The Fiend": [
    { level: 1, name: "Dark One's Blessing", description: "When you reduce a hostile creature to 0 HP, gain temporary HP equal to your Cha modifier + warlock level." },
    { level: 6, name: "Dark One's Own Luck", description: "Add 1d10 to an ability check or saving throw (once per short/long rest)." },
    { level: 10, name: "Fiendish Resilience", description: "Choose one damage type after a rest; gain resistance to it (except from magical/silvered weapons)." },
    { level: 14, name: "Hurl Through Hell", description: "When you hit a creature, banish it through the lower planes for 10d10 psychic damage (once per long rest)." },
  ],
  // Wizard
  "School of Evocation": [
    { level: 2, name: "Evocation Savant", description: "Halve the gold and time to copy evocation spells into your spellbook." },
    { level: 2, name: "Sculpt Spells", description: "When you cast an evocation spell affecting others, protect 1 + spell level creatures — they auto-succeed saves and take no damage." },
    { level: 6, name: "Potent Cantrip", description: "Your damaging cantrips deal half damage even when a creature succeeds on its save." },
    { level: 10, name: "Empowered Evocation", description: "Add your Int modifier to one damage roll of any wizard evocation spell you cast." },
    { level: 14, name: "Overchannel", description: "Deal maximum damage with a spell of 5th level or lower; repeated use before a long rest deals necrotic damage to you." },
  ],
};

export function subclassFeaturesUpTo(subclass: string | null | undefined, level: number): FeatureDef[] {
  if (!subclass) return [];
  return (SUBCLASS_FEATURES[subclass] ?? []).filter((f) => f.level <= level);
}
