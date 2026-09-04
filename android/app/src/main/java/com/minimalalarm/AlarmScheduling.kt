package com.minimalalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/** The Philips Hue "wake with light" configuration for an alarm. */
data class LightConfig(
    val enabled: Boolean,
    val program: String, // instant | sunrise | party
    val fadeMinutes: Int,
    val startWarmth: Int,
    val endWarmth: Int,
    val coolShiftMinutes: Int,
    val brightness: Int,
) {
    companion object {
        val OFF = LightConfig(false, "instant", 30, 90, 20, 0, 100)
    }
}

/**
 * The persisted form of one scheduled alarm occurrence. Stored as a single
 * "~"-separated string in SharedPreferences and parsed here so the receiver,
 * boot handler, and module all agree on the format.
 */
data class AlarmRecord(
    val hour: Int,
    val minute: Int,
    val days: Set<Int>,
    val ringtone: String,
    val label: String,
    val light: LightConfig,
    // Epoch millis this occurrence is armed for; lets boot recovery tell a
    // still-pending one-shot (e.g. set before midnight for tomorrow) from one
    // that was missed while the phone was off. 0 = unknown (legacy record).
    val armedFor: Long = 0,
) {
    fun serialize(): String = listOf(
        hour, minute, days.joinToString(","), ringtone, label.replace("~", " "),
        light.enabled, light.program, light.fadeMinutes, light.startWarmth,
        light.endWarmth, light.coolShiftMinutes, light.brightness, armedFor,
    ).joinToString("~")

    companion object {
        fun parse(stored: String?): AlarmRecord? {
            val v = stored?.split("~") ?: return null
            val hour = v.getOrNull(0)?.toIntOrNull() ?: return null
            val minute = v.getOrNull(1)?.toIntOrNull() ?: return null
            val days = v.getOrNull(2)?.split(",")?.filter { it.isNotBlank() }?.map { it.toInt() }?.toSet() ?: emptySet()
            val ringtone = v.getOrNull(3) ?: "default"
            val label = v.getOrNull(4)?.takeIf { it.isNotBlank() } ?: "Wake up"
            val light = LightConfig(
                enabled = v.getOrNull(5) == "true",
                program = v.getOrNull(6)?.takeIf { it.isNotBlank() } ?: "instant",
                fadeMinutes = v.getOrNull(7)?.toIntOrNull() ?: 30,
                startWarmth = v.getOrNull(8)?.toIntOrNull() ?: 90,
                endWarmth = v.getOrNull(9)?.toIntOrNull() ?: 20,
                coolShiftMinutes = v.getOrNull(10)?.toIntOrNull() ?: 0,
                brightness = v.getOrNull(11)?.toIntOrNull() ?: 100,
            )
            val armedFor = v.getOrNull(12)?.toLongOrNull() ?: 0L
            return AlarmRecord(hour, minute, days, ringtone, label, light, armedFor)
        }
    }
}

/**
 * Arms/cancels the AlarmManager alarms for a given id. A sunrise program needs a
 * second "pre-alarm" that fires [LightConfig.fadeMinutes] before the main one so
 * the lights can start fading up ahead of time.
 */
object AlarmArming {
    private fun mainPending(context: Context, id: String) = PendingIntent.getBroadcast(
        context, id.hashCode(),
        Intent(context, AlarmReceiver::class.java).putExtra(AlarmReceiver.EXTRA_ALARM_ID, id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun sunrisePending(context: Context, id: String) = PendingIntent.getBroadcast(
        context, "$id#sun".hashCode(),
        Intent(context, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_SUNRISE).putExtra(AlarmReceiver.EXTRA_ALARM_ID, id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    fun arm(context: Context, id: String, triggerAt: Long, light: LightConfig) {
        val manager = context.getSystemService(AlarmManager::class.java)
        setAlarmClock(context, manager, triggerAt, mainPending(context, id))
        val sunrise = sunrisePending(context, id)
        if (light.enabled && light.program == "sunrise" && light.fadeMinutes > 0) {
            val pre = triggerAt - light.fadeMinutes * 60_000L
            // The pre-alarm is an invisible light fade — exact, but not an
            // "alarm clock" (no status-bar alarm icon for it).
            if (pre > System.currentTimeMillis()) setExact(manager, pre, sunrise) else manager.cancel(sunrise)
        } else {
            manager.cancel(sunrise)
        }
    }

    fun cancel(context: Context, id: String) {
        val manager = context.getSystemService(AlarmManager::class.java)
        manager.cancel(mainPending(context, id))
        manager.cancel(sunrisePending(context, id))
    }

    /**
     * setAlarmClock is the primitive meant for user-visible alarm clocks: it is
     * exempt from Doze deferral, shows the alarm icon in the status bar, and
     * grants the background-start allowance the ringing UI relies on.
     */
    private fun setAlarmClock(context: Context, manager: AlarmManager, triggerAt: Long, pending: PendingIntent) {
        val show = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        try {
            manager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), pending)
        } catch (_: SecurityException) {
            // Exact-alarm permission revoked: better an approximate alarm than
            // none. The permission card in Settings surfaces the degraded state.
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        }
    }

    private fun setExact(manager: AlarmManager, triggerAt: Long, pending: PendingIntent) {
        try {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        } catch (_: SecurityException) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        }
    }
}
