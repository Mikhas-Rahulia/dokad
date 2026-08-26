package com.example.dokad.geo

import com.example.dokad.model.GeoPoint
import kotlin.math.*
import kotlin.random.Random

object GeoUtils {

    private const val EARTH_RADIUS_KM = 6371.0

    fun calculateHaversineDistanceKm(p1: GeoPoint, p2: GeoPoint): Double {
        val dLat = Math.toRadians(p2.lat - p1.lat)
        val dLon = Math.toRadians(p2.lng - p1.lng)
        val lat1Rad = Math.toRadians(p1.lat)
        val lat2Rad = Math.toRadians(p2.lat)

        val a = sin(dLat / 2).pow(2) +
                cos(lat1Rad) * cos(lat2Rad) *
                sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return EARTH_RADIUS_KM * c
    }

    fun calculateDistanceMeters(p1: GeoPoint, p2: GeoPoint): Double {
        return calculateHaversineDistanceKm(p1, p2) * 1000.0
    }

    fun checkProximity(user: GeoPoint, target: GeoPoint, thresholdMeters: Double = 21.0): Boolean {
        return calculateDistanceMeters(user, target) <= thresholdMeters
    }

    fun formatDistance(km: Double): String {
        return if (km < 1.0) {
            "${round(km * 1000).toInt()} M"
        } else {
            "%.1f KM".format(km)
        }
    }

    /**
     * Generates 3 uniformly distributed random spots strictly within radiusKm of center.
     */
    fun generate3SpotsInRadius(
        center: GeoPoint,
        radiusKm: Double = 2.0,
        count: Int = 3,
        minDistanceBetweenMeters: Double = 150.0
    ): List<GeoPoint> {
        val spots = mutableListOf<GeoPoint>()
        var attempts = 0
        val maxAttempts = 500

        while (spots.size < count && attempts < maxAttempts) {
            attempts++
            val r = radiusKm * sqrt(Random.nextDouble())
            val theta = Random.nextDouble() * 2 * PI

            val dLat = (r * cos(theta)) / 111.32
            val dLng = (r * sin(theta)) / (111.32 * cos(Math.toRadians(center.lat)))

            val candidate = GeoPoint(
                lat = (center.lat + dLat * 1e6).roundToInt() / 1e6,
                lng = (center.lng + dLng * 1e6).roundToInt() / 1e6
            )

            val distToCenter = calculateHaversineDistanceKm(center, candidate)
            if (distToCenter > radiusKm) continue
            if (distToCenter * 1000.0 < minDistanceBetweenMeters) continue

            val tooClose = spots.any { existing ->
                calculateDistanceMeters(existing, candidate) < minDistanceBetweenMeters
            }

            if (!tooClose) {
                spots.add(candidate)
            }
        }

        while (spots.size < count) {
            val r = radiusKm * sqrt(Random.nextDouble())
            val theta = Random.nextDouble() * 2 * PI
            val dLat = (r * cos(theta)) / 111.32
            val dLng = (r * sin(theta)) / (111.32 * cos(Math.toRadians(center.lat)))
            spots.add(GeoPoint(center.lat + dLat, center.lng + dLng))
        }

        return spots
    }

    /**
     * Solves shortest TSP route connecting Origin -> Spot1 -> Spot2 -> Spot3.
     */
    fun solveOptimalRoute(origin: GeoPoint, spots: List<GeoPoint>): Triple<List<GeoPoint>, Double, List<Double>> {
        if (spots.size <= 1) {
            val dist = if (spots.isEmpty()) 0.0 else calculateHaversineDistanceKm(origin, spots[0])
            return Triple(spots, dist, listOf(dist))
        }

        // Permutations of 3 elements (6 total paths)
        val permutations = generatePermutations(spots)
        var minDistance = Double.MAX_VALUE
        var bestOrder = spots
        var bestLegs = emptyList<Double>()

        for (order in permutations) {
            var currentDist = 0.0
            val legs = mutableListOf<Double>()
            var prev = origin

            for (spot in order) {
                val leg = calculateHaversineDistanceKm(prev, spot)
                legs.add(leg)
                currentDist += leg
                prev = spot
            }

            if (currentDist < minDistance) {
                minDistance = currentDist
                bestOrder = order
                bestLegs = legs
            }
        }

        return Triple(bestOrder, minDistance, bestLegs)
    }

    private fun <T> generatePermutations(list: List<T>): List<List<T>> {
        if (list.size <= 1) return listOf(list)
        val result = mutableListOf<List<T>>()
        for (i in list.indices) {
            val item = list[i]
            val remaining = list.filterIndexed { index, _ -> index != i }
            for (p in generatePermutations(remaining)) {
                result.add(listOf(item) + p)
            }
        }
        return result
    }
}
