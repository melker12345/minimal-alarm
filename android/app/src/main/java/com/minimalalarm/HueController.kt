package com.minimalalarm

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.random.Random

/**
 * Best-effort "wake with light". Uses the Hue bridge's own transition engine
 * (transitiontime, up to ~109 min) so slow fades don't need the app running —
 * we just fire a few PUTs at scheduled points:
 *   - sunriseStart  (fired fadeMinutes before the alarm): warm dim → fade up
 *   - sunriseWake   (fired at alarm time): warm → cool shift
 *   - wakeInstant   (instant program): snap on at alarm time
 *   - party         (driven live by AlarmRingingService while ringing): strobe
 * Every entry snapshots the lights first; [restore] puts them back on dismiss.
 *
 * All calls run on a background thread and swallow failures — the alarm must
 * never depend on the bridge. Credentials come from HUE_PREFS (written by JS).
 */
object HueController {
    private const val SNAPSHOT_KEY = "snapshot"

    private data class Creds(val ip: String, val user: String)

    private fun creds(context: Context): Creds? {
        val prefs = context.getSharedPreferences(AlarmSchedulerModule.HUE_PREFS, Context.MODE_PRIVATE)
        val ip = prefs.getString("ip", null) ?: return null
        val user = prefs.getString("username", null) ?: return null
        return Creds(ip, user)
    }

    private fun warmthToCt(pct: Int) = (153 + (pct.coerceIn(0, 100) / 100.0) * (500 - 153)).toInt()
    private fun briOf(pct: Int) = (pct.coerceIn(0, 100) / 100.0 * 254).toInt().coerceAtLeast(1)

    // --- Programs ---------------------------------------------------------

    fun wakeInstant(context: Context, brightness: Int, warmth: Int) {
        val c = creds(context) ?: return
        Thread {
            runCatching {
                val ids = snapshotAndIds(context, c)
                val body = """{"on":true,"bri":${briOf(brightness)},"ct":${warmthToCt(warmth)},"transitiontime":10}"""
                ids.forEach { runCatching { putState(c, it, body) } }
            }
        }.start()
    }

    /** Fired fadeMinutes before the alarm: warm & dim, fading up to peak. */
    fun sunriseStart(context: Context, fadeMinutes: Int, brightness: Int, startWarmth: Int) {
        val c = creds(context) ?: return
        Thread {
            runCatching {
                val ids = snapshotAndIds(context, c)
                val ct = warmthToCt(startWarmth)
                val fade = (fadeMinutes.coerceIn(1, 109) * 600) // deciseconds
                ids.forEach { id ->
                    runCatching { putState(c, id, """{"on":true,"bri":1,"ct":$ct,"transitiontime":2}""") }
                    runCatching { putState(c, id, """{"bri":${briOf(brightness)},"ct":$ct,"transitiontime":$fade}""") }
                }
            }
        }.start()
    }

    /** Fired at alarm time for sunrise: shift warm → cool (and cover a missed pre-event). */
    fun sunriseWake(context: Context, brightness: Int, startWarmth: Int, endWarmth: Int, coolMinutes: Int) {
        val c = creds(context) ?: return
        Thread {
            runCatching {
                val prefs = context.getSharedPreferences(AlarmSchedulerModule.HUE_PREFS, Context.MODE_PRIVATE)
                val missedPreEvent = prefs.getString(SNAPSHOT_KEY, null) == null
                val ids = snapshotAndIds(context, c)
                if (missedPreEvent) {
                    // No fade happened — bring lights up now so the alarm still lights the room.
                    val ct = warmthToCt(startWarmth)
                    ids.forEach { runCatching { putState(c, it, """{"on":true,"bri":${briOf(brightness)},"ct":$ct,"transitiontime":20}""") } }
                }
                if (coolMinutes > 0) {
                    val ct = warmthToCt(endWarmth)
                    val fade = (coolMinutes.coerceIn(1, 109) * 600)
                    ids.forEach { runCatching { putState(c, it, """{"on":true,"ct":$ct,"transitiontime":$fade}""") } }
                }
            }
        }.start()
    }

    // --- Party strobe (driven by the service while ringing) ---------------

