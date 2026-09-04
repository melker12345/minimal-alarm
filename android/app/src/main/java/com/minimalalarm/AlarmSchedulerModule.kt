package com.minimalalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.os.Build
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.Calendar

class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val alarmManager = reactContext.getSystemService(AlarmManager::class.java)
    private val previewHandler = Handler(Looper.getMainLooper())
    private var preview: Ringtone? = null

    override fun getName() = "AlarmScheduler"

    override fun getConstants(): Map<String, Any> = mapOf("versionName" to BuildConfig.VERSION_NAME)

    /**
     * Download an APK (release asset URL) and hand it to the system package
     * installer when done. Used by the in-app update gate.
     */
    @ReactMethod
    fun downloadAndInstallUpdate(url: String, promise: Promise) {
        runCatching {
            val apk = java.io.File(reactContext.getExternalFilesDir(null), "update.apk")
            apk.delete()
            val request = android.app.DownloadManager.Request(Uri.parse(url))
                .setTitle("Minimal Alarm update")
                .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(reactContext, null, "update.apk")
            val downloadId = reactContext.getSystemService(android.app.DownloadManager::class.java).enqueue(request)
            val receiver = object : android.content.BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    if (intent.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return
                    runCatching { ctx.unregisterReceiver(this) }
                    val uri = androidx.core.content.FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", apk)
                    runCatching {
                        ctx.startActivity(
                            Intent(Intent.ACTION_VIEW)
                                .setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION),
                        )
                    }
                }
            }
            androidx.core.content.ContextCompat.registerReceiver(
                reactContext, receiver,
                android.content.IntentFilter(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                androidx.core.content.ContextCompat.RECEIVER_EXPORTED,
            )
        }.onSuccess { promise.resolve(null) }.onFailure { promise.reject("UPDATE_FAILED", it) }
    }

    @ReactMethod
    fun schedule(alarm: ReadableMap, promise: Promise) {
        runCatching {
            val id = alarm.getString("id") ?: error("Alarm id is required")
            val hour = alarm.getInt("hour")
            val minute = alarm.getInt("minute")
            val days = alarm.getArray("days")?.toArrayList()?.map { (it as Number).toInt() }?.toSet() ?: emptySet()
            val count = if (alarm.hasKey("count")) alarm.getInt("count").coerceIn(1, MAX_SEQUENCE) else 1
            val spacing = if (alarm.hasKey("spacingMinutes")) alarm.getInt("spacingMinutes").coerceAtLeast(0) else 0
            val ringtone = if (alarm.hasKey("ringtone")) alarm.getString("ringtone") ?: "default" else "default"
            val label = if (alarm.hasKey("label")) alarm.getString("label")?.takeIf { it.isNotBlank() } ?: "Wake up" else "Wake up"
            fun intOr(key: String, fallback: Int) = if (alarm.hasKey(key)) alarm.getInt(key) else fallback
            val light = LightConfig(
                enabled = alarm.hasKey("hueEnabled") && alarm.getBoolean("hueEnabled"),
                program = if (alarm.hasKey("lightProgram")) alarm.getString("lightProgram") ?: "instant" else "instant",
                fadeMinutes = intOr("fadeMinutes", 30),
                startWarmth = intOr("startWarmth", 90),
                endWarmth = intOr("endWarmth", 20),
                coolShiftMinutes = intOr("coolShiftMinutes", 0),
                brightness = intOr("brightness", 100),
            )
            // Shrinking a sequence must not leave old indices armed.
            val stale = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            (count until MAX_SEQUENCE).forEach { index ->
                AlarmArming.cancel(reactContext, "$id:$index")
                stale.remove("$id:$index")
            }
            stale.apply()

            val mainTrigger = if (days.isEmpty()) AlarmTiming.next(hour, minute, days) else 0L
            repeat(count) { index ->
                val raw = hour * 60 + minute - index * spacing
                val totalMinutes = Math.floorMod(raw, 24 * 60)
                // Subtracting spacing can cross midnight: the occurrence then
                // belongs to the previous day(s), so repeat days shift with it.
                val dayShift = Math.floorDiv(raw, 24 * 60)
                if (days.isEmpty()) {
                    // One-shot: derive from the main occurrence so pre-alarms
                    // always land before it; skip any already in the past.
                    val trigger = mainTrigger - index * spacing * 60_000L
                    if (trigger > System.currentTimeMillis()) {
                        scheduleOne("$id:$index", totalMinutes / 60, totalMinutes % 60, days, ringtone, label, light, trigger)
                    }
                } else {
                    val shifted = days.map { Math.floorMod(it - 1 + dayShift, 7) + 1 }.toSet()
                    scheduleOne("$id:$index", totalMinutes / 60, totalMinutes % 60, shifted, ringtone, label, light)
                }
            }
        }.onSuccess { promise.resolve(null) }.onFailure { promise.reject("SCHEDULE_FAILED", it) }
    }

    @ReactMethod
    fun cancel(id: String, promise: Promise) {
        val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        (0 until MAX_SEQUENCE).forEach { index ->
            AlarmArming.cancel(reactContext, "$id:$index")
            editor.remove("$id:$index")
        }
        editor.apply()
        promise.resolve(null)
    }

    /**
     * Arm the countdown timer as a one-shot native alarm so it rings — with the
     * full-screen ringing UI — even if the app is backgrounded or killed.
     */
    @ReactMethod
    fun scheduleTimer(triggerAt: Double, promise: Promise) {
        runCatching {
            val at = triggerAt.toLong()
            val cal = Calendar.getInstance().apply { timeInMillis = at }
            scheduleOne(
                "$TIMER_ID:0", cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE),
                emptySet(), "default", "Timer", LightConfig.OFF, at,
            )
        }.onSuccess { promise.resolve(null) }.onFailure { promise.reject("TIMER_FAILED", it) }
    }

    @ReactMethod
    fun cancelTimer(promise: Promise) = cancel(TIMER_ID, promise)

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        promise.resolve(Build.VERSION.SDK_INT < 31 || alarmManager.canScheduleExactAlarms())
    }

    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 31) {
            reactContext.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${reactContext.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        // NotificationManager.canUseFullScreenIntent() only exists since API 34;
        // below that the manifest permission alone grants full-screen intents.
        promise.resolve(Build.VERSION.SDK_INT < 34 || reactContext.getSystemService(android.app.NotificationManager::class.java).canUseFullScreenIntent())
    }

    @ReactMethod
    fun openFullScreenSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 34) {
            runCatching {
                reactContext.startActivity(Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT", Uri.parse("package:${reactContext.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun setHueCredentials(ip: String, username: String, promise: Promise) {
        // Store where the alarm receiver (native, no JS) can read them at ring time.
        reactContext.getSharedPreferences(HUE_PREFS, Context.MODE_PRIVATE).edit()
            .putString("ip", ip).putString("username", username).apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun clearHueCredentials(promise: Promise) {
        reactContext.getSharedPreferences(HUE_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        // "Display over other apps" — the exemption that lets the ringing screen
        // launch over everything even while the phone is unlocked and in use.
        promise.resolve(Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 23) {
            reactContext.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${reactContext.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun previewRingtone(profile: String, promise: Promise) {
        previewHandler.post {
            preview?.stop()
            val type = if (profile == "calm") RingtoneManager.TYPE_NOTIFICATION else if (profile == "short") RingtoneManager.TYPE_RINGTONE else RingtoneManager.TYPE_ALARM
            val uri = RingtoneManager.getDefaultUri(type)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            preview = uri?.let { RingtoneManager.getRingtone(reactContext, it) }
            // Play on the ALARM stream so it's audible like the real alarm, even
            // when the ringer is silenced. (Setting a low .volume made it inaudible.)
            preview?.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            preview?.play()
            previewHandler.removeCallbacksAndMessages(null)
            previewHandler.postDelayed({ preview?.stop() }, 6_000)
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun stopRingtonePreview(promise: Promise) {
        previewHandler.post { preview?.stop(); promise.resolve(null) }
    }

    private fun scheduleOne(id: String, hour: Int, minute: Int, days: Set<Int>, ringtone: String, label: String, light: LightConfig, triggerAt: Long = 0L) {
        val trigger = if (triggerAt > 0) triggerAt else AlarmTiming.next(hour, minute, days)
        val record = AlarmRecord(hour, minute, days, ringtone, label, light, trigger)
        reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(id, record.serialize()).apply()
        AlarmArming.arm(reactContext, id, trigger, light)
    }

    companion object {
        const val PREFS = "native_alarm_schedules"
        const val HUE_PREFS = "hue_config"
        const val MAX_SEQUENCE = 12
        const val TIMER_ID = "timer"
    }
}

object AlarmTiming {
    fun next(hour: Int, minute: Int, days: Set<Int>): Long {
        val now = Calendar.getInstance()
        val candidate = now.clone() as Calendar
        candidate.set(Calendar.HOUR_OF_DAY, hour)
        candidate.set(Calendar.MINUTE, minute)
        candidate.set(Calendar.SECOND, 0)
        candidate.set(Calendar.MILLISECOND, 0)
        if (days.isEmpty()) {
            if (candidate.timeInMillis <= now.timeInMillis) candidate.add(Calendar.DATE, 1)
            return candidate.timeInMillis
        }
        for (offset in 0..7) {
            val mondayBasedDay = (now.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7 + 1
            if ((mondayBasedDay - 1 + offset) % 7 + 1 in days) {
                val result = candidate.clone() as Calendar
                result.add(Calendar.DATE, offset)
                if (result.timeInMillis > now.timeInMillis) return result.timeInMillis
            }
        }
        candidate.add(Calendar.DATE, 7)
        return candidate.timeInMillis
    }
}
