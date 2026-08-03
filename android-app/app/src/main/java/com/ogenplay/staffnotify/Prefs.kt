package com.ogenplay.staffnotify

import android.content.Context
import android.content.SharedPreferences

// עטיפה פשוטה סביב SharedPreferences - שומר את פרטי ההתחברות (טוקנים, לא סיסמה!), כתובת
// האתר, ואת ה"ספירה האחרונה" של כל קטגוריה כדי לדעת אם משהו חדש נוסף מאז הסריקה הקודמת.
class Prefs(context: Context) {
    private val sp: SharedPreferences = context.getSharedPreferences("ogen_play_staff", Context.MODE_PRIVATE)

    var accessToken: String?
        get() = sp.getString("accessToken", null)
        set(value) = sp.edit().putString("accessToken", value).apply()

    var refreshToken: String?
        get() = sp.getString("refreshToken", null)
        set(value) = sp.edit().putString("refreshToken", value).apply()

    var siteUrl: String
        get() = sp.getString("siteUrl", Config.DEFAULT_SITE_URL) ?: Config.DEFAULT_SITE_URL
        set(value) = sp.edit().putString("siteUrl", value).apply()

    var monitoring: Boolean
        get() = sp.getBoolean("monitoring", false)
        set(value) = sp.edit().putBoolean("monitoring", value).apply()

    // נשמר כמחרוזת "key=value,key=value" פשוטה - נמנעים מלהוסיף תלות JSON נוספת רק בשביל זה
    var lastCountsRaw: String
        get() = sp.getString("lastCounts", "") ?: ""
        set(value) = sp.edit().putString("lastCounts", value).apply()

    fun clearSession() {
        sp.edit().remove("accessToken").remove("refreshToken").apply()
    }

    fun lastCountsMap(): Map<String, Int> {
        if (lastCountsRaw.isBlank()) return emptyMap()
        return lastCountsRaw.split(",").mapNotNull {
            val parts = it.split("=")
            if (parts.size == 2) parts[0] to (parts[1].toIntOrNull() ?: 0) else null
        }.toMap()
    }

    fun saveCountsMap(map: Map<String, Int>) {
        lastCountsRaw = map.entries.joinToString(",") { "${it.key}=${it.value}" }
    }
}
