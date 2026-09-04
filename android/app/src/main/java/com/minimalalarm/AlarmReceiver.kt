package com.minimalalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Fired by AlarmManager. Two roles, chosen by intent action:
 *  - ACTION_SUNRISE: the pre-alarm — start the Hue fade-up, nothing else.
 *  - default: the alarm itself — re-arm the next occurrence, start the ringing
 *    service + full-screen UI, and trigger the light program.
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_ALARM_ID) ?: return
        val record = AlarmRecord.parse(
            context.getSharedPreferences(AlarmSchedulerModule.PREFS, Context.MODE_PRIVATE).getString(id, null),
        ) ?: return

        if (intent.action == ACTION_SUNRISE) {
            val light = record.light
            if (light.enabled && light.program == "sunrise") {
                HueController.sunriseStart(context, light.fadeMinutes, light.brightness, light.startWarmth)
            }
            return
        }

        // Re-arm the next occurrence (repeating) or clean up (one-shot).
        if (record.days.isEmpty()) {
            context.getSharedPreferences(AlarmSchedulerModule.PREFS, Context.MODE_PRIVATE).edit().remove(id).apply()
            AlarmArming.cancel(context, id)
        } else {
            val trigger = AlarmTiming.next(record.hour, record.minute, record.days)
            context.getSharedPreferences(AlarmSchedulerModule.PREFS, Context.MODE_PRIVATE).edit()
                .putString(id, record.copy(armedFor = trigger).serialize()).apply()
            AlarmArming.arm(context, id, trigger, record.light)
        }

        // Light program.
        val light = record.light
        if (light.enabled) {
            when (light.program) {
                "instant" -> HueController.wakeInstant(context, light.brightness, light.startWarmth)
                "sunrise" -> HueController.sunriseWake(context, light.brightness, light.startWarmth, light.endWarmth, light.coolShiftMinutes)
                // "party" is driven live by the ringing service (strobe while ringing).
            }
        }

        // Ring: sound + notification (single source of truth) + full-screen UI.
        val serviceIntent = Intent(context, AlarmRingingService::class.java)
            .putExtra(EXTRA_ALARM_ID, id)
            .putExtra("ringtone", record.ringtone)
            .putExtra("hour", record.hour)
            .putExtra("minute", record.minute)
            .putExtra("alarm_label", record.label)
            .putExtra("party", light.enabled && light.program == "party")
            .putExtra("brightness", light.brightness)
        // Keep the CPU awake until the service is up and playing; AlarmManager's
        // own wakelock is released the moment onReceive returns.
        AlarmRingingService.holdWakeLock(context)
        if (android.os.Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(context, serviceIntent) else context.startService(serviceIntent)

        runCatching { context.startActivity(RingingActivity.intentFor(context, id, record.ringtone, record.hour, record.minute, record.label)) }
    }

    companion object {
        const val EXTRA_ALARM_ID = "alarm_id"
        const val ACTION_SUNRISE = "com.minimalalarm.SUNRISE"
    }
}

/** Re-arms every stored alarm after a reboot or a clock/timezone change. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences(AlarmSchedulerModule.PREFS, Context.MODE_PRIVATE)
        prefs.all.forEach { (id, stored) ->
            val record = AlarmRecord.parse(stored as? String) ?: return@forEach
            // A one-shot record only exists while pending (it's removed at ring
            // time), so if its armed moment passed while the phone was off it
            // was missed — clean it up instead of ringing a day late.
            if (record.days.isEmpty() && record.armedFor in 1 until System.currentTimeMillis()) {
                AlarmArming.cancel(context, id)
                prefs.edit().remove(id).apply()
                return@forEach
            }
            val trigger = AlarmTiming.next(record.hour, record.minute, record.days)
            prefs.edit().putString(id, record.copy(armedFor = trigger).serialize()).apply()
            AlarmArming.arm(context, id, trigger, record.light)
        }
    }
}
