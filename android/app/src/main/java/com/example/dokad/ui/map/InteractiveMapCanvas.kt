package com.example.dokad.ui.map

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.example.dokad.model.GeoPoint
import com.example.dokad.model.WalkSpot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL
import kotlin.math.*

private val tileCache = mutableMapOf<String, ImageBitmap>()

@Composable
fun InteractiveMapCanvas(
    userLocation: GeoPoint?,
    spots: List<WalkSpot>,
    modifier: Modifier = Modifier
) {
    val centerPoint = userLocation ?: (spots.firstOrNull()?.let { GeoPoint(it.lat, it.lng) } ?: GeoPoint(50.0647, 19.9450))

    var zoom by remember { mutableFloatStateOf(15.5f) }
    var panOffset by remember { mutableStateOf(Offset.Zero) }

    // Pulsing animation for user beacon and 21m arrival zone
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1.8f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pulseScale"
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pulseAlpha"
    )

    // Load visible map tiles asynchronously
    val currentIntZoom = zoom.toInt().coerceIn(12, 18)
    var loadedTiles by remember { mutableStateOf<Map<String, ImageBitmap>>(emptyMap()) }

    LaunchedEffect(centerPoint, currentIntZoom, panOffset) {
        withContext(Dispatchers.IO) {
            val centerTileX = lon2tile(centerPoint.lng, currentIntZoom)
            val centerTileY = lat2tile(centerPoint.lat, currentIntZoom)

            val newTiles = mutableMapOf<String, ImageBitmap>()
            for (dx in -2..2) {
                for (dy in -2..2) {
                    val tx = centerTileX + dx
                    val ty = centerTileY + dy
                    val key = "$currentIntZoom/$tx/$ty"

                    val cached = tileCache[key]
                    if (cached != null) {
                        newTiles[key] = cached
                    } else {
                        try {
                            val url = URL("https://tile.openstreetmap.org/$currentIntZoom/$tx/$ty.png")
                            val connection = url.openConnection()
                            connection.setRequestProperty("User-Agent", "DokadNativeApp/1.0")
                            val stream = connection.getInputStream()
                            val bmp = BitmapFactory.decodeStream(stream)
                            if (bmp != null) {
                                val imgBmp = bmp.asImageBitmap()
                                tileCache[key] = imgBmp
                                newTiles[key] = imgBmp
                            }
                        } catch (_: Exception) {}
                    }
                }
            }
            loadedTiles = newTiles
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0C0F17))
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, gestureZoom, _ ->
                    zoom = (zoom * gestureZoom).coerceIn(13f, 18.5f)
                    panOffset += pan
                }
            }
    ) {
        val canvasWidth = size.width
        val canvasHeight = size.height
        val centerCanvas = Offset(canvasWidth / 2f, canvasHeight / 2f) + panOffset

        val tileSize = 256f * (2f.pow(zoom - currentIntZoom))
        val centerTileX = lon2tileDouble(centerPoint.lng, currentIntZoom)
        val centerTileY = lat2tileDouble(centerPoint.lat, currentIntZoom)

        // Draw Map Tiles with Cyberpunk / Dark Mode Color Filter
        val darkColorMatrix = ColorMatrix(
            floatArrayOf(
                -0.65f, 0f, 0f, 0f, 215f,
                0f, -0.65f, 0f, 0f, 215f,
                0f, 0f, -0.55f, 0f, 225f,
                0f, 0f, 0f, 1f, 0f
            )
        )
        val tilePaint = Paint().apply {
            colorFilter = ColorFilter.colorMatrix(darkColorMatrix)
        }

        loadedTiles.forEach { (key, tileImg) ->
            val parts = key.split("/")
            if (parts.size == 3 && parts[0].toInt() == currentIntZoom) {
                val tx = parts[1].toInt()
                val ty = parts[2].toInt()

                val screenX = centerCanvas.x + (tx - centerTileX.toFloat()) * tileSize
                val screenY = centerCanvas.y + (ty - centerTileY.toFloat()) * tileSize

                drawImage(
                    image = tileImg,
                    dstOffset = androidx.compose.ui.unit.IntOffset(screenX.toInt(), screenY.toInt()),
                    dstSize = androidx.compose.ui.unit.IntSize(tileSize.toInt() + 1, tileSize.toInt() + 1),
                    colorFilter = ColorFilter.colorMatrix(darkColorMatrix)
                )
            }
        }

        // Helper to convert GeoPoint to Canvas Offset
        fun geoToOffset(p: GeoPoint): Offset {
            val tx = lon2tileDouble(p.lng, currentIntZoom).toFloat()
            val ty = lat2tileDouble(p.lat, currentIntZoom).toFloat()
            val sx = centerCanvas.x + (tx - centerTileX.toFloat()) * tileSize
            val sy = centerCanvas.y + (ty - centerTileY.toFloat()) * tileSize
            return Offset(sx, sy)
        }

        // Draw Connected Route Polyline
        if (spots.isNotEmpty()) {
            val routePoints = mutableListOf<Offset>()
            if (userLocation != null) routePoints.add(geoToOffset(userLocation))
            spots.forEach { spot -> routePoints.add(geoToOffset(GeoPoint(spot.lat, spot.lng))) }

            val path = Path()
            routePoints.forEachIndexed { idx, pt ->
                if (idx == 0) path.moveTo(pt.x, pt.y) else path.lineTo(pt.x, pt.y)
            }

            drawPath(
                path = path,
                color = Color(0xFF6366F1),
                style = Stroke(
                    width = 6f,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(20f, 12f), 0f)
                )
            )
        }

        // Draw Numbered Spot Pins & 21m Proximity Circles
        spots.forEach { spot ->
            val spotOffset = geoToOffset(GeoPoint(spot.lat, spot.lng))
            val isDone = spot.isCheckedIn

            // 21-meter Proximity Zone Circle
            // 1 meter in pixels at current zoom
            val metersPerPixel = (156543.03392 * cos(Math.toRadians(spot.lat)) / 2.0.pow(zoom.toDouble())).toFloat()
            val radius21mPixels = (21f / metersPerPixel).coerceIn(16f, 120f)

            drawCircle(
                color = if (isDone) Color(0xFF22C55E).copy(alpha = 0.25f) else Color(0xFFFACC15).copy(alpha = 0.2f),
                radius = radius21mPixels,
                center = spotOffset
            )
            drawCircle(
                color = if (isDone) Color(0xFF22C55E) else Color(0xFFFACC15),
                radius = radius21mPixels,
                center = spotOffset,
                style = Stroke(width = 3f)
            )

            // Pin Badge Box (Retro Pixel Box)
            val boxSize = 40f
            val pinRect = androidx.compose.ui.geometry.Rect(
                spotOffset.x - boxSize / 2,
                spotOffset.y - boxSize / 2,
                spotOffset.x + boxSize / 2,
                spotOffset.y + boxSize / 2
            )

            // Box shadow
            drawRect(
                color = Color.Black,
                topLeft = Offset(pinRect.left + 4f, pinRect.top + 4f),
                size = androidx.compose.ui.geometry.Size(boxSize, boxSize)
            )
            // Box body
            drawRect(
                color = if (isDone) Color(0xFF22C55E) else Color(0xFFFACC15),
                topLeft = Offset(pinRect.left, pinRect.top),
                size = androidx.compose.ui.geometry.Size(boxSize, boxSize)
            )
            // Box border
            drawRect(
                color = Color.Black,
                topLeft = Offset(pinRect.left, pinRect.top),
                size = androidx.compose.ui.geometry.Size(boxSize, boxSize),
                style = Stroke(width = 4f)
            )
        }

        // Draw Live User GPS Beacon
        if (userLocation != null) {
            val userOffset = geoToOffset(userLocation)

            // Animated radar wave
            drawCircle(
                color = Color(0xFF38BDF8).copy(alpha = pulseAlpha),
                radius = 35f * pulseScale,
                center = userOffset,
                style = Stroke(width = 3f)
            )

            // Solid inner dot
            drawCircle(
                color = Color.White,
                radius = 12f,
                center = userOffset
            )
            drawCircle(
                color = Color(0xFF38BDF8),
                radius = 9f,
                center = userOffset
            )
        }
    }
}

private fun lon2tile(lon: Double, zoom: Int): Int =
    ((lon + 180.0) / 360.0 * (1 shl zoom)).toInt()

private fun lat2tile(lat: Double, zoom: Int): Int =
    ((1.0 - asinh(tan(Math.toRadians(lat))) / PI) / 2.0 * (1 shl zoom)).toInt()

private fun lon2tileDouble(lon: Double, zoom: Int): Double =
    (lon + 180.0) / 360.0 * (1 shl zoom)

private fun lat2tileDouble(lat: Double, zoom: Int): Double =
    (1.0 - asinh(tan(Math.toRadians(lat))) / PI) / 2.0 * (1 shl zoom)
