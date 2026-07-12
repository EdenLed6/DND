# Data Model / מודל הנתונים

מסד הנתונים מחולק לשתי משפחות:
1. **SRD reference data** — read-only, מיובא מ-`data/srd/srd.sqlite` (compendium).
2. **Application data** — read-write, נוצר ע"י המשתמשים (users, campaigns, characters, encounters...).

להלן סכימת Prisma המתוכננת (מפושטת לתיאור; המימוש המלא ב-`prisma/schema.prisma`).

## 1. Users & Auth

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  displayName  String
  passwordHash String
  createdAt    DateTime @default(now())

  campaignsOwned Campaign[]        @relation("DM")
  memberships    CampaignMember[]
  characters     Character[]
  sessions       Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
}
```

## 2. Campaigns & Membership

```prisma
model Campaign {
  id          String   @id @default(cuid())
  name        String
  description String?
  dmId        String
  dm          User     @relation("DM", fields: [dmId], references: [id])
  partyGold   Int      @default(0)   // זהב קבוצתי (בנחושת? נשמור ב-cp; ראה brain)
  inviteCode  String   @unique       // קוד/קישור הזמנה
  createdAt   DateTime @default(now())

  members    CampaignMember[]
  characters Character[]
  encounters Encounter[]
  maps       GameMap[]
  loot       LootItem[]         // שלל קבוצתי שטרם חולק
  notes      CampaignNote[]
}

model CampaignMember {
  id         String  @id @default(cuid())
  campaignId String
  userId     String
  role       Role    @default(PLAYER)   // DM | PLAYER | VIEWER
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([campaignId, userId])
}

enum Role { DM PLAYER VIEWER }
```

## 3. Character (הליבה) 

הדמות מחזיקה גם בחירות (מקצוע/גזע/רקע) וגם ערכים גזורים שנשמרים ל-cache אך תמיד
ניתנים לחישוב-מחדש מהמנוע (`lib/dnd/character.ts`). "מקור האמת" הן הבחירות; הנגזרים
מחושבים.

```prisma
model Character {
  id          String  @id @default(cuid())
  ownerId     String                       // השחקן הבעלים
  campaignId  String?                       // null = דמות פרטית ללא קמפיין
  name        String
  avatarUrl   String?

  // Identity
  raceId      String                        // FK ל-SRD race
  subrace     String?
  background  String?                        // שם רקע
  alignment   String?
  inspiration Boolean @default(false)

  // Ability scores (מקור האמת — לפני מודיפיקטורים גזעיים? נשמור final base)
  str Int
  dex Int
  con Int
  int Int
  wis Int
  cha Int

  // Progression
  xp          Int     @default(0)
  // רמות מנוהלות דרך CharacterClass (multiclass)

  // Hit points
  maxHpBonus  Int     @default(0)           // התאמות DM/feat
  currentHp   Int
  tempHp      Int     @default(0)
  hitDiceUsed Int     @default(0)           // סה"כ hit dice שנוצלו
  deathSuccess Int    @default(0)
  deathFail    Int    @default(0)

  // Combat state
  exhaustion  Int     @default(0)           // 0..6
  conditions  String  @default("[]")        // JSON: ["Prone","Poisoned"]
  concentration String?                     // spell name or null

  // Currency (נשמר ב-cp; המרה ב-brain)
  cp Int @default(0)
  sp Int @default(0)
  ep Int @default(0)
  gp Int @default(0)
  pp Int @default(0)

  // Free-form
  notes       String?
  proficienciesJson String @default("{}")   // languages, tools, weapons, armor
  featuresJson      String @default("[]")   // feats & custom features
  spellcastingJson  String @default("{}")   // prepared/known overrides, slots used

  classes     CharacterClass[]
  items       InventoryItem[]
  spells      CharacterSpell[]
  skills      CharacterSkill[]
  resources   CharacterResource[]           // Ki, Rage, Superiority dice...
  tokens      Token[]

  owner    User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  campaign Campaign? @relation(fields: [campaignId], references: [id])
}

model CharacterClass {              // תומך multiclass
  id          String @id @default(cuid())
  characterId String
  classId     String                // FK ל-SRD class
  subclass    String?
  level       Int
  isPrimary   Boolean @default(false)
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
}

model CharacterSkill {
  id          String  @id @default(cuid())
  characterId String
  skill       String                 // "Acrobatics"...
  proficient  Boolean @default(false)
  expertise   Boolean @default(false)
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  @@unique([characterId, skill])
}

model CharacterSpell {
  id          String  @id @default(cuid())
  characterId String
  spellId     String                 // FK ל-SRD spell
  prepared    Boolean @default(false)
  alwaysPrepared Boolean @default(false)  // domain/oath spells
  source      String?                // "Wizard","Race",...
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
}

model CharacterResource {          // Rage, Ki, Sorcery Points, Superiority Dice...
  id          String @id @default(cuid())
  characterId String
  name        String
  max         Int
  used        Int    @default(0)
  resetOn     RestType @default(LONG)   // SHORT | LONG
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
}

