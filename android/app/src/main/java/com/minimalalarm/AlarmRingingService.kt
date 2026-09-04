package com.minimalalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * Foreground service that is the single source of truth for a *ringing* alarm:
 * it owns the sound and the notification. The visible UI is [RingingActivity],
 * which is launched by [AlarmReceiver] (unlocked case) and by this service's
 * full-screen-intent (locked / screen-off case). Because the activity uses
 * `singleInstance`, both paths resolve to one screen — never a duplicate.
 */
class AlarmRingingService : Service() {
    private var ringtone: Ringtone? = null
    private var notificationId = 0
    private val handler = Handler(Looper.getMainLooper())
    private val shortStop = Runnable { stopRinging() }

    // Party strobe: driven on a background thread for the life of the ringing.
    private var strobeThread: android.os.HandlerThread? = null
    private var strobeHandler: Handler? = null
    private var strobeIds: List<String> = emptyList()
    private var strobeBrightness = 100
    private val strobeTick = object : Runnable {
        override fun run() {
            if (strobeIds.isNotEmpty()) HueController.partyFlash(this@AlarmRingingService, strobeIds, strobeBrightness)
            strobeHandler?.postDelayed(this, 600)
        }
    }
    private val ramp = object : Runnable {
        override fun run() {
            if (Build.VERSION.SDK_INT >= 28) {
                val current = ringtone?.volume ?: 1f
                ringtone?.volume = (current + 0.15f).coerceAtMost(1f)
                if (current < 1f) handler.postDelayed(this, 900)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopRinging()
            return START_NOT_STICKY
        }
        val id = intent?.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) ?: return START_NOT_STICKY
        notificationId = id.hashCode()
        val profile = intent.getStringExtra("ringtone") ?: "default"
        val hour = intent.getIntExtra("hour", 0)
        val minute = intent.getIntExtra("minute", 0)
        val label = intent.getStringExtra("alarm_label") ?: "Wake up"
        createChannel()
        startForeground(notificationId, buildNotification(id, profile, hour, minute, label))
        startRingtone(profile)
        if (intent.getBooleanExtra("party", false)) {
            strobeBrightness = intent.getIntExtra("brightness", 100)
            startStrobe()
        }
        releaseWakeLock() // sound is playing; the receiver's bridge lock is done
        return START_NOT_STICKY
    }

    private fun startStrobe() {
        val thread = android.os.HandlerThread("hue-strobe").also { it.start() }
        strobeThread = thread
        val h = Handler(thread.looper)
        strobeHandler = h
        h.post {
            strobeIds = HueController.beginParty(this) // snapshot + fetch light ids (network)
            h.post(strobeTick)
        }
    }

    private fun stopStrobe() {
        strobeHandler?.removeCallbacksAndMessages(null)
        strobeThread?.quitSafely()
        strobeThread = null
        strobeHandler = null
        strobeIds = emptyList()
    }

    private fun buildNotification(id: String, profile: String, hour: Int, minute: Int, label: String): Notification {
        val fullScreen = PendingIntent.getActivity(
            this,
            notificationId,
            RingingActivity.intentFor(this, id, profile, hour, minute, label),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            notificationId + 1,
            Intent(this, AlarmRingingService::class.java).setAction(ACTION_STOP).putExtra(AlarmReceiver.EXTRA_ALARM_ID, id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val displayHour = if (hour == 0) 24 else hour
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(label)
            .setContentText("Alarm · %02d:%02d".format(displayHour, minute))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(fullScreen)
            .setFullScreenIntent(fullScreen, true)
            .addAction(0, "Stop alarm", stopIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true) // the Ringtone below drives audio; avoid double sound
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
                    setSound(null, null) // the service plays the ringtone itself
                    setBypassDnd(true)
                    enableVibration(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
            )
        }
    }

    private fun startRingtone(profile: String) {
        ringtone?.stop()
        val type = if (profile == "calm") RingtoneManager.TYPE_NOTIFICATION else if (profile == "short") RingtoneManager.TYPE_RINGTONE else RingtoneManager.TYPE_ALARM
        val uri = RingtoneManager.getDefaultUri(type) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ringtone = uri?.let { RingtoneManager.getRingtone(this, it) }
        ringtone?.audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        if (Build.VERSION.SDK_INT >= 28) ringtone?.isLooping = profile != "short"
        if (Build.VERSION.SDK_INT >= 28 && profile == "intense") ringtone?.volume = 1f
        if (Build.VERSION.SDK_INT >= 28 && profile == "ramp") ringtone?.volume = 0.15f
        ringtone?.play()
        if (profile == "ramp") handler.postDelayed(ramp, 900)
        if (profile == "short") handler.postDelayed(shortStop, 8_000)
    }

    private fun stopRinging() {
        handler.removeCallbacks(ramp)
        handler.removeCallbacks(shortStop)
        stopStrobe()
        ringtone?.stop()
        ringtone = null
        // Put any Hue lights this alarm turned on back to their previous state.
        HueController.restore(this)
        RingingActivity.dismiss()
        stopForeground(STOP_FOREGROUND_REMOVE)
        if (notificationId != 0) getSystemService(NotificationManager::class.java).cancel(notificationId)
        stopSelf()
    }

    override fun onDestroy() {
        handler.removeCallbacks(ramp)
        handler.removeCallbacks(shortStop)
        stopStrobe()
        ringtone?.stop()
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.minimalalarm.STOP_ALARM"
        const val CHANNEL_ID = "minimal_alarm_ringing_v3"

        // Bridges the gap between AlarmReceiver returning (which releases
        // AlarmManager's own wakelock) and this service actually playing audio;
        // without it the device can re-suspend before the alarm makes a sound.
        private var startupLock: android.os.PowerManager.WakeLock? = null

        fun holdWakeLock(context: android.content.Context) {
            releaseWakeLock()
            startupLock = context.getSystemService(android.os.PowerManager::class.java)
                .newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "minimalalarm:ring-start")
                .apply { acquire(60_000L) }
        }

        fun releaseWakeLock() {
            startupLock?.let { if (it.isHeld) it.release() }
            startupLock = null
        }

        fun stop(context: android.content.Context, id: String) {
            context.startService(Intent(context, AlarmRingingService::class.java).setAction(ACTION_STOP).putExtra(AlarmReceiver.EXTRA_ALARM_ID, id))
        }
    }
}
