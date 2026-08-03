package com.ogenplay.staffnotify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// שירות חזית (Foreground Service) - זו הדרך התקנית באנדרואיד להריץ קוד ברקע בלי הגבלת זמן
// (בניגוד ל-WorkManager, שלא מבטיח פחות מ-15 דקות בין ריצות). המחיר: אנדרואיד מחייב להציג
// התראה קבועה וגלויה כל עוד השירות רץ - זו לא בחירה שלנו, זו דרישת מערכת חובה מ-Android 8+.
class NotificationForegroundService : Service() {

    companion object {
        const val CHANNEL_ID_STATUS = "ogen_play_status"
        const val CHANNEL_ID_ALERTS = "ogen_play_alerts"
        const val STATUS_NOTIFICATION_ID = 1001

        val ITEM_LABELS = linkedMapOf(
            "review" to "אפליקציות ממתינות לבדיקה",
            "pro" to "בקשות PRO ממתינות",
            "suggestions" to "הצעות אפליקציות ממתינות",
            "tickets" to "הודעות ממתינות למענה",
            "deletionRequests" to "בקשות מחיקת משתמשים",
            "council" to "ועדות שנפתחו אוטומטית",
            "reports" to "דיווחים על אפליקציות"
        )
    }

    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private lateinit var prefs: Prefs

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        createChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(STATUS_NOTIFICATION_ID, buildStatusNotification("מתחבר..."))
        prefs.monitoring = true
        scope.launch { pollLoop() }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        prefs.monitoring = false
        scope.coroutineContext[Job]?.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun pollLoop() {
        while (prefs.monitoring) {
            pollOnce()
            delay(Config.POLL_INTERVAL_MS)
        }
    }

    private suspend fun pollOnce() {
        val siteUrl = prefs.siteUrl
        var accessToken = prefs.accessToken
        if (accessToken == null) {
            updateStatusNotification("לא מחובר - יש לפתוח את האפליקציה ולהתחבר")
            return
        }

        var result = ApiClient.fetchSummary(siteUrl, accessToken)
        if (!result.ok && result.status == 401) {
            val refreshed = prefs.refreshToken?.let { ApiClient.refreshToken(it) }
            if (refreshed?.ok == true) {
                prefs.accessToken = refreshed.accessToken
                prefs.refreshToken = refreshed.refreshToken
                accessToken = refreshed.accessToken
                result = ApiClient.fetchSummary(siteUrl, accessToken!!)
            }
        }

        if (!result.ok) {
            if (result.status == 401 || result.status == 403) {
                prefs.clearSession()
                updateStatusNotification("הפעלה נכשלה - יש להתחבר מחדש")
                stopSelf()
            } else {
                updateStatusNotification("שגיאת רשת בסריקה האחרונה - ננסה שוב בעוד 30 שניות")
            }
            return
        }

        updateStatusNotification("מחובר - סורק כל 30 שניות · סה\"כ ממתין: ${result.total}")

        val previous = prefs.lastCountsMap()
        val increases = mutableListOf<Triple<String, Int, Int>>()
        for ((key, label) in ITEM_LABELS) {
            val before = previous[key] ?: 0
            val now = result.items[key] ?: 0
            if (now > before) increases.add(Triple(label, before, now))
        }
        prefs.saveCountsMap(result.items)

        if (increases.isNotEmpty()) {
            val title = if (increases.size == 1) increases[0].first else "יש התראות חדשות בעוגן פליי"
            val message = increases.joinToString("\n") { (label, before, now) -> "$label: $now (חדש: +${now - before})" }
            showAlertNotification(title, message)
        }
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID_STATUS, "סטטוס ניטור", NotificationManager.IMPORTANCE_LOW)
            )
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID_ALERTS, "התראות חדשות", NotificationManager.IMPORTANCE_HIGH)
            )
        }
    }

    private fun buildStatusNotification(text: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID_STATUS)
            .setContentTitle("עוגן פליי - צוות")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun updateStatusNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(STATUS_NOTIFICATION_ID, buildStatusNotification(text))
    }

    private fun showAlertNotification(title: String, message: String) {
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID_ALERTS)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(System.currentTimeMillis().toInt(), notification)
    }
}
