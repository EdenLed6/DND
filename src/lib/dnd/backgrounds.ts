// D&D 5e backgrounds (SRD Acolyte + common set). See docs/04-CHARACTER-SYSTEM.md §D.
export interface BackgroundDef {
  name: string;
  skills: string[];
  tools?: string[];
  languages?: string; // description of language grants
  featureName: string;
  featureDesc: string;
  startGp: number;
  equipment?: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { name: "Acolyte", skills: ["Insight", "Religion"], languages: "Two of your choice",
    featureName: "Shelter of the Faithful", featureDesc: "You and your companions can receive free healing and care at temples of your faith, and you command the respect of those who share your religion.", startGp: 15,
    equipment: "Holy symbol, prayer book, 5 sticks of incense, vestments, common clothes, belt pouch" },
  { name: "Charlatan", skills: ["Deception", "Sleight of Hand"], tools: ["Disguise kit", "Forgery kit"],
    featureName: "False Identity", featureDesc: "You have a second identity with documentation and established acquaintances, and can forge documents.", startGp: 15,
    equipment: "Fine clothes, disguise kit, con tools, belt pouch" },
  { name: "Criminal", skills: ["Deception", "Stealth"], tools: ["One gaming set", "Thieves' tools"],
    featureName: "Criminal Contact", featureDesc: "You have a reliable contact in the criminal underworld who acts as your liaison.", startGp: 15,
    equipment: "Crowbar, dark common clothes with hood, belt pouch" },
  { name: "Entertainer", skills: ["Acrobatics", "Performance"], tools: ["Disguise kit", "One musical instrument"],
    featureName: "By Popular Demand", featureDesc: "You can find a place to perform, receiving free lodging and food and becoming a local celebrity.", startGp: 15,
    equipment: "Musical instrument, favor of an admirer, costume, belt pouch" },
  { name: "Folk Hero", skills: ["Animal Handling", "Survival"], tools: ["One artisan's tools", "Vehicles (land)"],
    featureName: "Rustic Hospitality", featureDesc: "Common folk shelter and hide you, and will not hand you over to authorities.", startGp: 10,
    equipment: "Artisan's tools, shovel, iron pot, common clothes, belt pouch" },
  { name: "Guild Artisan", skills: ["Insight", "Persuasion"], tools: ["One artisan's tools"], languages: "One of your choice",
    featureName: "Guild Membership", featureDesc: "Your guild provides lodging, food, legal aid, and support from fellow members.", startGp: 15,
    equipment: "Artisan's tools, letter of introduction, traveler's clothes, belt pouch" },
  { name: "Hermit", skills: ["Medicine", "Religion"], tools: ["Herbalism kit"], languages: "One of your choice",
    featureName: "Discovery", featureDesc: "Your seclusion gave you a unique and powerful discovery — a great truth, a lost text, or a secret.", startGp: 5,
    equipment: "Scroll case of notes, winter blanket, herbalism kit, common clothes" },
  { name: "Noble", skills: ["History", "Persuasion"], tools: ["One gaming set"], languages: "One of your choice",
    featureName: "Position of Privilege", featureDesc: "People assume you have the right to be wherever you are; you are welcome in high society.", startGp: 25,
    equipment: "Fine clothes, signet ring, scroll of pedigree, purse" },
  { name: "Outlander", skills: ["Athletics", "Survival"], tools: ["One musical instrument"], languages: "One of your choice",
    featureName: "Wanderer", featureDesc: "You have an excellent memory for maps and geography and can find food and water in the wild.", startGp: 10,
    equipment: "Staff, hunting trap, animal trophy, traveler's clothes, belt pouch" },
  { name: "Sage", skills: ["Arcana", "History"], languages: "Two of your choice",
    featureName: "Researcher", featureDesc: "When you don't know something, you often know where and from whom to obtain it.", startGp: 10,
    equipment: "Bottle of ink, quill, small knife, letter, common clothes, belt pouch" },
  { name: "Sailor", skills: ["Athletics", "Perception"], tools: ["Navigator's tools", "Vehicles (water)"],
    featureName: "Ship's Passage", featureDesc: "You can secure free passage on a sailing ship for yourself and companions.", startGp: 10,
    equipment: "Belaying pin (club), 50 ft silk rope, lucky charm, common clothes, belt pouch" },
  { name: "Soldier", skills: ["Athletics", "Intimidation"], tools: ["One gaming set", "Vehicles (land)"],
    featureName: "Military Rank", featureDesc: "Soldiers loyal to your former organization recognize your authority and defer to you.", startGp: 10,
    equipment: "Insignia of rank, trophy from a fallen enemy, gaming set, common clothes, belt pouch" },
  { name: "Urchin", skills: ["Sleight of Hand", "Stealth"], tools: ["Disguise kit", "Thieves' tools"],
    featureName: "City Secrets", featureDesc: "You know the secret patterns of cities and can move twice as fast through them via hidden ways.", startGp: 10,
    equipment: "Small knife, map of home city, pet mouse, token of parents, common clothes, belt pouch" },
];
