# Realtime Sync / סנכרון בזמן אמת

הדרישה: **"כשה-DM מעדכן משהו — זה מתעדכן אצל כל היוזרים. זה צריך להיות חי."**
זהו עיקרון-על שמעצב את כל שכבת ה-mutations.

## A. Transport / תעבורה
**Socket.IO** על ה-custom server (`server.ts`). דו-כיווני, עם reconnection
אוטומטי ו-fallback ל-long-polling. חלופה לפריסת Vercel: Pusher/Ably (ראה §F).

## B. Rooms / חדרים
כל לקוח מצטרף ל-rooms לפי הקשר:
- `user:{userId}` — התראות אישיות (הזמנות, "level up זמין").
- `campaign:{campaignId}` — כל מי שחבר בקמפיין. שינויי דמות/XP/שלל/זהב/rest.
- `encounter:{encounterId}` — כל מי שצופה בקרב פעיל. טוקנים/HP/יוזמה/יומן.

הצטרפות ב-`connection`: השרת מאמת session cookie → מצרף את המשתמש ל-rooms של
הקמפיינים שהוא חבר בהם.

## C. Event Catalog / קטלוג אירועים

| Event | Room | Payload | טריגר |
|---|---|---|---|
| `character:updated` | campaign | `{characterId, patch}` | עריכת דמות (שחקן/DM) |
| `character:created` | campaign | `{character}` | דמות חדשה בקמפיין |
| `xp:awarded` | campaign | `{characterId, xp, level, canLevelUp}` | DM מעניק XP |
| `levelup:available` | user | `{characterId}` | חציית סף רמה |
| `loot:assigned` | campaign | `{characterId, item}` | DM מקצה שלל |
| `gold:changed` | campaign | `{scope, characterId?, amounts}` | שינוי זהב |
| `rest:applied` | campaign | `{targets, type}` | DM מפעיל מנוחה |
| `encounter:started` | campaign | `{encounterId}` | פתיחת קרב → כולם עוברים |
| `token:moved` | encounter | `{tokenId, gridX, gridY}` | גרירת טוקן |
| `hp:changed` | encounter | `{combatantId, currentHp, tempHp}` | נזק/ריפוי |
| `condition:changed` | encounter | `{combatantId, conditions}` | מצב נוסף/הוסר |
| `turn:advanced` | encounter | `{turnIndex, round}` | Next/Prev turn |
| `initiative:set` | encounter | `{order}` | גלגול יוזמה |
| `combatant:changed` | encounter | `{combatant}` | הוספה/הסרה/עריכה |
| `visibility:changed` | encounter | `{combatantId, isVisible}` | העלמת/חשיפת אויב |
| `log:appended` | encounter | `{logEntry}` | גלגול/אירוע חדש |

## D. Write → Broadcast Pattern / דפוס כתיבה-שידור

**חוזה ברזל:** אין mutation ללא broadcast. כל שירות עוקב אחר התבנית:

```ts
// src/lib/realtime/emit.ts
export async function mutateAndBroadcast(opts) {
  await authorize(opts.actor, opts.action, opts.resource);   // RBAC server-side
  const result = await opts.write();                          // Prisma write
  io.to(opts.room).emit(opts.event, opts.payload(result));    // broadcast
  return result;                                              // HTTP response ללקוח היוזם
}
```

הלקוח היוזם מקבל תשובת HTTP רגילה (optimistic update); כל השאר מקבלים את ה-event
ומעדכנים store. הלקוח היוזם מתעלם מה-echo של עצמו (לפי `originSocketId`) כדי
למנוע כפילות.

## E. Client Handling / טיפול בצד לקוח

```ts
// src/lib/realtime/client.ts
socket.on('character:updated', ({characterId, patch}) =>
  store.applyCharacterPatch(characterId, patch));
socket.on('token:moved', ({tokenId, gridX, gridY}) =>
  store.moveToken(tokenId, gridX, gridY));
// ...
```
Stores: Zustand (`campaignStore`, `encounterStore`, `characterStore`). כמו כן
`SWR mutate(key)` לרענון נתונים שנטענו דרך REST. Optimistic UI + reconcile מה-DB.

## F. Consistency & Edge Cases / עקביות ומקרי קצה
- **Authority:** ה-DB הוא מקור האמת. Optimistic update מתוקן ע"י ה-event/refetch.
- **Reconnect:** ב-`connect` הלקוח מבצע full refetch של המסך הנוכחי (snapshot),
  ואז ממשיך לקבל deltas. כך לא מפספסים אירועים שקרו בזמן הניתוק.
- **Conflict:** DM ושחקן עורכים אותו שדה בו-זמנית → last-write-wins ברמת השדה
  (patch merge), עם RBAC שמגביל מה כל צד יכול לגעת בו.
- **הרשאות בשידור:** אירועים על אויב מוסתר (`isVisible=false`) נשלחים רק ל-DM
  (room נפרד `encounter:{id}:dm`), לא לשחקנים.

## G. חלופת פריסה ל-Serverless
אם פורסים ב-Vercel (ללא WebSocket מתמשך): מחליפים את `io.emit` ב-adapter של
**Pusher/Ably** (אותו event catalog), והלקוח מאזין דרך ה-SDK שלהם. שכבת
`emit.ts`/`client.ts` מבודדת את זה — שינוי במקום אחד.
