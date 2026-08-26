package com.example.dokad.data

import android.content.Context
import android.graphics.*
import com.example.dokad.geo.GeoUtils
import com.example.dokad.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*

class WalkRepository(private val context: Context) {

    private val prefs = context.getSharedPreferences("dokad_native_prefs", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    private val memoriesDir = File(context.filesDir, "memories").apply {
        if (!exists()) mkdirs()
    }

    fun getTodayDateString(date: Date = Date()): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)
    }

    fun getYesterdayDateString(): String {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, -1)
        return getTodayDateString(cal.time)
    }

    fun getStreakStats(): StreakStats {
        val raw = prefs.getString("streak_stats", null) ?: return StreakStats()
        return try {
            val stats = json.decodeFromString<StreakStats>(raw)
            val today = getTodayDateString()
            val yesterday = getYesterdayDateString()

            if (stats.lastCompletedDate != null &&
                stats.lastCompletedDate != today &&
                stats.lastCompletedDate != yesterday
            ) {
                val reset = stats.copy(currentStreak = 0)
                saveStreakStats(reset)
                reset
            } else {
                stats
            }
        } catch (e: Exception) {
            StreakStats()
        }
    }

    fun saveStreakStats(stats: StreakStats) {
        prefs.edit().putString("streak_stats", json.encodeToString(stats)).apply()
    }

    fun getDailyWalk(): DailyWalk? {
        val raw = prefs.getString("daily_walk", null) ?: return null
        return try {
            val walk = json.decodeFromString<DailyWalk>(raw)
            if (walk.date == getTodayDateString()) walk else null
        } catch (e: Exception) {
            null
        }
    }

    fun saveDailyWalk(walk: DailyWalk) {
        prefs.edit().putString("daily_walk", json.encodeToString(walk)).apply()
    }

    fun generateNewDailyWalk(origin: GeoPoint): DailyWalk {
        val rawSpots = GeoUtils.generate3SpotsInRadius(origin, radiusKm = 2.0, count = 3)
        val (ordered, totalDist, _) = GeoUtils.solveOptimalRoute(origin, rawSpots)

        val spots = ordered.mapIndexed { index, geoPoint ->
            WalkSpot(
                id = "spot_${index + 1}_${System.currentTimeMillis()}",
                step = index + 1,
                lat = geoPoint.lat,
                lng = geoPoint.lng,
                isCheckedIn = false
            )
        }

        val walk = DailyWalk(
            date = getTodayDateString(),
            origin = origin,
            spots = spots,
            totalDistanceKm = totalDist,
            isCompleted = false
        )

        saveDailyWalk(walk)
        return walk
    }

    /**
     * Watermarks and saves a verified photo into app internal storage.
     */
    fun saveVerifiedPhoto(
        date: String,
        spotIndex: Int,
        bitmap: Bitmap,
        spotMeta: WalkSpot
    ): String {
        val watermarked = watermarkBitmap(bitmap, spotMeta.step, spotMeta.lat, spotMeta.lng)
        val fileName = "${date}_spot_${spotIndex + 1}.jpg"
        val file = File(memoriesDir, fileName)

        FileOutputStream(file).use { out ->
            watermarked.compress(Bitmap.CompressFormat.JPEG, 90, out)
        }

        return file.absolutePath
    }

    private fun watermarkBitmap(src: Bitmap, step: Int, lat: Double, lng: Double): Bitmap {
        val result = src.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(result)
        val width = result.width.toFloat()
        val height = result.height.toFloat()

        val barHeight = height * 0.12f
        val paintBar = Paint().apply {
            color = Color.argb(200, 0, 0, 0)
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, height - barHeight, width, height, paintBar)

        val timeStr = SimpleDateFormat("HH:mm", Locale.US).format(Date())
        val dateStr = SimpleDateFormat("dd MMM yyyy", Locale.US).format(Date()).uppercase()

        val paintTextYellow = Paint().apply {
            color = Color.parseColor("#FACC15")
            textSize = barHeight * 0.38f
            isFakeBoldText = true
            isAntiAlias = true
        }

        val paintTextBlue = Paint().apply {
            color = Color.parseColor("#38BDF8")
            textSize = barHeight * 0.30f
            isAntiAlias = true
        }

        canvas.drawText("DOKĄD? SPOT #$step • $timeStr", 24f, height - barHeight * 0.52f, paintTextYellow)
        canvas.drawText("📅 $dateStr • 📍 %.4f, %.4f".format(lat, lng), 24f, height - barHeight * 0.15f, paintTextBlue)

        return result
    }

    fun getMemoriesForDate(date: String): List<PhotoMemory> {
        val list = mutableListOf<PhotoMemory>()
        for (i in 1..3) {
            val file = File(memoriesDir, "${date}_spot_$i.jpg")
            if (file.exists()) {
                list.add(
                    PhotoMemory(
                        date = date,
                        spotIndex = i - 1,
                        step = i,
                        photoPath = file.absolutePath,
                        lat = 0.0,
                        lng = 0.0,
                        timestamp = SimpleDateFormat("HH:mm", Locale.US).format(Date(file.lastModified()))
                    )
                )
            }
        }
        return list
    }
}