enum RestType { SHORT LONG }
```

## 4. Inventory & Loot

```prisma
model InventoryItem {
  id          String  @id @default(cuid())
  characterId String
  srcEquipmentId String?             // FK ל-SRD equipment (אם קיים)
  srcMagicItemId String?             // FK ל-SRD magic_items (אם קיים)
  name        String                 // snapshot (מאפשר הומברו)
  quantity    Int     @default(1)
  equipped    Boolean @default(false)
  attuned     Boolean @default(false)
  customJson  String?                // overrides (נזק, בונוסים)
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
}

model LootItem {                     // שלל קבוצתי שטרם חולק (בשליטת DM)
  id          String @id @default(cuid())
  campaignId  String
  name        String
  quantity    Int    @default(1)
  srcMagicItemId String?
  goldValueCp Int    @default(0)
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

## 5. Combat & Maps

```prisma
model GameMap {
  id          String @id @default(cuid())
  campaignId  String
  name        String
  imageUrl    String                 // uploaded או מהספרייה
  gridSize    Int    @default(70)    // פיקסלים למשבצת (5 ft)
  gridCols    Int
  gridRows    Int
  offsetX     Int    @default(0)     // כיול הרשת לתמונה
  offsetY     Int    @default(0)
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  encounters  Encounter[]
}

model Encounter {                    // "קרב"
  id          String  @id @default(cuid())
  campaignId  String
  mapId       String?
  name        String
  status      EncStatus @default(PLANNING)  // PLANNING | ACTIVE | ENDED
  round       Int      @default(0)
  turnIndex   Int      @default(0)   // מצביע ל-Combatant הפעיל לפי initiative
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  map         GameMap? @relation(fields: [mapId], references: [id])
  combatants  Combatant[]
  tokens      Token[]
  log         CombatLog[]
}

enum EncStatus { PLANNING ACTIVE ENDED }

model Combatant {                    // שורה ב-initiative tracker
  id           String @id @default(cuid())
  encounterId  String
  kind         String                // "player" | "monster" | "npc"
  characterId  String?               // אם שחקן
  monsterId    String?               // FK ל-SRD monster (אם אויב)
  name         String                // snapshot
  initiative   Int    @default(0)
  maxHp        Int
  currentHp    Int
  tempHp       Int    @default(0)
  ac           Int
  conditions   String @default("[]")
  statBlockJson String?              // snapshot מלא (מאפשר אויב מותאם)
  isVisible    Boolean @default(true) // האם השחקנים רואים
  encounter    Encounter @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  token        Token?
}

model Token {                        // ייצוג על המפה
  id          String @id @default(cuid())
  encounterId String
  combatantId String? @unique
  characterId String?
  label       String
  color       String  @default("#c0392b")
  imageUrl    String?
  gridX       Int                    // עמודת רשת
  gridY       Int                    // שורת רשת
  sizeSquares Int     @default(1)    // 1=Medium, 2=Large...
  encounter   Encounter  @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  combatant   Combatant? @relation(fields: [combatantId], references: [id])
  character   Character? @relation(fields: [characterId], references: [id])
}

model CombatLog {                    // יומן גלגולים ואירועים (לשידור חי)
  id          String @id @default(cuid())
  encounterId String
  ts          DateTime @default(now())
  actor       String
  message     String                 // "Goblin attacks Aragorn: 18 vs AC 16 — HIT, 6 slashing"
  detailJson  String?
  encounter   Encounter @relation(fields: [encounterId], references: [id], onDelete: Cascade)
}
```

## 6. Campaign Notes & Invites

```prisma
model CampaignNote {
  id          String @id @default(cuid())
  campaignId  String
  title       String
  body        String
  dmOnly      Boolean @default(true)
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```
הזמנות מנוהלות דרך `Campaign.inviteCode` (join by code) + `CampaignMember`.

## 7. SRD Reference Tables (read-only)

מיובאות מ-`data/srd/srd.sqlite` אל טבלאות Prisma עם prefix `Srd`:
`SrdMonster, SrdSpell, SrdEquipment, SrdMagicItem, SrdClass, SrdRace,
SrdCondition, SrdRule, SrdRollableTable`. השדות שומרים JSON כמחרוזות (כמו במקור)
ומפוענחים בשכבת השירות. מיפוי שדות מלא ב-`docs/09-SRD-DATA.md`.

## Source-of-Truth vs Derived / מקור אמת מול נגזר

**נשמר ב-DB (מקור אמת):** בחירות שחקן — ability scores, מקצוע+רמה, גזע, רקע,
מיומנויות מיומנות, קסמים ידועים, ציוד, HP נוכחי, מצבים, זהב, XP.

**מחושב ב-runtime (`lib/dnd/character.ts`):** proficiency bonus, מודיפיקטורים,
AC, max HP, saving throws, מיומנויות סופיות, passive perception, spell save DC,
spell attack, מספר משבצות קסם, initiative. נשמרים ב-cache אך תמיד ניתנים
לחישוב-מחדש → מונע חוסר-עקביות.
