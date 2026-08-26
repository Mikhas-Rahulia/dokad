import {
  generateRandomSpotsInRadius,
  solveOptimalRoute,
  checkProximity
} from './geometry.js';

const STORAGE_KEY_DAILY = 'dokad_daily_state_v2';
const STORAGE_KEY_STREAK = 'dokad_streak_stats_v2';

export class StreakService {
  constructor() {
    this.todayStr = this.getTodayDateString();
  }

  getTodayDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.getTodayDateString(d);
  }

  /**
   * Loads streak stats and validates streak continuity.
   * @returns {{currentStreak: number, lastCompletedDate: string|null, totalCompletedDays: number}}
   */
  getStreakStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STREAK);
      if (!raw) {
        return { currentStreak: 0, lastCompletedDate: null, totalCompletedDays: 0 };
      }
      const stats = JSON.parse(raw);
      const today = this.getTodayDateString();
      const yesterday = this.getYesterdayDateString();

      // Check if streak was broken (last completed is older than yesterday)
      if (stats.lastCompletedDate && stats.lastCompletedDate !== today && stats.lastCompletedDate !== yesterday) {
        stats.currentStreak = 0;
        this.saveStreakStats(stats);
      }

      return stats;
    } catch {
      return { currentStreak: 0, lastCompletedDate: null, totalCompletedDays: 0 };
    }
  }

  saveStreakStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save streak stats', e);
    }
  }

  /**
   * Loads or returns current daily state for today.
   * @returns {Object|null}
   */
  getDailyState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DAILY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (state.date === this.getTodayDateString()) {
        return state;
      }
      // Outdated day state
      return null;
    } catch {
      return null;
    }
  }

  saveDailyState(state) {
    try {
      localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save daily state', e);
    }
  }

  /**
   * Creates a new set of 3 daily spots within 2 km of origin and solves optimal path.
   * @param {{lat: number, lng: number}} origin
   * @returns {Object}
   */
  initDailySpots(origin) {
    const rawSpots = generateRandomSpotsInRadius(origin.lat, origin.lng, 2.0, 3, 150);
    const { orderedSpots, totalDistanceKm, legs } = solveOptimalRoute(origin, rawSpots);

    const spotsWithStatus = orderedSpots.map((spot, idx) => ({
      ...spot,
      step: idx + 1,
      checkedIn: false,
      checkedInAt: null
    }));

    const dailyState = {
      date: this.getTodayDateString(),
      origin: { lat: origin.lat, lng: origin.lng },
      spots: spotsWithStatus,
      totalDistanceKm,
      legs,
      completed: false
    };

    this.saveDailyState(dailyState);
    return dailyState;
  }

  /**
   * Attempts to check in at a spot if within 100m proximity.
   * @param {number} spotIndex (0, 1, or 2)
   * @param {{lat: number, lng: number}} userLocation
   * @returns {{success: boolean, message: string, distanceMeters: number, spot?: Object, allCompleted?: boolean, streak?: number}}
   */
  checkInSpot(spotIndex, userLocation) {
    const state = this.getDailyState();
    if (!state || !state.spots || !state.spots[spotIndex]) {
      return { success: false, message: 'No active spot found', distanceMeters: Infinity };
    }

    const spot = state.spots[spotIndex];
    if (spot.checkedIn) {
      return { success: true, message: 'Already checked in!', distanceMeters: 0, spot, allCompleted: state.completed };
    }

    const prox = checkProximity(userLocation.lat, userLocation.lng, spot.lat, spot.lng, 100);
    if (!prox.inRange) {
      return {
        success: false,
        message: `Too far (${prox.distanceMeters} m). Get within 100 m to check in!`,
        distanceMeters: prox.distanceMeters
      };
    }

    // Mark checked in!
    spot.checkedIn = true;
    spot.checkedInAt = new Date().toISOString();

    // Check if all 3 spots are checked in
    const allDone = state.spots.every(s => s.checkedIn);
    let streakCount = this.getStreakStats().currentStreak;

    if (allDone && !state.completed) {
      state.completed = true;
      const stats = this.getStreakStats();
      const today = this.getTodayDateString();
      const yesterday = this.getYesterdayDateString();

      if (stats.lastCompletedDate !== today) {
        if (stats.lastCompletedDate === yesterday) {
          stats.currentStreak += 1;
        } else {
          stats.currentStreak = 1;
        }
        stats.lastCompletedDate = today;
        stats.totalCompletedDays = (stats.totalCompletedDays || 0) + 1;
        this.saveStreakStats(stats);
      }
      streakCount = stats.currentStreak;
    }

    this.saveDailyState(state);

    return {
      success: true,
      message: allDone ? '🎉 ALL 3 SPOTS COMPLETED! STREAK INCREASED!' : `✅ SPOT ${spot.step} CHECKED IN!`,
      distanceMeters: prox.distanceMeters,
      spot,
      allCompleted: allDone,
      streak: streakCount
    };
  }
}
