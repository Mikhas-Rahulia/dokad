import { StreakService } from '../geo/streakService.js';
import { PasskeyAuth } from './PasskeyAuth.js';
import { CameraModal } from './CameraModal.js';
import { CalendarModal } from './CalendarModal.js';
import { t } from '../i18n/translations.js';
import {
  formatDistance,
  checkProximity,
  getGoogleMapsOptimalRouteUrl
} from '../geo/geometry.js';

export class AppUI {
  constructor({ mapController, pwaPrompt = null }) {
    this.map = mapController;
    this.pwaPrompt = pwaPrompt;
    this.streakService = new StreakService();

    this.currentLang = this.detectLanguage();
    this.userLocation = null;
    this.dailyState = null;
    this.watchId = null;

    this.cacheElements();
    this.initComponents();
    this.bindEvents();
    this.applyLanguage(this.currentLang);
    this.updateStreakBadge();
    this.initGeolocation();
    this.loadTodayTour();
  }

  detectLanguage() {
    const saved = localStorage.getItem('dokad_user_language');
    if (saved && ['pl', 'ru', 'be', 'nl', 'en'].includes(saved)) {
      return saved;
    }
    const nav = (navigator.language || 'pl').toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('be')) return 'be';
    if (nav.startsWith('nl')) return 'nl';
    if (nav.startsWith('en')) return 'en';
    return 'pl';
  }

  cacheElements() {
    // Header
    this.brandTitleEl = document.getElementById('brand-title');
    this.radiusTagEl = document.getElementById('radius-tag');
    this.navMemoriesText = document.getElementById('nav-memories-text');
    this.streakCountEl = document.getElementById('streak-count');
    this.btnLocateMe = document.getElementById('btn-locate-me');
    this.btnOpenCalendar = document.getElementById('btn-open-calendar');
    this.langSelect = document.getElementById('lang-select');

    // Cards
    this.initialCard = document.getElementById('initial-card');
    this.initialTitleEl = document.getElementById('initial-title');
    this.initialSubtitleEl = document.getElementById('initial-subtitle');
    this.btnRollText = document.getElementById('btn-roll-text');
    this.btnGenerateDaily = document.getElementById('btn-generate-daily');

    this.tourCard = document.getElementById('tour-card');
    this.tourProgressBadge = document.getElementById('tour-progress-badge');
    this.tourDistanceBadge = document.getElementById('tour-distance-badge');
    this.spotsList = document.getElementById('spots-list');
    this.btnGoogleRoute = document.getElementById('btn-google-route');
    this.routeText = document.getElementById('route-text');
    this.btnRerollDaily = document.getElementById('btn-reroll-daily');
    this.btnRerollText = document.getElementById('btn-reroll-text');

    // Toast
    this.toast = document.getElementById('toast');
  }

  initComponents() {
    this.cameraModal = new CameraModal(this.currentLang);
    this.calendarModal = new CalendarModal(this.streakService, this.currentLang);
    this.passkeyAuth = new PasskeyAuth(() => {
      this.showToast(t('toastUnlocked', this.currentLang));
      if (this.userLocation) {
        this.map.recenterUser();
      }
    }, this.currentLang);
  }

  bindEvents() {
    // Language Switcher
    if (this.langSelect) {
      this.langSelect.value = this.currentLang;
      this.langSelect.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    }

    // Locate GPS
    this.btnLocateMe.addEventListener('click', () => this.centerOnUser());

    // Open Calendar Memories
    this.btnOpenCalendar.addEventListener('click', () => this.calendarModal.open());

    // Generate & Reroll 3 daily spots
    this.btnGenerateDaily.addEventListener('click', () => this.generateDailyTour());
    this.btnRerollDaily.addEventListener('click', () => this.generateDailyTour(true));
  }

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('dokad_user_language', lang);
    document.documentElement.lang = lang;

    if (this.langSelect) {
      this.langSelect.value = lang;
    }

    this.applyLanguage(lang);
    this.passkeyAuth.updateLanguage(lang);
    this.cameraModal.updateLanguage(lang);
    this.calendarModal.updateLanguage(lang);
    if (this.pwaPrompt) {
      this.pwaPrompt.updateLanguage(lang);
    }
  }

  applyLanguage(lang) {
    // Header
    if (this.brandTitleEl) this.brandTitleEl.textContent = t('appTitle', lang);
    if (this.radiusTagEl) this.radiusTagEl.textContent = t('radiusTag', lang);
    if (this.navMemoriesText) this.navMemoriesText.textContent = t('memoriesNav', lang);

    // Initial Card
    if (this.initialTitleEl) this.initialTitleEl.textContent = t('initialTitle', lang);
    if (this.initialSubtitleEl) this.initialSubtitleEl.textContent = t('initialSubtitle', lang);
    if (this.btnRollText) this.btnRollText.textContent = t('startWalkBtn', lang);

    // Tour Card
    if (this.routeText) this.routeText.textContent = t('openGoogleMaps', lang);
    if (this.btnRerollText) {
      const shufflesLeft = this.streakService.getShufflesRemaining();
      this.btnRerollText.textContent = `${t('rerollSpots', lang)} (${shufflesLeft}/1)`;
    }

    // Re-render active tour with current language strings
    if (this.dailyState) {
      this.renderTourUI();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DUAL-PHASE GPS: Instant coarse → precise GNSS with battery mgmt
  // ═══════════════════════════════════════════════════════════════
  initGeolocation() {
    if (!navigator.geolocation) {
      this.showToast(t('toastGpsReq', this.currentLang));
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

    // Phase 1: Instant coarse position from Wi-Fi/Cell cache (~50ms)
    navigator.geolocation.getCurrentPosition(onPos, onErr, {
      enableHighAccuracy: false,
      timeout: 2000,
      maximumAge: 60000
    });

    // Phase 2: High-accuracy GNSS tracking
    const startPrecisionWatch = () => {
      if (this.watchId !== null) return;
      this.watchId = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      });
    };

    const stopWatch = () => {
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    };

    startPrecisionWatch();

    // Battery management: suspend GPS when app is backgrounded
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopWatch();
      } else {
        startPrecisionWatch();
      }
    });
  }

  centerOnUser() {
    if (this.userLocation) {
      this.map.recenterUser();
    } else {
      this.showToast(t('toastGpsWait', this.currentLang));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng);
          this.map.recenterUser();
        },
        () => this.showToast(t('toastGpsReq', this.currentLang))
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
    if (isReroll && !this.streakService.canShuffleToday()) {
      this.showToast(t('toastShuffleLimit', this.currentLang));
      if ('vibrate' in navigator) navigator.vibrate(80);
      return;
    }

    const origin = this.userLocation || { lat: 50.0647, lng: 19.9450 };

    try {
      this.dailyState = this.streakService.initDailySpots(origin, null, isReroll);
    } catch {
      this.showToast(t('toastShuffleLimit', this.currentLang));
      return;
    }

    this.map.renderDailySpotsAndRoute(origin, this.dailyState.spots, (idx) => this.promptPhotoVerification(idx));
    this.renderTourUI();

    if ('vibrate' in navigator) navigator.vibrate([20, 35, 20]);
    this.triggerConfetti();

    this.showToast(isReroll ? t('toastNewSpots', this.currentLang) : t('toastSpotsReady', this.currentLang));
  }

  renderTourUI() {
    if (!this.dailyState) return;

    this.initialCard.style.display = 'none';
    this.tourCard.style.display = 'flex';

    const spots = this.dailyState.spots;
    const completedCount = spots.filter(s => s.checkedIn).length;
    const totalDistStr = formatDistance(this.dailyState.totalDistanceKm, this.currentLang);

    this.tourProgressBadge.textContent = `${completedCount}/3 ${t('completedBadge', this.currentLang)}`;
    this.tourProgressBadge.className = `pixel-badge progress-badge ${completedCount === 3 ? 'all-done' : ''}`;
    this.tourDistanceBadge.textContent = `🚶 ${totalDistStr} ${t('routeBadge', this.currentLang)}`;

    // 1 Shuffle per day limit status
    const shufflesLeft = this.streakService.getShufflesRemaining();
    if (this.btnRerollDaily && this.btnRerollText) {
      if (shufflesLeft <= 0) {
        this.btnRerollDaily.disabled = true;
        this.btnRerollDaily.classList.add('disabled');
        this.btnRerollDaily.title = t('noShufflesLeft', this.currentLang);
        this.btnRerollText.textContent = `${t('rerollSpots', this.currentLang)} (0/1)`;
      } else {
        this.btnRerollDaily.disabled = false;
        this.btnRerollDaily.classList.remove('disabled');
        this.btnRerollDaily.title = t('oneShuffleLeft', this.currentLang);
        this.btnRerollText.textContent = `${t('rerollSpots', this.currentLang)} (1/1)`;
      }
    }

    this.spotsList.innerHTML = '';

    spots.forEach((spot, idx) => {
      const isCheckedIn = !!spot.checkedIn;
      let distText = '—';
      let inProximity = false;

      if (this.userLocation) {
        const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
        distText = formatDistance(prox.distanceKm, this.currentLang);
        inProximity = prox.inRange;
      }

      const spotNum = spot.step || idx + 1;
      const item = document.createElement('div');
      item.className = `spot-item ${isCheckedIn ? 'done' : inProximity ? 'in-range' : ''}`;
      item.innerHTML = `
        <div class="spot-item-left">
          <span class="spot-number-badge ${isCheckedIn ? 'done' : ''}">${isCheckedIn ? '✔' : spotNum}</span>
          <div class="spot-details">
            <div class="spot-title">${t('spotLabel', this.currentLang)} ${spotNum}</div>
            <div class="spot-distance" id="spot-dist-${idx}">
              ${isCheckedIn ? t('photoVerified', this.currentLang) : `📍 ${distText} ${t('distanceAway', this.currentLang)}`}
            </div>
          </div>
        </div>
        <div class="spot-item-right">
          ${
            isCheckedIn
              ? `<span class="badge-checked">${t('verifiedText', this.currentLang)}</span>`
              : `<button class="pixel-btn pixel-btn-checkin ${inProximity ? 'ready' : ''}" data-idx="${idx}">
                   ${inProximity ? t('takePhotoBtn', this.currentLang) : t('verifyBtn', this.currentLang)}
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
        distEl.textContent = `📍 ${formatDistance(prox.distanceKm, this.currentLang)} ${t('distanceAway', this.currentLang)}`;
      }

      const btn = document.querySelector(`.pixel-btn-checkin[data-idx="${idx}"]`);
      if (btn) {
        if (prox.inRange) {
          btn.classList.add('ready');
          btn.textContent = t('takePhotoBtn', this.currentLang);
        } else {
          btn.classList.remove('ready');
          btn.textContent = t('verifyBtn', this.currentLang);
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
      this.showToast(t('toastGpsWait', this.currentLang));
      return;
    }

    const spot = this.dailyState.spots[spotIndex];
    if (spot.checkedIn) {
      this.showToast(t('toastAlreadyDone', this.currentLang));
      return;
    }

    const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
    if (!prox.inRange) {
      this.showToast(t('toastTooFar', this.currentLang, { dist: prox.distanceMeters }));
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
        this.showToast(t('toastAllDone', this.currentLang, { streak: result.streak }));
      } else {
        this.showToast(t('toastSpotDone', this.currentLang, { step: spotIndex + 1 }));
      }
    } else {
      this.showToast(`⚠️ ${result.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WAAPI CONFETTI — Zero dependencies, compositor-thread animation
  // ═══════════════════════════════════════════════════════════════
  triggerConfetti(isGrand = false) {
    const count = isGrand ? 40 : 16;
    const colors = ['#facc15', '#22c55e', '#0ea5e9', '#ef4444', '#a855f7', '#fb923c'];
    const container = document.getElementById('app');

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        width: ${6 + Math.random() * 8}px;
        height: ${6 + Math.random() * 8}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border: 1px solid #000;
        pointer-events: none;
        z-index: 100000;
        left: ${40 + Math.random() * 20}%;
        top: ${isGrand ? 50 : 80}%;
        will-change: transform, opacity;
      `;
      container.appendChild(particle);

      const xDrift = (Math.random() - 0.5) * 300;
      const yDrift = -(200 + Math.random() * 300);
      const rotation = Math.random() * 720 - 360;

      particle.animate([
        { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate3d(${xDrift}px, ${yDrift}px, 0) rotate(${rotation}deg)`, opacity: 0 }
      ], {
        duration: 800 + Math.random() * 600,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      }).onfinish = () => particle.remove();
    }
  }

  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
  }
}
