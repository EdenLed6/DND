# Getting Started / איך מתחילים

שני מסלולים: **א)** להריץ מקומית עכשיו (2 דקות). **ב)** לעלות לאוויר (חינם/זול).

---

## א. הרצה מקומית (רואים שהכל עובד)

דרישה: Node 20+ מותקן.

```bash
npm install          # מתקין תלויות
npm run seed         # מייבא את כל נתוני ה-SRD ל-DB המקומי (SQLite)
npm run dev          # מריץ את האפליקציה
```
פותחים http://localhost:3000 → נרשמים → יוצרים קמפיין ודמות.

בפיתוח, מיילים (אימות/איפוס) **נרשמים ל-console** במקום להישלח — מעתיקים את
הקישור מהטרמינל. זה מספיק כדי לבדוק את כל הזרימות בלי להגדיר כלום.

---

## ב. לעלות לאוויר (Production)

### שלב 1 — Database (5 דק') 🗄️
1. נכנסים ל-**neon.tech** (או supabase.com) → New Project → מעתיקים את `DATABASE_URL`.
2. בריפו, ב-`prisma/schema.prisma`, משנים שורה אחת:
   ```prisma
   datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
   ```
3. יוצרים migration ראשוני (פעם אחת, מקומית מול ה-DB החדש):
   ```bash
   DATABASE_URL="<מ-Neon>" npx prisma migrate dev --name init
   DATABASE_URL="<מ-Neon>" npm run seed
   ```

### שלב 2 — Hosting (5 דק') 🚀
1. דוחפים את הקוד ל-GitHub (כבר שם).
2. נכנסים ל-**railway.app** → New Project → Deploy from GitHub → בוחרים את הריפו.
3. Settings → Build: `npm install && npm run build` · Start: `npm run start`.
4. Variables → מוסיפים:
   ```
   DATABASE_URL=<מ-Neon>
   NODE_ENV=production
   ALLOWED_ORIGIN=https://<הדומיין-שלך>
   APP_URL=https://<הדומיין-שלך>
   ```
5. (למפות שמעלים) Railway → Volume → mount ל-`/app/public/uploads`.
   *(או Cloudflare R2 בהמשך.)*

### שלב 3 — דומיין + HTTPS (10 דק') 🌐
1. קונים דומיין (**Cloudflare Registrar** במחיר עלות / Namecheap / Porkbun).
2. Railway → Settings → Custom Domain → מוסיפים; שמים את רשומת ה-CNAME ב-DNS.
3. HTTPS מונפק אוטומטית. מומלץ Cloudflare מלפנים (TLS+CDN+DDoS, חינם).
4. מעדכנים `ALLOWED_ORIGIN`/`APP_URL` לדומיין הסופי → redeploy.

### שלב 4 — Google login (אופציונלי, 5 דק') 🔵
1. console.cloud.google.com/apis/credentials → OAuth Client (Web).
2. Authorized redirect URI: `https://<דומיין>/api/auth/google/callback`.
3. Railway Variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. הכפתור מופיע לבד.

### שלב 5 — מיילים (אופציונלי, 5 דק') ✉️
1. resend.com → API Key. מאמתים דומיין שולח (או משתמשים ב-onboarding@resend.dev לבדיקה).
2. Railway Variables: `RESEND_API_KEY`, `EMAIL_FROM`.
3. להחליף ספק בעתיד = לערוך רק `src/lib/email/mailer.ts`.

---

## סדר עדיפויות מומלץ
1. הרצה מקומית → לוודא שאוהבים את המוצר.
2. Neon + Railway + דומיין → אתר חי עם הרשמה רגילה.
3. להוסיף Google + Resend → חוויית התחברות מלאה.

עלות: ~$5-6/חודש + ~$1/חודש דומיין. הכל שאר free tier.
```
[ ] מקומי רץ
[ ] Neon DB + schema=postgresql + migrate + seed
[ ] Railway deploy + env vars
[ ] Volume/R2 להעלאות
[ ] דומיין + HTTPS + ALLOWED_ORIGIN/APP_URL
[ ] (Google) client id/secret
[ ] (Resend) api key + EMAIL_FROM
```
