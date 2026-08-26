package com.example.dokad.ui.main

import android.app.Application
import android.graphics.Bitmap
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.content.getSystemService
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.dokad.data.WalkRepository
import com.example.dokad.geo.GeoUtils
import com.example.dokad.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MainScreenViewModel(application: Application) : AndroidViewModel(application) {

    val repository = WalkRepository(application)
    private val vibrator = application.getSystemService<Vibrator>()

    private val _userLocation = MutableStateFlow<GeoPoint?>(null)
    val userLocation = _userLocation.asStateFlow()

    private val _dailyWalk = MutableStateFlow<DailyWalk?>(repository.getDailyWalk())
    val dailyWalk = _dailyWalk.asStateFlow()

    private val _streakStats = MutableStateFlow(repository.getStreakStats())
    val streakStats = _streakStats.asStateFlow()

    private val _isUnlocked = MutableStateFlow(false)
    val isUnlocked = _isUnlocked.asStateFlow()

    private val _activeCameraSpot = MutableStateFlow<WalkSpot?>(null)
    val activeCameraSpot = _activeCameraSpot.asStateFlow()

    private val _isCalendarOpen = MutableStateFlow(false)
    val isCalendarOpen = _isCalendarOpen.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage = _toastMessage.asStateFlow()

    fun updateLocation(lat: Double, lng: Double) {
        _userLocation.value = GeoPoint(lat, lng)
    }

    fun unlockApp() {
        _isUnlocked.value = true
        showToast("🔓 DOKĄD UNLOCKED")
    }

    fun verifyManualAccessKey(input: String): Boolean {
        return if (repository.verifyAccessKey(input)) {
            _isUnlocked.value = true
            showToast("✅ ACCESS KEY VERIFIED!")
            true
        } else {
            showToast("❌ INVALID KEY (USE DOKAD-XXXX-XXXX-XXXX)")
            false
        }
    }

    fun getUniversalAccessKey(): String = repository.getUniversalAccessKey()

    fun showToast(msg: String) {
        _toastMessage.value = msg
    }

    fun clearToast() {
        _toastMessage.value = null
    }

    fun openCalendar() {
        _isCalendarOpen.value = true
    }

    fun closeCalendar() {
        _isCalendarOpen.value = false
    }

    fun generateDailyWalk() {
        val origin = _userLocation.value ?: GeoPoint(50.0647, 19.9450)
        val newWalk = repository.generateNewDailyWalk(origin)
        _dailyWalk.value = newWalk
        vibrate(longArrayOf(0, 30, 40, 30))
        showToast("🎯 TODAY'S 3 DESTINATIONS READY!")
    }

    fun promptVerification(spotIndex: Int) {
        val walk = _dailyWalk.value ?: return
        val spot = walk.spots.getOrNull(spotIndex) ?: return

        if (spot.isCheckedIn) {
            showToast("✅ SPOT ALREADY VERIFIED!")
            return
        }

        val user = _userLocation.value
        if (user == null) {
            showToast("📍 WAITING FOR GPS SIGNAL...")
            return
        }

        val inRange = GeoUtils.checkProximity(user, GeoPoint(spot.lat, spot.lng), thresholdMeters = 21.0)
        if (!inRange) {
            val dist = GeoUtils.calculateDistanceMeters(user, GeoPoint(spot.lat, spot.lng)).toInt()
            showToast("⚠️ Too far ($dist m). Get within 21 m to verify!")
            vibrate(longArrayOf(0, 80))
            return
        }

        _activeCameraSpot.value = spot
    }

    fun closeCamera() {
        _activeCameraSpot.value = null
    }

    fun onPhotoCaptured(bitmap: Bitmap) {
        val spot = _activeCameraSpot.value ?: return
        val walk = _dailyWalk.value ?: return

        viewModelScope.launch {
            val photoPath = repository.saveVerifiedPhoto(
                date = walk.date,
                spotIndex = spot.step - 1,
                bitmap = bitmap,
                spotMeta = spot
            )

            val updatedSpots = walk.spots.map {
                if (it.id == spot.id) it.copy(isCheckedIn = true, photoPath = photoPath) else it
            }

            val allDone = updatedSpots.all { it.isCheckedIn }
            val updatedWalk = walk.copy(spots = updatedSpots, isCompleted = allDone)
            repository.saveDailyWalk(updatedWalk)
            _dailyWalk.value = updatedWalk

            if (allDone) {
                val stats = repository.getStreakStats()
                val today = repository.getTodayDateString()
                val yesterday = repository.getYesterdayDateString()

                val newStreak = if (stats.lastCompletedDate == yesterday) stats.currentStreak + 1 else 1
                val newCompletedDates = (stats.completedDates + today).distinct()

                val newStats = stats.copy(
                    currentStreak = newStreak,
                    lastCompletedDate = today,
                    totalCompletedDays = stats.totalCompletedDays + 1,
                    completedDates = newCompletedDates
                )
                repository.saveStreakStats(newStats)
                _streakStats.value = newStats

                vibrate(longArrayOf(0, 50, 60, 50, 60, 100))
                showToast("🎉 ALL 3 DESTINATIONS VERIFIED! STREAK: $newStreak DAYS! 🔥")
            } else {
                showToast("📸 SPOT #${spot.step} PHOTO VERIFIED!")
            }

            _activeCameraSpot.value = null
        }
    }

    private fun vibrate(pattern: LongArray) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, -1)
            }
        } catch (_: Exception) {}
    }
}
