package com.ogenplay.staffnotify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

// אם המשתמש הפעיל ניטור והמכשיר הופעל מחדש (או האפליקציה עודכנה) - מפעילים את השירות שוב
// אוטומטית, בתנאי שיש עדיין טוקן התחברות שמור.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = Prefs(context)
        if (prefs.monitoring && prefs.accessToken != null) {
            val serviceIntent = Intent(context, NotificationForegroundService::class.java)
            ContextCompat.startForegroundService(context, serviceIntent)
        }
    }
}
