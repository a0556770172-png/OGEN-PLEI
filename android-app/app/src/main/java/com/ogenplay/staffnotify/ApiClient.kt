package com.ogenplay.staffnotify

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class LoginResult(val ok: Boolean, val accessToken: String?, val refreshToken: String?, val error: String?)
data class SummaryResult(val ok: Boolean, val status: Int, val total: Int, val items: Map<String, Int>, val error: String?)

// לקוח רשת פשוט - כל הקריאות ל-Supabase Auth (התחברות/רענון טוקן) ולשרת עוגן פליי עצמו
// (שליפת סיכום ההתראות). לא נשמרת סיסמה בשום מקום - רק טוקן גישה וטוקן רענון, בדיוק כמו
// שהאתר עצמו עושה בדפדפן.
//
// חשוב: משתמשים ב-API הישן (Java-style) של OkHttp 3.x - כאן (code(), body(), MediaType.parse,
// RequestBody.create) ולא בתוספי ה-Kotlin של OkHttp 4.x (toMediaType(), toRequestBody(), code,
// body בתור property) - כי OkHttp 4.x דורש minSdk 21 ומעלה, וזה שובר את התמיכה באנדרואיד 4.4
// (API 19) שנדרשה כאן במפורש. 3.12.x היא הגרסה האחרונה שעדיין תומכת ב-API ישן יותר.
object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()
    private val jsonMedia: MediaType = MediaType.parse("application/json; charset=utf-8")!!

    suspend fun login(email: String, password: String): LoginResult = withContext(Dispatchers.IO) {
        try {
            val bodyStr = JSONObject().put("email", email).put("password", password).toString()
            val body = RequestBody.create(jsonMedia, bodyStr)
            val req = Request.Builder()
                .url("${Config.SUPABASE_URL}/auth/v1/token?grant_type=password")
                .addHeader("apikey", Config.SUPABASE_ANON_KEY)
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()
            client.newCall(req).execute().use { resp ->
                val text = resp.body()?.string().orEmpty()
                val json = if (text.isNotBlank()) JSONObject(text) else JSONObject()
                if (!resp.isSuccessful || !json.has("access_token")) {
                    val msg = json.optString("error_description", json.optString("msg", "פרטי התחברות שגויים"))
                    return@withContext LoginResult(false, null, null, msg)
                }
                LoginResult(true, json.getString("access_token"), json.optString("refresh_token", null), null)
            }
        } catch (e: Exception) {
            LoginResult(false, null, null, e.message ?: "שגיאת רשת")
        }
    }

    suspend fun refreshToken(refreshToken: String): LoginResult = withContext(Dispatchers.IO) {
        try {
            val bodyStr = JSONObject().put("refresh_token", refreshToken).toString()
            val body = RequestBody.create(jsonMedia, bodyStr)
            val req = Request.Builder()
                .url("${Config.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token")
                .addHeader("apikey", Config.SUPABASE_ANON_KEY)
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()
            client.newCall(req).execute().use { resp ->
                val text = resp.body()?.string().orEmpty()
                val json = if (text.isNotBlank()) JSONObject(text) else JSONObject()
                if (!resp.isSuccessful || !json.has("access_token")) {
                    return@withContext LoginResult(false, null, null, "רענון טוקן נכשל")
                }
                LoginResult(true, json.getString("access_token"), json.optString("refresh_token", null), null)
            }
        } catch (e: Exception) {
            LoginResult(false, null, null, e.message ?: "שגיאת רשת")
        }
    }

    suspend fun fetchSummary(siteUrl: String, accessToken: String): SummaryResult = withContext(Dispatchers.IO) {
        try {
            val cleanUrl = siteUrl.trimEnd('/')
            val req = Request.Builder()
                .url("$cleanUrl/api/staff/notifications-summary?_t=${System.currentTimeMillis()}")
                .addHeader("Authorization", "Bearer $accessToken")
                .header("Cache-Control", "no-cache")
                .get()
                .build()
            client.newCall(req).execute().use { resp ->
                val text = resp.body()?.string().orEmpty()
                val json = if (text.isNotBlank()) JSONObject(text) else JSONObject()
                if (!resp.isSuccessful) {
                    return@withContext SummaryResult(false, resp.code(), 0, emptyMap(), json.optString("error", "שגיאה בשליפת נתונים"))
                }
                val itemsJson = json.optJSONObject("items") ?: JSONObject()
                val items = mutableMapOf<String, Int>()
                itemsJson.keys().forEach { key -> items[key] = itemsJson.optInt(key, 0) }
                SummaryResult(true, resp.code(), json.optInt("total", 0), items, null)
            }
        } catch (e: Exception) {
            SummaryResult(false, -1, 0, emptyMap(), e.message ?: "שגיאת רשת")
        }
    }
}
