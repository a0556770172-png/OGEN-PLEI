package com.ogenplay.staffnotify

import android.app.Application
import org.conscrypt.Conscrypt
import java.security.Security

// מחליף/מוסיף את Conscrypt כ-Security Provider הראשי, לפני כל שימוש ברשת באפליקציה.
// זה חייב לרוץ ב-Application.onCreate() - הכי מוקדם שאפשר - כי הבעיה היא שבמכשירים ישנים
// (בעיקר אנדרואיד 4.4/KitKat) ספריית ה-SSL המובנית של המערכת מיושנת ולא תומכת נכון
// בפרוטוקולים/צפני-הצפנה שהשרתים המודרניים דורשים כיום (Supabase, Vercel וכו'), מה שגורם
// לשגיאת "SSL handshake aborted... sslv3 alert handshake failure" גם כשהמכשיר "תומך" ב-TLS
// באופן עקרוני. Conscrypt מביאה מימוש TLS עדכני משלה שעובד מ-API 16 ומעלה.
class OgenApp : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            Security.insertProviderAt(Conscrypt.newProvider(), 1)
        } catch (e: Throwable) {
            // אם מסיבה כלשהי ההתקנה נכשלת (למשל מכשיר עם מדיניות אבטחה חריגה), לא מפילים
            // את כל האפליקציה - פשוט ממשיכים עם ספריית ה-SSL המקורית של המערכת.
        }
    }
}
