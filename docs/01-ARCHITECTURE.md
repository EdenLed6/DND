# Architecture / ארכיטקטורה

## Tech Stack / מחסנית טכנולוגית

| שכבה | טכנולוגיה | סיבה |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Full-stack יחיד: SSR, API routes, React |
| UI | **React 19 + Tailwind CSS** | קומפוננטות אינטראקטיביות, עיצוב מהיר |
| DB | **SQLite via Prisma ORM** | ללא תלות חיצונית, קל לפריסה מקומית; ניתן להחלפה ל-Postgres |
| Realtime | **Socket.IO (custom Node server)** | דחיפת אירועים חיים דו-כיוונית לכל הקמפיין |
| Auth | **Session cookies + bcrypt** (lucia-style, עצמאי) | שחקנים + DM, ללא ספק חיצוני |
| Drag & Drop | **@dnd-kit/core** | הצבת טוקנים על מפת הקרב |
| State | **Zustand + SWR** | סטייט לקוח + מטמון עם revalidation |
| Dice | מנוע גלגול קוביות עצמאי (`lib/dice.ts`) | פרסינג `2d6+3`, advantage/disadvantage |
| Validation | **Zod** | ולידציה של קלט ב-API ו-forms |

### למה SQLite ולא Postgres?
כדי שהאפליקציה תרוץ מיד ללא תשתית חיצונית (`npm run dev` ותו לא). Prisma מפשט
מעבר עתידי ל-Postgres/MySQL ע"י שינוי `datasource` בלבד. נתוני ה-SRD (read-only)
ונתוני המשתמשים (read-write) חיים באותו קובץ `dev.db`.

## Why a Custom Server / למה שרת מותאם

Next.js לבדו לא מריץ WebSocket server לאורך זמן. כדי לספק live-sync אמיתי אנו
מריצים **custom Node server** (`server.ts`) שמעטף את Next.js ומחזיק מופע Socket.IO
על אותו port. זה מאפשר:
- ערוץ (room) לכל קמפיין: `campaign:{id}`
- ערוץ לכל קרב פעיל: `encounter:{id}`
- דחיפת אירועים (`character:updated`, `token:moved`, `hp:changed`, ...) לכל הצופים

```
Browser (React + socket.io-client)
        │  HTTP (API routes)         │  WebSocket (socket.io)
        ▼                             ▼
┌───────────────────────────────────────────────┐
│  server.ts  (Node http server)                 │
│   ├── Next.js request handler (pages/api/app)  │
│   └── Socket.IO server (rooms, auth middleware) │
└───────────────┬───────────────────────────────┘
                ▼
        Prisma → SQLite (dev.db)  +  SRD data (srd tables)
```

### Write → Broadcast pattern (לב ה-Live)
כל mutation עובר דרך **service layer** אחיד. הזרימה:

```
1. Client שולח mutation (HTTP POST /api/... או socket event)
2. Service מאמת הרשאה (RBAC), כותב ל-DB דרך Prisma
3. Service קורא ל-emitToCampaign(campaignId, event, payload)
4. Socket.IO משדר לכל הלקוחות ב-room
5. כל לקוח מעדכן את ה-Zustand store / מבצע SWR mutate
```

כך "כשה-DM מעדכן משהו — זה מתעדכן אצל כולם" הופך למובנה: אין mutation שלא משדר.

## Folder Structure / מבנה תיקיות

```
/
├── server.ts                 # Custom Node server (Next + Socket.IO)
├── prisma/
│   ├── schema.prisma         # מודל הנתונים המלא
│   ├── seed.ts               # ייבוא SRD + skills/backgrounds
│   └── dev.db                # SQLite (נוצר ב-runtime)
├── data/srd/srd.sqlite       # מקור ה-SRD (read-only, מיובא ב-seed)
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # login / register
│   │   ├── dashboard/        # רשימת קמפיינים ודמויות
│   │   ├── campaigns/[id]/   # מסך קמפיין (DM + players)
│   │   ├── characters/[id]/  # גיליון דמות
│   │   ├── play/[encId]/     # מסך קרב חי (map + initiative)
│   │   ├── compendium/       # דפדוף SRD (spells/monsters/items)
│   │   └── api/              # REST endpoints
│   ├── components/           # קומפוננטות React
│   ├── lib/
│   │   ├── dnd/              # מנוע החוקים (ה-"brain" בקוד)
│   │   │   ├── rules.ts      # קבועים: XP, prof bonus, spell slots
│   │   │   ├── character.ts  # חישובי דמות נגזרים
│   │   │   ├── combat.ts     # גלגול תקיפה, נזק, הצלות
│   │   │   └── dice.ts       # מנוע קוביות
│   │   ├── realtime/         # socket helpers (server + client)
│   │   ├── auth/             # session, password
│   │   └── db.ts             # Prisma client singleton
│   └── store/                # Zustand stores
├── docs/                     # מסמכי התכנון (D&D brain)
└── package.json
```

## Permissions Model (RBAC) / מודל הרשאות

| תפקיד | יכולות |
|---|---|
| **DM** (owner של הקמפיין) | הכל: עריכת כל דמות, XP, רמות, זהב, שלל, מנוחה, קרבות, מפות, אויבים |
| **Player** | עריכת הדמות **שלו בלבד**; צפייה בקרב; הזזת הטוקן שלו (אם ה-DM מאפשר); גלגולים |
| **Viewer** (אופציונלי) | צפייה בלבד |

ההרשאות נאכפות ב-**service layer** (server-side), לא רק ב-UI. כל endpoint בודק:
"האם ל-user הזה יש רשות לפעולה הזו על המשאב הזה בקמפיין הזה?"

## Deployment / פריסה

- **Local:** `npm install && npm run seed && npm run dev` → `http://localhost:3000`
- **Production:** `npm run build && npm start` (custom server). SQLite נשמר על דיסק.
- ניתן לפרוס על VPS/Fly.io/Railway. Vercel אינו תומך ב-WebSocket ארוך-חיים →
  לפריסת Vercel יש לעבור ל-Pusher/Ably (ראה `07-REALTIME-SYNC.md`, סעיף חלופות).

## Non-Goals (v1) / מחוץ לגבולות v1
- אין voice/video chat (אפשר לשלב Discord חיצוני).
- אין אנימציות תלת-ממד; המפה היא רשת 2D top-down.
- תוכן שאינו-SRD (ספרים מוגני זכויות) אינו כלול; ניתן להוסיף הומברו ידנית.
