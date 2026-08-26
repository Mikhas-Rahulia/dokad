package com.example.dokad.ui.calendar

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.dokad.data.WalkRepository
import com.example.dokad.model.PhotoMemory
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun MemoriesCalendarView(
    repository: WalkRepository,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    var calendarMonth by remember { mutableStateOf(Calendar.getInstance()) }
    val streakStats = remember { repository.getStreakStats() }
    val completedDates = streakStats.completedDates.toSet()

    val monthFormat = SimpleDateFormat("MMMM yyyy", Locale.US)
    val dayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    var selectedDateStr by remember { mutableStateOf(repository.getTodayDateString()) }
    var dayMemories by remember { mutableStateOf<List<PhotoMemory>>(emptyList()) }

    LaunchedEffect(selectedDateStr) {
        dayMemories = repository.getMemoriesForDate(selectedDateStr)
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = Color(0xFF0C0F17)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = {
                        val cal = calendarMonth.clone() as Calendar
                        cal.add(Calendar.MONTH, -1)
                        calendarMonth = cal
                    }) {
                        Text("◀", color = Color(0xFFFACC15), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }

                    Text(
                        text = monthFormat.format(calendarMonth.time).uppercase(),
                        color = Color(0xFFFACC15),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )

                    IconButton(onClick = {
                        val cal = calendarMonth.clone() as Calendar
                        cal.add(Calendar.MONTH, 1)
                        calendarMonth = cal
                    }) {
                        Text("▶", color = Color(0xFFFACC15), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }

                IconButton(
                    onClick = onClose,
                    modifier = Modifier
                        .background(Color(0xFFEF4444), shape = CircleShape)
                        .border(2.dp, Color.Black, CircleShape)
                        .size(36.dp)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Weekday Headers
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                listOf("MO", "TU", "WE", "TH", "FR", "SA", "SU").forEach {
                    Text(text = it, color = Color(0xFF94A3B8), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Days Matrix
            val cal = calendarMonth.clone() as Calendar
            cal.set(Calendar.DAY_OF_MONTH, 1)
            val firstDayOfWeek = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7 // Monday = 0
            val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)

            val totalCells = ((firstDayOfWeek + daysInMonth + 6) / 7) * 7

            Column(modifier = Modifier.fillMaxWidth()) {
                for (row in 0 until totalCells / 7) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        for (col in 0 until 7) {
                            val cellIndex = row * 7 + col
                            val dayNum = cellIndex - firstDayOfWeek + 1

                            if (dayNum in 1..daysInMonth) {
                                val cellCal = calendarMonth.clone() as Calendar
                                cellCal.set(Calendar.DAY_OF_MONTH, dayNum)
                                val dateStr = dayFormat.format(cellCal.time)
                                val isCompleted = completedDates.contains(dateStr)
                                val isSelected = dateStr == selectedDateStr

                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .background(
                                            if (isCompleted) Color(0xFF11281C) else Color(0xFF182235)
                                        )
                                        .border(
                                            width = if (isSelected) 2.dp else 1.dp,
                                            color = if (isSelected) Color(0xFFFACC15) else if (isCompleted) Color(0xFF22C55E) else Color.Black
                                        )
                                        .clickable { selectedDateStr = dateStr },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(
                                            text = "$dayNum",
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        if (isCompleted) {
                                            Text(text = "🔥", fontSize = 10.sp)
                                        }
                                    }
                                }
                            } else {
                                Spacer(modifier = Modifier.size(42.dp))
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Day Memories Section
            Surface(
                modifier = Modifier.fillMaxWidth().weight(1f),
                color = Color(0xFF141B29),
                border = BorderStroke(2.dp, Color.Black)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "📅 MEMORIES: $selectedDateStr",
                        color = Color(0xFFFACC15),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    if (dayMemories.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "📷 No verified photos taken on this date.",
                                color = Color(0xFF94A3B8),
                                fontSize = 13.sp
                            )
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(dayMemories) { memory ->
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color.Black),
                                    border = BorderStroke(2.dp, Color.Black),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .aspectRatio(4f / 3f)
                                        ) {
                                            AsyncImage(
                                                model = File(memory.photoPath),
                                                contentDescription = "Spot #${memory.step}",
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                            Surface(
                                                color = Color.Black.copy(alpha = 0.75f),
                                                border = BorderStroke(1.dp, Color(0xFFFACC15)),
                                                modifier = Modifier
                                                    .padding(8.dp)
                                                    .align(Alignment.TopStart)
                                            ) {
                                                Text(
                                                    text = "SPOT #${memory.step}",
                                                    color = Color(0xFFFACC15),
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .background(Color(0xFF182235))
                                                .padding(horizontal = 10.dp, vertical = 6.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(text = "⏰ ${memory.timestamp}", color = Color(0xFFCBD5E1), fontSize = 12.sp)
                                            Text(text = "✅ VERIFIED", color = Color(0xFF22C55E), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
