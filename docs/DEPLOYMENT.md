# Deployment / הרצה בפרודקשן

מדריך לפריסת האפליקציה. הבחירה המומלצת: **הכל במקום אחד ב-Railway** (זול ופשוט).

## למה Railway
האפליקציה מריצה **custom server עם Socket.IO** (WebSocket מתמשך), ולכן **לא מתאימה
ל-Vercel** (serverless). Railway מארח במקום אחד:
- את אפליקציית ה-Next.js (עם ה-WebSocket)
- **PostgreSQL** מנוהל
- **Volume** מתמשך לקבצי מפות שמעלים

עלות התחלה: ~$5/חודש (Hobby). חלופות שקולות: **Render**, **Fly.io**, או VPS
(Hetzner/DigitalOcean) + Cloudflare.

## שלב 1 — Database (PostgreSQL)
1. ב-Railway: New → **PostgreSQL**. מעתיקים את `DATABASE_URL`.
   (או ספק חיצוני: **Neon** / **Supabase** — free tier נדיב.)
2. ב-`prisma/schema.prisma` משנים את ה-datasource:
   ```prisma
   datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
   ```
3. יוצרים migration ומריצים:
   ```bash
   npx prisma migrate dev --name init      # פעם אחת מקומית ליצירת ה-migration
   # בפרודקשן (deploy):
   npx prisma migrate deploy && npm run seed
   ```

## שלב 2 — Storage לקבצי מפות
העלאות נשמרות ל-`public/uploads`. במארחים בענן הדיסק אפמרלי — לכן:
- **Railway:** הוסף **Volume** ומ־mount אותו ל-`/app/public/uploads`. זה מספיק.
- **חלופה כללית (מומלץ לסקייל):** אחסון אובייקטים — **Cloudflare R2** או **AWS S3** —
  ולהחליף את הכתיבה לדיסק בהעלאה ל-bucket (ראה `maps/upload/route.ts`).

## שלב 3 — משתני סביבה (ראה `.env.example`)
```
DATABASE_URL=postgresql://...      # מ-Railway/Neon
NODE_ENV=production
PORT=3000                          # Railway מזריק PORT אוטומטית
ALLOWED_ORIGIN=https://yourdomain.com   # חובה! מגביל את חיבור ה-Socket
```

## שלב 4 — Build & Run
Railway מזהה `package.json`. פקודות:
```
Build:  npm install && npm run build
Start:  npm run start
```
(ה-`start` מריץ את ה-custom server `server.ts` עם Socket.IO.)

## שלב 5 — דומיין + HTTPS
1. קנה דומיין (**Cloudflare Registrar** במחיר עלות / Namecheap / Porkbun).
2. ב-Railway: Settings → **Custom Domain** → הוסף את הדומיין; Railway ייתן רשומת
   CNAME. מוסיפים אותה ב-DNS של הדומיין.
3. **HTTPS** מונפק אוטומטית (Let's Encrypt).
4. מומלץ: **Cloudflare מלפנים** (proxy) — TLS + CDN + הגנת **DDoS** בחינם.
5. מעדכנים `ALLOWED_ORIGIN` לדומיין הסופי ומפעילים redeploy.

## שלב 6 — הקשחת אבטחה (כבר מיושמת בקוד)
- ✅ Socket.IO CORS מוגבל ל-`ALLOWED_ORIGIN`
- ✅ הרשאות (RBAC) על כל endpoint; אין IDOR
- ✅ טוקני session אקראיים-קריפטוגרפית; bcrypt לסיסמאות
- ✅ Rate limiting (login/register/upload)
- ✅ אימות magic-bytes להעלאות; אין SVG (מונע stored-XSS)
- ✅ Security headers: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy
- ✅ אין SQL injection (Prisma) / אין XSS (React escaping)

**להשלמה בפרודקשן:**
- גיבויים אוטומטיים ל-DB (Railway/Neon מציעים)
- ניטור: **Sentry** לשגיאות; health check ל-`/`
- אם עוברים לכמה instances — rate limiting מבוסס **Redis** (כרגע in-memory לכל process)
- שקול אימות אימייל + איפוס סיסמה (לא קיים כרגע)

## Checklist מהיר
```
[ ] Postgres מוקם + DATABASE_URL
[ ] prisma migrate deploy + seed
[ ] Volume/R2 להעלאות
[ ] ALLOWED_ORIGIN מוגדר לדומיין
[ ] Build/Start מוגדרים
[ ] דומיין + HTTPS + (Cloudflare)
[ ] גיבויים + ניטור
```
