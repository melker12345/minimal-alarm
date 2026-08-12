package com.minimalalarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Space
import android.widget.TextView
import java.lang.ref.WeakReference
import java.util.Calendar
import kotlin.random.Random

/**
 * Full-screen "alarm is ringing" UI. Native (not React Native) so it appears
 * instantly over the lock screen even when the JS runtime isn't alive. It is
 * `singleInstance`, so the receiver launch and the notification full-screen
 * intent collapse onto one screen.
 *
 * Dismissing is deliberately a small challenge (press one specific colour a few
 * times, chosen at random each ring) so you can't swat it away half-asleep. On
 * the lock screen you must additionally unlock the phone before it stops.
 */
class RingingActivity : Activity() {
    private val clock = Handler(Looper.getMainLooper())
    private lateinit var timeText: TextView
    private lateinit var dateText: TextView
    private lateinit var challengeText: TextView
    private lateinit var progressText: TextView

    private var targetIsRed = true
    private var redOnLeft = true
    private var progress = 0
    private val required = 3

    private val tick = object : Runnable {
        override fun run() {
            renderClock()
            clock.postDelayed(this, 1_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        )
        targetIsRed = Random.nextBoolean()
        redOnLeft = Random.nextBoolean()
        setContentView(buildScreen())
        live = WeakReference(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent) // singleInstance: reuse this screen for the FSI relaunch
    }

    override fun onResume() {
        super.onResume()
        renderClock()
        clock.removeCallbacks(tick)
        clock.postDelayed(tick, 1_000)
    }

    override fun onPause() {
        super.onPause()
        clock.removeCallbacks(tick)
    }

    private fun showOverLockScreen() {
        // Show over the lock screen and wake the display, but do NOT dismiss the
        // keyguard here — the user must unlock to actually stop the alarm.
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
    }

    // --- UI ---------------------------------------------------------------

    private fun buildScreen(): FrameLayout {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        val root = FrameLayout(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(ACCENT, ACCENT_DEEP, INDIGO),
            )
            setPadding(dp(28), dp(60), dp(28), dp(40))
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        val brand = TextView(this).apply {
            text = "MINIMAL ALARM"
            textSize = 12f
            letterSpacing = 0.28f
            setTextColor(Color.argb(200, 255, 255, 255))
            typeface = Typeface.DEFAULT_BOLD
        }

        timeText = TextView(this).apply {
            textSize = 78f
            letterSpacing = -0.03f
            setTextColor(Color.WHITE)
            typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(0, dp(14), 0, 0)
        }

        dateText = TextView(this).apply {
            textSize = 16f
            setTextColor(Color.argb(210, 255, 255, 255))
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, 0)
        }

        val labelCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(16), dp(22), dp(16))
            background = pill(Color.argb(38, 255, 255, 255), dp(24).toFloat())
        }
        val cardTitle = TextView(this).apply {
            text = intent.getStringExtra(EXTRA_LABEL) ?: "Wake up"
            textSize = 19f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        labelCard.addView(cardTitle)

        // --- Challenge ---
        challengeText = TextView(this).apply {
            textSize = 17f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        progressText = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.argb(200, 255, 255, 255))
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, 0)
        }

        val buttonRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val redBtn = colorButton("RED", RED_BTN)
        val blueBtn = colorButton("BLUE", BLUE_BTN)
        redBtn.setOnClickListener { onColorPress(true) }
        blueBtn.setOnClickListener { onColorPress(false) }
        val first = if (redOnLeft) redBtn else blueBtn
        val second = if (redOnLeft) blueBtn else redBtn
        buttonRow.addView(first, LinearLayout.LayoutParams(0, dp(66), 1f).apply { marginEnd = dp(6) })
        buttonRow.addView(second, LinearLayout.LayoutParams(0, dp(66), 1f).apply { marginStart = dp(6) })

        content.addView(brand, wrap())
        content.addView(timeText, wrap())
        content.addView(dateText, wrap())
        content.addView(Space(this), LinearLayout.LayoutParams(dp(1), dp(24)))
        content.addView(labelCard, matchWidth())
        content.addView(Space(this), LinearLayout.LayoutParams(1, 0, 1f))
        content.addView(challengeText, matchWidth())
        content.addView(progressText, matchWidth())
        content.addView(Space(this), LinearLayout.LayoutParams(dp(1), dp(14)))
        content.addView(buttonRow, matchWidth())

        root.addView(content, FrameLayout.LayoutParams(-1, -1))
        renderClock()
        renderChallenge()
        return root
    }

    private fun colorButton(label: String, color: Int): TextView =
        TextView(this).apply {
            text = label
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.08f
            background = pill(color, 20f * resources.displayMetrics.density)
            isClickable = true
        }

    private fun renderClock() {
        val now = Calendar.getInstance()
        if (::timeText.isInitialized) {
            timeText.text = "%02d:%02d".format(now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE))
        }
        if (::dateText.isInitialized) {
            val days = arrayOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
            val months = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
            dateText.text = "${days[now.get(Calendar.DAY_OF_WEEK) - 1]}, ${now.get(Calendar.DAY_OF_MONTH)} ${months[now.get(Calendar.MONTH)]}"
        }
    }

    private fun renderChallenge() {
        val colorName = if (targetIsRed) "RED" else "BLUE"
        challengeText.text = "Press the $colorName button $required times to stop"
        progressText.text = "$progress / $required"
    }

    private fun onColorPress(pressedRed: Boolean) {
        if (pressedRed == targetIsRed) {
            progress += 1
            vibrate(20)
            if (progress >= required) {
                completeChallenge()
                return
            }
        } else {
            progress = 0
            vibrate(120)
        }
        renderChallenge()
    }

    private fun wrap() = LinearLayout.LayoutParams(-2, -2)
    private fun matchWidth() = LinearLayout.LayoutParams(-1, -2)
    private fun pill(color: Int, radius: Float) = GradientDrawable().apply { setColor(color); cornerRadius = radius }

    private fun vibrate(ms: Long) {
        val vibrator = getSystemService(Vibrator::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        else @Suppress("DEPRECATION") vibrator.vibrate(ms)
    }

    // --- Dismiss ----------------------------------------------------------

    private fun currentId(): String? = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID)

    private fun completeChallenge() {
        val keyguard = getSystemService(KeyguardManager::class.java)
        if (keyguard != null && keyguard.isKeyguardLocked) {
            // Require the user to actually unlock before the alarm stops.
            challengeText.text = "Unlock to finish stopping the alarm"
            keyguard.requestDismissKeyguard(
                this,
                object : KeyguardManager.KeyguardDismissCallback() {
                    override fun onDismissSucceeded() = stopAlarm()
                    override fun onDismissCancelled() {
                        // Back to the challenge; they must complete it again.
                        progress = 0
                        renderChallenge()
                    }
                },
            )
        } else {
            stopAlarm()
        }
    }

    private fun stopAlarm() {
        currentId()?.let { AlarmRingingService.stop(this, it) }
        finishAndRemoveTask()
    }

    override fun onDestroy() {
        clock.removeCallbacks(tick)
        if (live?.get() === this) live = null
        super.onDestroy()
    }

    companion object {
        const val EXTRA_RINGTONE = "ringtone"
        const val EXTRA_LABEL = "alarm_label"
        private val ACCENT = Color.rgb(53, 106, 230)
        private val ACCENT_DEEP = Color.rgb(45, 74, 165)
        private val INDIGO = Color.rgb(32, 44, 96)
        private val RED_BTN = Color.rgb(229, 72, 77)
        private val BLUE_BTN = Color.rgb(47, 107, 255)

        private var live: WeakReference<RingingActivity>? = null

        /** Finishes the on-screen ringing UI (called when the service stops). */
        fun dismiss() {
            live?.get()?.let { activity -> activity.runOnUiThread { activity.finishAndRemoveTask() } }
            live = null
        }

        fun intentFor(context: Context, id: String, ringtone: String, hour: Int, minute: Int, label: String): Intent =
            Intent(context, RingingActivity::class.java)
                .putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
                .putExtra(EXTRA_RINGTONE, ringtone)
                .putExtra("hour", hour)
                .putExtra("minute", minute)
                .putExtra(EXTRA_LABEL, label)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
}