    /** Snapshot + return light ids so the caller can strobe them. */
    fun beginParty(context: Context): List<String> {
        val c = creds(context) ?: return emptyList()
        return runCatching { snapshotAndIds(context, c) }.getOrDefault(emptyList())
    }

    /** One strobe frame: a random saturated colour on each light at full-ish brightness. */
    fun partyFlash(context: Context, ids: List<String>, brightness: Int) {
        val c = creds(context) ?: return
        ids.forEach { id ->
            val hue = Random.nextInt(0, 65536)
            runCatching { putState(c, id, """{"on":true,"bri":${briOf(brightness)},"hue":$hue,"sat":254,"transitiontime":0}""") }
        }
    }

    // --- Snapshot / restore ----------------------------------------------

    /** Put every light back to the state captured by the last program. */
    fun restore(context: Context) {
        val c = creds(context) ?: return
        val prefs = context.getSharedPreferences(AlarmSchedulerModule.HUE_PREFS, Context.MODE_PRIVATE)
        val snapshot = prefs.getString(SNAPSHOT_KEY, null) ?: return
        Thread {
            runCatching {
                val snap = JSONObject(snapshot)
                var anyRestored = false
                snap.keys().forEach { id ->
                    runCatching { putState(c, id, restoreBody(snap.getJSONObject(id))) }.onSuccess { anyRestored = true }
                }
                // Keep the snapshot if the bridge was unreachable so a later
                // dismiss (or the next alarm's restore) can still put it back.
                if (anyRestored) prefs.edit().remove(SNAPSHOT_KEY).apply()
            }
        }.start()
    }

    /** Fetch lights, snapshot their state if not already captured, return the ids. */
    private fun snapshotAndIds(context: Context, c: Creds): List<String> {
        val lights = getLights(c)
        val prefs = context.getSharedPreferences(AlarmSchedulerModule.HUE_PREFS, Context.MODE_PRIVATE)
        if (prefs.getString(SNAPSHOT_KEY, null) == null) {
            prefs.edit().putString(SNAPSHOT_KEY, buildSnapshot(lights).toString()).apply()
        }
        return lights.keys().asSequence().toList()
    }

    private fun buildSnapshot(lights: JSONObject): JSONObject {
        val out = JSONObject()
        lights.keys().forEach { id ->
            val state = lights.optJSONObject(id)?.optJSONObject("state") ?: return@forEach
            val entry = JSONObject()
                .put("on", state.optBoolean("on", false))
                .put("bri", state.optInt("bri", 254))
                .put("colormode", state.optString("colormode", ""))
            if (state.has("ct")) entry.put("ct", state.optInt("ct"))
            if (state.has("hue")) entry.put("hue", state.optInt("hue"))
            if (state.has("sat")) entry.put("sat", state.optInt("sat"))
            state.optJSONArray("xy")?.let { entry.put("xy", it) }
            out.put(id, entry)
        }
        return out
    }

    private fun restoreBody(state: JSONObject): String {
        if (!state.optBoolean("on", false)) return """{"on":false,"transitiontime":4}"""
        val body = JSONObject().put("on", true).put("bri", state.optInt("bri", 254)).put("transitiontime", 4)
        when (state.optString("colormode", "")) {
            "ct" -> if (state.has("ct")) body.put("ct", state.getInt("ct"))
            "hs" -> {
                if (state.has("hue")) body.put("hue", state.getInt("hue"))
                if (state.has("sat")) body.put("sat", state.getInt("sat"))
            }
            "xy" -> state.optJSONArray("xy")?.let { body.put("xy", it) }
        }
        return body.toString()
    }

    // --- HTTP -------------------------------------------------------------

    private fun getLights(c: Creds): JSONObject {
        val connection = (URL("http://${c.ip}/api/${c.user}/lights").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 4000
            readTimeout = 4000
        }
        return try {
            JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally {
            connection.disconnect()
        }
    }

    private fun putState(c: Creds, id: String, body: String) {
        val connection = (URL("http://${c.ip}/api/${c.user}/lights/$id/state").openConnection() as HttpURLConnection).apply {
            requestMethod = "PUT"
            connectTimeout = 4000
            readTimeout = 4000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        try {
            connection.outputStream.use { it.write(body.toByteArray()) }
            connection.inputStream.use { it.readBytes() }
        } finally {
            connection.disconnect()
        }
    }
}
