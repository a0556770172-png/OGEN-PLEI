package com.ogenplay.staffnotify

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.ogenplay.staffnotify.databinding.ActivityMainBinding
import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: Prefs

    private val notificationPermissionLauncher =
        registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)

        requestNotificationPermissionIfNeeded()

        binding.siteUrlInput.setText(prefs.siteUrl)

        binding.loginButton.setOnClickListener { doLogin() }
        binding.logoutButton.setOnClickListener { doLogout() }
        binding.toggleMonitorButton.setOnClickListener { toggleMonitoring() }

        refreshView()
    }

    override fun onResume() {
        super.onResume()
        refreshView()
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun refreshView() {
        val loggedIn = prefs.accessToken != null
        binding.loginSection.visibility = if (loggedIn) android.view.View.GONE else android.view.View.VISIBLE
        binding.connectedSection.visibility = if (loggedIn) android.view.View.VISIBLE else android.view.View.GONE

        if (loggedIn) {
            binding.toggleMonitorButton.text = if (prefs.monitoring) "עצירת ניטור" else "התחלת ניטור"
            renderLastSummary()
        }
    }

    private fun renderLastSummary() {
        val counts = prefs.lastCountsMap()
        if (counts.isEmpty()) {
            binding.statusText.text = if (prefs.monitoring) "מתחיל לסרוק..." else "הניטור כבוי כרגע"
            binding.summaryText.text = ""
            return
        }
        val total = counts.values.sum()
        binding.statusText.text = if (prefs.monitoring) "מנטר · סה\"כ ממתין: $total" else "הניטור כבוי · תמונת מצב אחרונה"
        binding.summaryText.text = NotificationForegroundService.ITEM_LABELS.entries.joinToString("\n") { (key, label) ->
            "$label: ${counts[key] ?: 0}"
        }
    }

    private fun doLogin() {
        val siteUrl = binding.siteUrlInput.text?.toString()?.trim().takeUnless { it.isNullOrBlank() } ?: Config.DEFAULT_SITE_URL
        val email = binding.emailInput.text?.toString()?.trim().orEmpty()
        val password = binding.passwordInput.text?.toString().orEmpty()
        binding.loginError.text = ""

        if (email.isBlank() || password.isBlank()) {
            binding.loginError.text = "יש להזין אימייל וסיסמה"
            return
        }

        prefs.siteUrl = siteUrl
        binding.loginButton.isEnabled = false
        binding.loginButton.text = "מתחבר..."

        lifecycleScope.launch {
            val result = ApiClient.login(email, password)
            if (!result.ok || result.accessToken == null) {
                binding.loginError.text = result.error ?: "פרטי התחברות שגויים"
                binding.loginButton.isEnabled = true
                binding.loginButton.text = "התחברות"
                return@launch
            }

            // מוודאים מיד שהחשבון הזה בכלל צוות פיקוח/ניהול - אם לא, ה-endpoint יחזיר שגיאה
            // והטוקן לא נשמר, כדי שהמשתמש יבין להתחבר עם החשבון הנכון.
            val check = ApiClient.fetchSummary(siteUrl, result.accessToken)
            if (!check.ok) {
                binding.loginError.text = check.error ?: "החשבון הזה אינו צוות פיקוח/ניהול"
                binding.loginButton.isEnabled = true
                binding.loginButton.text = "התחברות"
                return@launch
            }

            prefs.accessToken = result.accessToken
            prefs.refreshToken = result.refreshToken
            prefs.saveCountsMap(check.items)

            binding.loginButton.isEnabled = true
            binding.loginButton.text = "התחברות"
            refreshView()
        }
    }

    private fun doLogout() {
        stopMonitoringService()
        prefs.clearSession()
        prefs.monitoring = false
        refreshView()
    }

    private fun toggleMonitoring() {
        if (prefs.monitoring) {
            stopMonitoringService()
            prefs.monitoring = false
        } else {
            startMonitoringService()
        }
        refreshView()
    }

    private fun startMonitoringService() {
        val intent = Intent(this, NotificationForegroundService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }

    private fun stopMonitoringService() {
        stopService(Intent(this, NotificationForegroundService::class.java))
    }
}
