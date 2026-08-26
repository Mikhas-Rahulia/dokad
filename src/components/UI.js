import confetti from 'canvas-confetti';
import { StreakService } from '../geo/streakService.js';
import { PasskeyAuth } from './PasskeyAuth.js';
import { CameraModal } from './CameraModal.js';
import { CalendarModal } from './CalendarModal.js';
import {
  formatDistance,
  checkProximity,
  getGoogleMapsOptimalRouteUrl
} from '../geo/geometry.js';

export class AppUI {
  constructor({ mapController }) {
    this.map = mapController;
    this.streakService = new StreakService();

    this.userLocation = null;
    this.dailyState = null;
    this.watchId = null;

    this.cacheElements();
    this.initComponents();
    this.bindEvents();
    this.updateStreakBadge();
    this.initGeolocation();
    this.loadTodayTour();
  }

  cacheElements() {
    // Header
    this.streakCountEl = document.getElementById('streak-count');
    this.btnLocateMe = document.getElementById('btn-locate-me');
    this.btnOpenCalendar = document.getElementById('btn-open-calendar');

    // Cards
    this.initialCard = document.getElementById('initial-card');
    this.btnGenerateDaily = document.getElementById('btn-generate-daily');

    this.tourCard = document.getElementById('tour-card');
    this.tourProgressBadge = document.getElementById('tour-progress-badge');
    this.tourDistanceBadge = document.getElementById('tour-distance-badge');
    this.spotsList = document.getElementById('spots-list');
    this.btnGoogleRoute = document.getElementById('btn-google-route');
    this.btnRerollDaily = document.getElementById('btn-reroll-daily');

    // Toast
    this.toast = document.getElementById('toast');
  }

  initComponents() {
    this.cameraModal = new CameraModal();
    this.calendarModal = new CalendarModal(this.streakService);
    this.passkeyAuth = new PasskeyAuth(() => {
      this.showToast('🔓 DOKĄD UNLOCKED');
      if (this.userLocation) {
        this.map.recenterUser();
      }
    });
  }

  bindEvents() {
    // Locate GPS
    this.btnLocateMe.addEventListener('click', () => this.centerOnUser());

    // Open Calendar Memories
    this.btnOpenCalendar.addEventListener('click', () => this.calendarModal.open());

    // Generate & Reroll 3 daily spots
    this.btnGenerateDaily.addEventListener('click', () => this.generateDailyTour());
    this.btnRerollDaily.addEventListener('click', () => this.generateDailyTour(true));
  }

  initGeolocation() {
    if (!navigator.geolocation) {
      this.showToast('⚠️ GPS NOT AVAILABLE');
      return;
    }

    const onPos = (pos) => {
      this.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng);
      this.updateSpotsLiveDistances();
    };

    const onErr = (err) => {
      console.warn('GPS error:', err.message);
    };

