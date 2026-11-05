# הגדרות nginx של עוגן פליי (תיעוד)

ההעתקים כאן הם לתיעוד בלבד - הם לא נפרסים אוטומטית. השרת החי: /etc/nginx.
- שלושה מופעי Next (פורטים 3000-3002, יוניטים ogen-play / ogen-play-b / ogen-play-c) מאחורי upstream עם keepalive.
- /_next/static מוגש ישירות מהדיסק; /_next/image ו-/api/cdn נשמרים במטמון nginx; עמודי תוכן ציבוריים נשמרים 15 שניות לאורחים (בלי עוגיית sb-ogenplay-auth-token).
- שחזור: גיבויים ב-/home/ubuntu/nginx-backup-*.
