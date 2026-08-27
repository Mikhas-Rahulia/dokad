import {
  generate3SpotsInCity,
  generateRandomSpotsInRadius,
  solveOptimalRoute,
  checkProximity
} from './geometry.js';
import { photoStorage } from './photoStorage.js';

const STORAGE_KEY_DAILY = 'dokad_daily_state_v5';
const STORAGE_KEY_STREAK = 'dokad_streak_stats_v5';
const MAX_SHUFFLES_PER_DAY = 1;

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

  getStreakStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STREAK);
      if (!raw) {
        return { currentStreak: 0, lastCompletedDate: null, totalCompletedDays: 0, completedDates: [] };
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
      return { currentStreak: 0, lastCompletedDate: null, totalCompletedDays: 0, completedDates: [] };
    }
  }

  saveStreakStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save streak stats', e);
    }
  }

  getDailyState(cityId = null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DAILY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (state.date === this.getTodayDateString()) {
        if (!cityId || state.cityId === cityId) {
          return state;
        }
      }
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
   * Checks if user can still shuffle today (max 1 shuffle per day).
   * @returns {boolean}
   */
  canShuffleToday() {
    const state = this.getDailyState();
    if (!state) return true;
    const used = state.shufflesUsed || 0;
    return used < MAX_SHUFFLES_PER_DAY;
  }

  /**
   * Returns remaining shuffles today (0 or 1).
   * @returns {number}
   */
  getShufflesRemaining() {
    const state = this.getDailyState();
    if (!state) return MAX_SHUFFLES_PER_DAY;
    const used = state.shufflesUsed || 0;
    return Math.max(0, MAX_SHUFFLES_PER_DAY - used);
  }

  /**
   * Initializes 3 daily spots strictly inside city boundary or within 2 km radius.
   * Enforces max 1 shuffle per day.
   * @param {{lat: number, lng: number}} origin
   * @param {Object|null} city
   * @param {boolean} isShuffle
   * @returns {Object}
   */
  initDailySpots(origin, city = null, isShuffle = false) {
    const existing = this.getDailyState();
    let shufflesUsed = existing ? (existing.shufflesUsed || 0) : 0;

    if (isShuffle) {
      if (shufflesUsed >= MAX_SHUFFLES_PER_DAY) {
        throw new Error('MAX_SHUFFLES_REACHED');
      }
      shufflesUsed += 1;
    }

    let rawSpots = [];
    if (city && city.geojson) {
      rawSpots = generate3SpotsInCity(city.geojson, 3);
    } else {
      rawSpots = generateRandomSpotsInRadius(origin.lat, origin.lng, 2.0, 3, 150);
    }

    const { orderedSpots, totalDistanceKm, legs } = solveOptimalRoute(origin, rawSpots);

    const spotsWithStatus = orderedSpots.map((spot, idx) => ({
      ...spot,
      step: idx + 1,
      checkedIn: false,
      checkedInAt: null,
      photoTaken: false
    }));

    const dailyState = {
      date: this.getTodayDateString(),
      cityId: city ? city.id : 'local_2km',
      cityName: city ? (city.nativeName || city.name) : 'Nearby 2 km',
      origin: { lat: origin.lat, lng: origin.lng },
      spots: spotsWithStatus,
      totalDistanceKm,
      legs,
      shufflesUsed,
      maxShuffles: MAX_SHUFFLES_PER_DAY,
      completed: false
    };

    this.saveDailyState(dailyState);
    return dailyState;
  }

  /**
   * Verifies arrival at a spot with 21m proximity check and photo submission.
   * @param {number} spotIndex
   * @param {{lat: number, lng: number}} userLocation
   * @param {string} photoDataUrl
   * @returns {Promise<{success: boolean, message: string, distanceMeters: number, spot?: Object, allCompleted?: boolean, streak?: number}>}
   */
  async verifySpotWithPhoto(spotIndex, userLocation, photoDataUrl) {
    const state = this.getDailyState();
    if (!state || !state.spots || !state.spots[spotIndex]) {
      return { success: false, message: 'No active spot found', distanceMeters: Infinity };
    }

    const spot = state.spots[spotIndex];
    if (spot.checkedIn) {
      return { success: true, message: 'Already verified!', distanceMeters: 0, spot, allCompleted: state.completed };
    }

    const prox = checkProximity(userLocation.lat, userLocation.lng, spot.lat, spot.lng, 21);
    if (!prox.inRange) {
      return {
        success: false,
        message: `Too far (${prox.distanceMeters} m). Get within 21 m to take photo!`,
        distanceMeters: prox.distanceMeters
      };
    }

    // Save photo to IndexedDB / OPFS
    try {
      await photoStorage.savePhoto(state.date, spotIndex, photoDataUrl, {
        lat: spot.lat,
        lng: spot.lng,
        step: spot.step,
        cityName: state.cityName,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Photo save error:', err);
    }

    spot.checkedIn = true;
    spot.photoTaken = true;
    spot.checkedInAt = new Date().toISOString();

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
        stats.completedDates = stats.completedDates || [];
        if (!stats.completedDates.includes(today)) {
          stats.completedDates.push(today);
        }
        this.saveStreakStats(stats);
      }
      streakCount = stats.currentStreak;
    }

    this.saveDailyState(state);

    return {
      success: true,
      message: allDone ? '🎉 ALL 3 DESTINATIONS VERIFIED! STREAK INCREASED!' : `📸 SPOT ${spot.step} PHOTO VERIFIED!`,
      distanceMeters: prox.distanceMeters,
      spot,
      allCompleted: allDone,
      streak: streakCount
    };
  }
}