    navigator.geolocation.getCurrentPosition(onPos, onErr, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 10000
    });

    this.watchId = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000
    });
  }

  centerOnUser() {
    if (this.userLocation) {
      this.map.recenterUser();
    } else {
      this.showToast('📍 LOCATING GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng);
          this.map.recenterUser();
        },
        () => this.showToast('⚠️ GPS ACCESS REQUIRED')
      );
    }
  }

  updateStreakBadge() {
    const stats = this.streakService.getStreakStats();
    this.streakCountEl.textContent = stats.currentStreak || 0;
  }

  loadTodayTour() {
    const state = this.streakService.getDailyState();
    if (state && state.spots && state.spots.length === 3) {
      this.dailyState = state;
      this.renderTourUI();
      this.map.renderDailySpotsAndRoute(state.origin, state.spots, (idx) => this.promptPhotoVerification(idx));
    } else {
      this.initialCard.style.display = 'flex';
      this.tourCard.style.display = 'none';
    }
  }

  generateDailyTour(isReroll = false) {
    const origin = this.userLocation || { lat: 50.0647, lng: 19.9450 }; // Fallback Krakow center if GPS not yet ready

    this.dailyState = this.streakService.initDailySpots(origin);

    this.map.renderDailySpotsAndRoute(origin, this.dailyState.spots, (idx) => this.promptPhotoVerification(idx));
    this.renderTourUI();

    if ('vibrate' in navigator) navigator.vibrate([20, 35, 20]);
    this.triggerConfetti();

    this.showToast(isReroll ? '🎲 3 NEW SPOTS GENERATED!' : "🎯 TODAY'S 3 DESTINATIONS READY!");
  }

  renderTourUI() {
    if (!this.dailyState) return;

    this.initialCard.style.display = 'none';
    this.tourCard.style.display = 'flex';

    const spots = this.dailyState.spots;
    const completedCount = spots.filter(s => s.checkedIn).length;
    const totalDistStr = formatDistance(this.dailyState.totalDistanceKm);

    this.tourProgressBadge.textContent = `${completedCount}/3 COMPLETED`;
    this.tourProgressBadge.className = `pixel-badge progress-badge ${completedCount === 3 ? 'all-done' : ''}`;
    this.tourDistanceBadge.textContent = `🚶 ${totalDistStr} ROUTE`;

    this.spotsList.innerHTML = '';

    spots.forEach((spot, idx) => {
      const isCheckedIn = !!spot.checkedIn;
      let distText = '—';
      let inProximity = false;

      if (this.userLocation) {
        const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
        distText = formatDistance(prox.distanceKm);
        inProximity = prox.inRange;
      }

      const item = document.createElement('div');
      item.className = `spot-item ${isCheckedIn ? 'done' : inProximity ? 'in-range' : ''}`;
      item.innerHTML = `
        <div class="spot-item-left">
          <span class="spot-number-badge ${isCheckedIn ? 'done' : ''}">${isCheckedIn ? '✔' : spot.step}</span>
          <div class="spot-details">
            <div class="spot-title">SPOT ${spot.step}</div>
            <div class="spot-distance" id="spot-dist-${idx}">
              ${isCheckedIn ? '✅ PHOTO VERIFIED' : `📍 ${distText} away`}
            </div>
          </div>
        </div>
        <div class="spot-item-right">
          ${
            isCheckedIn
              ? `<span class="badge-checked">VERIFIED</span>`
              : `<button class="pixel-btn pixel-btn-checkin ${inProximity ? 'ready' : ''}" data-idx="${idx}">
                   ${inProximity ? '📸 TAKE PHOTO' : 'VERIFY'}
                 </button>`
          }
        </div>
      `;

      const checkInBtn = item.querySelector('.pixel-btn-checkin');
      if (checkInBtn) {
        checkInBtn.addEventListener('click', () => this.promptPhotoVerification(idx));
      }

      this.spotsList.appendChild(item);
    });

    // Google Maps Walking route
    const googleUrl = getGoogleMapsOptimalRouteUrl(this.dailyState.origin, this.dailyState.spots);
    this.btnGoogleRoute.href = googleUrl;
  }

  updateSpotsLiveDistances() {
    if (!this.dailyState || !this.dailyState.spots || !this.userLocation) return;

    this.dailyState.spots.forEach((spot, idx) => {
      if (spot.checkedIn) return;

      const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
      const distEl = document.getElementById(`spot-dist-${idx}`);
      if (distEl) {
        distEl.textContent = `📍 ${formatDistance(prox.distanceKm)} away`;
      }

      const btn = document.querySelector(`.pixel-btn-checkin[data-idx="${idx}"]`);
      if (btn) {
        if (prox.inRange) {
          btn.classList.add('ready');
          btn.textContent = '📸 TAKE PHOTO';
        } else {
          btn.classList.remove('ready');
          btn.textContent = 'VERIFY';
        }
      }
    });
  }

  /**
   * Prompts BeReal-style photo verification when user arrives within 21m.
   * @param {number} spotIndex
   */
  promptPhotoVerification(spotIndex) {
    if (!this.userLocation) {
      this.showToast('📍 WAITING FOR GPS SIGNAL...');
      return;
    }

    const spot = this.dailyState.spots[spotIndex];
    if (spot.checkedIn) {
      this.showToast('✅ SPOT ALREADY VERIFIED!');
      return;
    }

    const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
    if (!prox.inRange) {
      this.showToast(`⚠️ Too far (${prox.distanceMeters} m). Get within 21 m to verify!`);
      if ('vibrate' in navigator) navigator.vibrate(80);
      return;
    }

    // Open Camera Viewfinder Modal
    this.cameraModal.open(spotIndex, spot, async (idx, photoDataUrl) => {
      await this.handlePhotoVerified(idx, photoDataUrl);
    });
  }

  async handlePhotoVerified(spotIndex, photoDataUrl) {
    const result = await this.streakService.verifySpotWithPhoto(spotIndex, this.userLocation, photoDataUrl);

    if (result.success) {
      if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);

      this.dailyState = this.streakService.getDailyState();
      this.renderTourUI();
      this.map.renderDailySpotsAndRoute(this.dailyState.origin, this.dailyState.spots, (idx) => this.promptPhotoVerification(idx));

      if (result.allCompleted) {
        this.updateStreakBadge();
        this.triggerConfetti(true);
        this.showToast(`🎉 ALL 3 DESTINATIONS VERIFIED! STREAK: ${result.streak} DAYS! 🔥`);
      } else {
        this.showToast(result.message);
      }
    } else {
      this.showToast(`⚠️ ${result.message}`);
    }
  }

  triggerConfetti(isGrand = false) {
    try {
      if (isGrand) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } else {
        confetti({
          particleCount: 35,
          spread: 50,
          origin: { y: 0.85 },
          colors: ['#facc15', '#22c55e', '#0ea5e9', '#ef4444']
        });
      }
    } catch {}
  }

  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
  }
}
