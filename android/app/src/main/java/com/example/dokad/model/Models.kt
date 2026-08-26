package com.example.dokad.model

import kotlinx.serialization.Serializable

@Serializable
data class GeoPoint(
    val lat: Double,
    val lng: Double
)

@Serializable
data class WalkSpot(
    val id: String,
    val step: Int,
    val lat: Double,
    val lng: Double,
    val isCheckedIn: Boolean = false,
    val photoPath: String? = null,
    val checkedInAt: String? = null
)

@Serializable
data class DailyWalk(
    val date: String,
    val origin: GeoPoint,
    val spots: List<WalkSpot>,
    val totalDistanceKm: Double,
    val isCompleted: Boolean = false
)

@Serializable
data class StreakStats(
    val currentStreak: Int = 0,
    val lastCompletedDate: String? = null,
    val totalCompletedDays: Int = 0,
    val completedDates: List<String> = emptyList()
)

data class PhotoMemory(
    val date: String,
    val spotIndex: Int,
    val step: Int,
    val photoPath: String,
    val lat: Double,
    val lng: Double,
    val timestamp: String
)
