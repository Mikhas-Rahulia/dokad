package com.example.dokad.ui.main

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dokad.geo.GeoUtils
import com.example.dokad.model.GeoPoint
import com.example.dokad.ui.calendar.MemoriesCalendarView
import com.example.dokad.ui.camera.CameraCaptureView
import com.example.dokad.ui.map.InteractiveMapCanvas

@Composable
fun MainScreen(
    viewModel: MainScreenViewModel,
    onTriggerBiometrics: () -> Unit
) {
    val context = LocalContext.current

    val userLocation by viewModel.userLocation.collectAsState()
    val dailyWalk by viewModel.dailyWalk.collectAsState()
    val streakStats by viewModel.streakStats.collectAsState()
    val isUnlocked by viewModel.isUnlocked.collectAsState()
    val activeCameraSpot by viewModel.activeCameraSpot.collectAsState()
    val isCalendarOpen by viewModel.isCalendarOpen.collectAsState()
    val toastMessage by viewModel.toastMessage.collectAsState()

    // Trigger toast notification
    LaunchedEffect(toastMessage) {
        if (toastMessage != null) {
            kotlinx.coroutines.delay(2600)
            viewModel.clearToast()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0C0F17))
    ) {
        // Native Interactive Canvas Map
        InteractiveMapCanvas(
            userLocation = userLocation,
            spots = dailyWalk?.spots ?: emptyList(),
            modifier = Modifier.fillMaxSize()
        )

        // Scanline CRT Overlay
        Canvas(modifier = Modifier.fillMaxSize()) {
            val step = 4.dp.toPx()
            var y = 0f
            while (y < size.height) {
                drawLine(
                    color = Color.Black.copy(alpha = 0.08f),
                    start = androidx.compose.ui.geometry.Offset(0f, y),
                    end = androidx.compose.ui.geometry.Offset(size.width, y),
                    strokeWidth = 1.dp.toPx()
                )
                y += step
            }
        }

        // Top Floating Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Brand Badge
            Surface(
                color = Color(0xFF182235),
                border = BorderStroke(2.dp, Color.Black),
                shadowElevation = 4.dp
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(text = "🕹️ DOKĄD? ", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                    Surface(color = Color(0xFF6366F1), border = BorderStroke(1.dp, Color.Black)) {
                        Text(text = "2 KM", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                    }
                }
            }

            // Right Group: Memories Calendar + Streak Badge
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                // Calendar Button
                Surface(
                    onClick = { viewModel.openCalendar() },
                    color = Color(0xFF182235),
                    border = BorderStroke(2.dp, Color.Black),
                    shadowElevation = 4.dp
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(text = "📅 ", fontSize = 12.sp)
                        Text(text = "MEMORIES", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                // Streak Badge
                Surface(
                    color = Color(0xFFFB923C),
                    border = BorderStroke(2.dp, Color.Black),
                    shadowElevation = 3.dp
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                    ) {
                        Text(text = "🔥 ", fontSize = 12.sp)
                        Text(text = "${streakStats.currentStreak}", color = Color.Black, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }
        }

        // Bottom Action Drawer
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(14.dp)
        ) {
            val walk = dailyWalk

            if (walk == null) {
                // Initial 1-Click Start Card
                Surface(
                    color = Color(0xFF182235),
                    border = BorderStroke(3.dp, Color.Black),
                    shadowElevation = 6.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "🎯 TODAY'S 3 WALK DESTINATIONS",
                            color = Color(0xFFFACC15),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "1 click to generate 3 secret spots within 2 km. Arrive within 21 m and take a verification photo to keep your streak!",
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )

                        Button(
                            onClick = { viewModel.generateDailyWalk() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFACC15)),
                            shape = RoundedCornerShape(0.dp),
                            border = BorderStroke(3.dp, Color.Black),
                            modifier = Modifier.fillMaxWidth().height(52.dp)
                        ) {
                            Text(
                                text = "🎲 START TODAY'S 3-SPOT WALK",
                                color = Color.Black,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            } else {
                // Active 3-Spot Tour Card
                Surface(
                    color = Color(0xFF182235),
                    border = BorderStroke(3.dp, Color.Black),
                    shadowElevation = 6.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Status Row
                        val completedCount = walk.spots.count { it.isCheckedIn }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                color = if (completedCount == 3) Color(0xFF22C55E) else Color(0xFF6366F1),
                                border = BorderStroke(2.dp, Color.Black)
                            ) {
                                Text(
                                    text = "$completedCount/3 COMPLETED",
                                    color = if (completedCount == 3) Color.Black else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }

                            Surface(
                                color = Color(0xFF141B29),
                                border = BorderStroke(2.dp, Color.Black)
                            ) {
                                Text(
                                    text = "🚶 ${GeoUtils.formatDistance(walk.totalDistanceKm)} ROUTE",
                                    color = Color(0xFFCBD5E1),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        // 3 Spots List
                        walk.spots.forEachIndexed { idx, spot ->
                            val dist = userLocation?.let {
                                GeoUtils.calculateDistanceMeters(it, GeoPoint(spot.lat, spot.lng))
                            } ?: Double.MAX_VALUE
                            val inRange = dist <= 21.0

                            Surface(
                                color = if (spot.isCheckedIn) Color(0xFF11281C) else if (inRange) Color(0xFF242C16) else Color(0xFF141B29),
                                border = BorderStroke(2.dp, if (spot.isCheckedIn) Color(0xFF22C55E) else if (inRange) Color(0xFFFACC15) else Color.Black),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Surface(
                                            color = if (spot.isCheckedIn) Color(0xFF22C55E) else Color(0xFF6366F1),
                                            border = BorderStroke(1.dp, Color.Black),
                                            modifier = Modifier.size(24.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Text(
                                                    text = if (spot.isCheckedIn) "✔" else "${spot.step}",
                                                    color = if (spot.isCheckedIn) Color.Black else Color.White,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }

                                        Column {
                                            Text(text = "SPOT ${spot.step}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                            Text(
                                                text = if (spot.isCheckedIn) "✅ PHOTO VERIFIED" else if (userLocation != null) "📍 ${GeoUtils.formatDistance(dist / 1000.0)} away" else "📍 Waiting for GPS...",
                                                color = if (spot.isCheckedIn) Color(0xFF22C55E) else Color(0xFF94A3B8),
                                                fontSize = 11.sp
                                            )
                                        }
                                    }

                                    if (spot.isCheckedIn) {
                                        Text(text = "VERIFIED", color = Color(0xFF22C55E), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    } else {
                                        Button(
                                            onClick = { viewModel.promptVerification(idx) },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (inRange) Color(0xFFFACC15) else Color(0xFF182235)
                                            ),
                                            shape = RoundedCornerShape(0.dp),
                                            border = BorderStroke(2.dp, Color.Black),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                            modifier = Modifier.height(34.dp)
                                        ) {
                                            Text(
                                                text = if (inRange) "📸 TAKE PHOTO" else "VERIFY",
                                                color = if (inRange) Color.Black else Color(0xFFCBD5E1),
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Navigation Actions
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            // Google Maps Walking Navigation Intent
                            Button(
                                onClick = {
                                    val destination = walk.spots.lastOrNull()
                                    if (destination != null) {
                                        val waypointsStr = walk.spots.dropLast(1).joinToString("|") { "${it.lat},${it.lng}" }
                                        val originStr = userLocation?.let { "${it.lat},${it.lng}" } ?: "${walk.origin.lat},${walk.origin.lng}"
                                        val gmapsUri = Uri.parse("https://www.google.com/maps/dir/?api=1&origin=$originStr&destination=${destination.lat},${destination.lng}&waypoints=$waypointsStr&travelmode=walking")
                                        context.startActivity(Intent(Intent.ACTION_VIEW, gmapsUri))
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E)),
                                shape = RoundedCornerShape(0.dp),
                                border = BorderStroke(2.dp, Color.Black),
                                modifier = Modifier.weight(2f).height(44.dp)
                            ) {
                                Text(text = "🗺️ GOOGLE MAPS", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                            }

                            // Reroll Daily Spots
                            Button(
                                onClick = { viewModel.generateDailyWalk() },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF141B29)),
                                shape = RoundedCornerShape(0.dp),
                                border = BorderStroke(2.dp, Color.Black),
                                modifier = Modifier.weight(1f).height(44.dp)
                            ) {
                                Text(text = "🎲 REROLL", color = Color(0xFFCBD5E1), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Passkey / Biometric Lock Screen Overlay
        if (!isUnlocked) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color(0xFF0C0F17).copy(alpha = 0.96f)
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(20.dp)) {
                    Surface(
                        color = Color(0xFF182235),
                        border = BorderStroke(3.dp, Color.Black),
                        shadowElevation = 8.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Text(text = "🕹️", fontSize = 38.sp)
                            Text(
                                text = "DOKĄD? PRIVATE",
                                color = Color(0xFFFACC15),
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Text(
                                text = "Passkey & Biometric Protection",
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )

                            Button(
                                onClick = onTriggerBiometrics,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFACC15)),
                                shape = RoundedCornerShape(0.dp),
                                border = BorderStroke(2.dp, Color.Black),
                                modifier = Modifier.fillMaxWidth().height(48.dp)
                            ) {
                                Text(
                                    text = "👆 UNLOCK WITH PASSKEY",
                                    color = Color.Black,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        // Camera Viewfinder Modal
        activeCameraSpot?.let { spot ->
            CameraCaptureView(
                spotStep = spot.step,
                onPhotoCaptured = { bmp -> viewModel.onPhotoCaptured(bmp) },
                onClose = { viewModel.closeCamera() }
            )
        }

        // Memories Calendar Modal
        if (isCalendarOpen) {
            MemoriesCalendarView(
                repository = viewModel.repository,
                onClose = { viewModel.closeCalendar() }
            )
        }

        // Pixel Toast Notification
        toastMessage?.let { msg ->
            Surface(
                color = Color(0xFF182235),
                border = BorderStroke(2.dp, Color.Black),
                shadowElevation = 6.dp,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .statusBarsPadding()
                    .padding(top = 64.dp)
            ) {
                Text(
                    text = msg,
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                )
            }
        }
    }
}
