# סורק מחירי טיסות + מלונות

סורק את **Google Flights** ו-**Google Hotels** (דרך [SerpApi](https://serpapi.com)) על טווח תאריכים שאתם מגדירים, ומציג את קומבינציית טיסה+מלון הזולה ביותר. רץ כולו בתוך GitHub - בלי Render, בלי שירות אחסון חיצוני.

## איך זה עובד

- **GitHub Actions** מריץ את הסריקה (`scripts/scan.js`) לפי לוח זמנים קבוע (פעם ביום, ניתן לשינוי), וגם ניתן להריץ אותה מיידית בלחיצת כפתור מתוך לשונית Actions.
- הסריקה שולפת מ-SerpApi את הטיסה והמלון הזולים ביותר לכל קומבינציה של (תאריך צ'ק-אין, מספר לילות) בתוך הטווח שהגדרתם, ושומרת את התוצאה כקובץ `docs/data/results.json`, שנדחף אוטומטית חזרה לריפו.
- **GitHub Pages** מארח את `docs/index.html` - עמוד סטטי שקורא את `results.json` ומציג אותו: הקומבינציה הזולה ביותר מודגשת בראש, וטבלה עם כל הקומבינציות שנסרקו.

מכיוון שאין שרת חי, הסריקה **לא** קורית ברגע שנכנסים לדף - היא קורית לפי לוח הזמנים, או כשלוחצים "Run workflow" ב-GitHub (ראו למטה). הדף מציג תמיד את התוצאה השמורה האחרונה, כולל חותמת "עודכן ב...".

## הגדרה - שלב אחר שלב

### 1. מפתח SerpApi כ-Secret ברמת הריפו
נרשמים ב-[serpapi.com](https://serpapi.com/users/sign_up) ומעתיקים את המפתח הפרטי. **לעולם לא** מכניסים אותו לקוד או לקובץ שנדחף לריפו. בריפו ב-GitHub:

Settings → Secrets and variables → Actions → **New repository secret**
Name: `SERPAPI_KEY`
Value: המפתח שלכם

### 2. עריכת config.json
מעתיקים את `config.example.json` ל-`config.json`, עורכים את הפרטים (יעד, מלונות, תאריכים, לילות, אורחים - טבלת שדות מתחת), ודוחפים אותו לריפו כרגיל (`git add config.json && git commit ... && git push`). **הקובץ הזה לא מכיל סוד** - רק העדפות טיול - כך שאין בעיה שהוא ציבורי בריפו.

### 3. הפעלת GitHub Pages
Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, Folder: `/docs` → Save.
GitHub ייתן לכם כתובת בסגנון `https://<username>.github.io/<repo-name>/`.

### 4. הרצה ראשונה
Actions → **Scan travel prices** → **Run workflow** → Run workflow.
תוך דקה-שתיים ה-workflow יסרוק, ידחוף `docs/data/results.json` מעודכן לריפו, ו-GitHub Pages יתעדכן בעצמו (יכול לקחת עוד דקה קלה). מרעננים את הדף ורואים תוצאות אמיתיות.

## מבנה config.json

ראו `config.example.json` לדוגמה מלאה. שדות עיקריים לכל טיול ברשימת `trips`:

| שדה | משמעות |
|---|---|
| `id` | מזהה קצר וייחודי (אנגלית, בלי רווחים) |
| `label` | השם שמוצג בתפריט הנפתח בדף |
| `departureAirport` / `destinationAirport` | קודי IATA (למשל `TLV`, `BCN`) |
| `destinationQuery` | מחרוזת חיפוש ל-Google Hotels (למשל `"Barcelona hotels"`) |
| `hotels` | רשימת שמות מלונות לסינון (אופציונלי - מערך ריק = המחיר הזול ביותר בכל האזור) |
| `dateRange.start` / `dateRange.end` | טווח התאריכים לסריקה (YYYY-MM-DD) |
| `nights.min` / `nights.max` | טווח מספר הלילות לשהייה |
| `guests.adults` / `guests.children` | כמות אורחים |
| `guests.childrenAges` | **חובה אם `children` גדול מ-0** - מערך עם גיל (1-17) לכל ילד, למשל `[8, 12]`. Google Hotels מחזיר שגיאה אם המספרים לא תואמים |
| `flightOptions.travelClass` | economy / premium_economy / business / first |
| `flightOptions.stops` | any / nonstop / one_or_fewer / two_or_fewer |
| `scanLimits.maxCombosPerScan` | תקרת קומבינציות לסריקה אחת (הגנה על מכסת SerpApi - 250 חיפושים חינם בחודש) |

ניתן להגדיר כמה טיולים במערך `trips` - כולם יסרקו בכל הרצה, ואפשר לבחור ביניהם בתפריט הנפתח בדף.

## שינוי לוח הזמנים

בקובץ `.github/workflows/scan.yml`, השורה:
```yaml
- cron: '0 5 * * *'
```
היא UTC. `0 5 * * *` = 05:00 UTC = 08:00 בישראל בקיץ (ובחורף 07:00, כי אין ל-cron מושג אזור זמן). אפשר לשנות לתדירות אחרת, למשל כל 6 שעות: `0 */6 * * *`.

## הרצה מקומית (אופציונלי, לבדיקות)

```bash
npm install
cp .env.example .env      # ומלאו את SERPAPI_KEY שלכם
cp config.example.json config.json
npm run scan               # מריץ סריקה חד-פעמית וכותב docs/data/results.json
```
פותחים את `docs/index.html` בדפדפן (או `python3 -m http.server` מתוך `docs/`) כדי לראות את התוצאה.

יש גם שרת Express קטן (`npm start`) לסריקה "בלחיצת כפתור" בזמן אמת - שימושי לפיתוח מקומי, אבל לא חלק מהפריסה דרך GitHub Pages (Pages מארח קבצים סטטיים בלבד ולא יכול להריץ שרת).

להרצת בדיקות היחידה (לוגיקת ייצור הקומבינציות, לא דורשת מפתח API):
```bash
npm test
```

## הערות

- ה-scraping כאן הוא בפועל קריאות API חוקיות ל-SerpApi (שירות צד-שלישי שמורשה לגשת לתוצאות Google), לא scraping ישיר של Google - כך נמנעים מהחסימות/CAPTCHA שגוגל מפעילה נגד גישה אוטומטית ישירה.
- מחירי מלונות מ-Google Hotels הם "לפחות X" ולא כוללים בהכרח מיסים/עמלות מלאים - שווה לאמת את המחיר הסופי באתר ההזמנה בפועל לפני רכישה.
- אם בעתיד תרצו סריקה חיה בלחיצת כפתור מהדף הציבורי (לא רק לפי לוח זמנים או Run workflow), זה ידרוש שרת שרץ ברקע (למשל Render) - GitHub Pages לבדו לא יכול להריץ קוד שרת.
