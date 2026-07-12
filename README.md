# D&D 5e Campaign Manager 🐉

אפליקציה לניהול קמפיינים משותפים של Dungeons & Dragons 5th Edition — ניהול דמות
ברמת D&D Beyond, ניהול קמפיין בשליטת DM מלאה, וניהול קרב ומפות חי בזמן אמת.

> **Status:** ✅ עובד מקצה-לקצה — שלושת העמודים + כל ה-Polish (M1–M7).
> תכנון מלא (מוח D&D) ב-`docs/`. מנוע חוקים עם 15 בדיקות עוברות. Build production תקין.
>
> Includes: live character wizard + sheet · level-up wizard (HP/ASI/feat/subclass/
> multiclass) · inventory & spell management from the compendium · JSON export/import ·
> DM board (XP/levels/gold/loot/rest) · live combat with draggable tokens & avatars,
> attack rolls, initiative, combat log · distance ruler & AoE templates · 63 SVG maps
> + map upload · **fog of war** · full SRD compendium with detail pages.
> UI is English.

## שלושת העמודים
1. **ניהול דמות** — יצירה מונחית-SRD + גיליון מלא (סטטים, HP/AC/הצלות, קסמים
   ומשבצות, ציוד, יכולות, מצבים).
2. **ניהול קמפיין** — DM פותח קמפיין, מזמין שחקנים, שולט ב-XP/רמות/שלל/זהב/מנוחה,
   ועורך כל דמות. הכל **חי** — שינוי אצל ה-DM מתעדכן מיד אצל כולם.
3. **ניהול קרב ומפות** — מפות עם רשת 5ft, טוקנים נגררים, מעקב יוזמה, בסטיאריון
   SRD, גלגולי תקיפה מול השחקנים, מעקב HP — הכל בזמן אמת.

## נתונים (SRD 5.1)
334 מפלצות · 319 קסמים · 237 ציוד · 239 פריטי קסם · 12 מקצועות · 9 גזעים ·
15 מצבים · 33 חוקים. מקור: SRD 5.1 (CC-BY-4.0). ראה `docs/09-SRD-DATA.md`.

## מחסנית
Next.js 15 · TypeScript · Prisma + SQLite · Socket.IO (live) · Tailwind · dnd-kit.

## תיעוד / מוח D&D
כל התכנון והחוקים ב-[`docs/`](./docs):

| מסמך | תוכן |
|---|---|
| [00 Overview](./docs/00-OVERVIEW.md) | חזון, עמודים, מקור נתונים |
| [01 Architecture](./docs/01-ARCHITECTURE.md) | מחסנית, live-sync, מבנה |
| [02 Data Model](./docs/02-DATA-MODEL.md) | סכימת Prisma מלאה |
| [03 D&D Brain](./docs/03-DND-BRAIN.md) | **מנוע החוקים — כל הנוסחאות** |
| [04 Character System](./docs/04-CHARACTER-SYSTEM.md) | יצירה + גיליון |
| [05 Campaign System](./docs/05-CAMPAIGN-SYSTEM.md) | בקרות DM |
| [06 Combat & Maps](./docs/06-COMBAT-AND-MAPS.md) | קרב, מפות, טוקנים |
| [07 Realtime Sync](./docs/07-REALTIME-SYNC.md) | מודל האירועים החי |
| [08 Roadmap](./docs/08-ROADMAP.md) | תוכנית בנייה מדורגת |
| [09 SRD Data](./docs/09-SRD-DATA.md) | מיפוי הנתונים |

## הרצה (עם השלמת התשתית)
```bash
npm install
npm run seed      # ייבוא SRD + skills/backgrounds
npm run dev       # http://localhost:3000
```

## רישוי תוכן
כולל חומר מ-System Reference Document 5.1 מאת Wizards of the Coast LLC, תחת
Creative Commons Attribution 4.0. תוכן שאינו-SRD אינו כלול.
