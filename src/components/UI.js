import { StreakService } from '../geo/streakService.js';
import { RoutingService } from '../geo/routingService.js';
import { PasskeyAuth } from './PasskeyAuth.js';
import { CameraModal } from './CameraModal.js';
import { CalendarModal } from './CalendarModal.js';
import { LegalModal } from './LegalModal.js';
import { t } from '../i18n/translations.js';
import { nativePlatform } from '../utils/nativePlatform.js';
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
    this.userAccuracy = null;
    this.lastGpsTimestamp = null;
    this.dailyState = null;
    this.activeStreetRoute = null;
    this.watchId = null;
    this.hasInitialGpsCentered = false;

    this.cacheElements();
    this.initComponents();
    this.bindEvents();
    this.applyLanguage(this.currentLang);
    this.updateStreakBadge();
    this.initGeolocation();
    this.loadTodayTour();
    this.fallbackIpLocationPreload();
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
    this.navLegalText = document.getElementById('nav-legal-text');
    this.streakCountEl = document.getElementById('streak-count');
    this.headerStreakBadge = document.getElementById('header-streak-badge');
    this.btnLocateMe = document.getElementById('btn-locate-me');
    this.btnOpenCalendar = document.getElementById('btn-open-calendar');
    this.btnOpenLegal = document.getElementById('btn-open-legal');
    this.langSelect = document.getElementById('lang-select');
    this.btnGpsStatus = document.getElementById('btn-gps-status');
    this.gpsStatusHeaderText = document.getElementById('gps-status-header-text');

    // GPS Diagnostics Modal
    this.gpsDiagModal = document.getElementById('modal-gps-diag');
    this.gpsDiagModalClose = document.getElementById('modal-gps-diag-close');
    this.gpsDiagModalTitle = document.getElementById('gps-diag-modal-title');
    this.gpsDiagStatus = document.getElementById('gps-diag-status');
    this.gpsDiagCoords = document.getElementById('gps-diag-coords');
    this.gpsDiagAccuracy = document.getElementById('gps-diag-accuracy');
    this.gpsDiagTime = document.getElementById('gps-diag-time');
    this.gpsDiagSpotsList = document.getElementById('gps-diag-spots-list');
    this.btnGpsForceTest = document.getElementById('btn-gps-force-test');
    this.btnGpsTestText = document.getElementById('btn-gps-test-text');

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
    this.btnFitRoute = document.getElementById('btn-fit-route');
    this.btnFitRouteText = document.getElementById('btn-fit-route-text');
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
    this.legalModal = new LegalModal(this.currentLang);
    this.passkeyAuth = new PasskeyAuth(() => {
      nativePlatform.playCoin();
      this.showToast(t('toastUnlocked', this.currentLang));
      if (this.userLocation) {
        this.centerOnUser();
      }
    }, this.currentLang);
  }

  bindEvents() {
    // Language Switcher
    if (this.langSelect) {
      this.langSelect.value = this.currentLang;
      this.langSelect.addEventListener('change', (e) => {
        nativePlatform.playBlip();
        this.setLanguage(e.target.value);
      });
    }

    // Locate GPS button in header
    this.btnLocateMe.addEventListener('click', () => {
      nativePlatform.playBlip();
      this.centerOnUser();
    });

    // Fit In-App Walking Route on Map
    if (this.btnFitRoute) {
      this.btnFitRoute.addEventListener('click', () => {
        nativePlatform.playBlip();
        if (this.dailyState) {
          const origin = this.dailyState.origin;
          const spots = this.dailyState.spots;
          const coords = this.activeStreetRoute ? this.activeStreetRoute.coordinates : null;
          this.map.fitTourBounds(origin, spots, coords);
        }
      });
    }

    // Open GPS Diagnostics Modal
    if (this.btnGpsStatus) {
      this.btnGpsStatus.addEventListener('click', () => {
        nativePlatform.playBlip();
        this.openGpsDiagnostics();
      });
    }

    if (this.gpsDiagModalClose) {
      this.gpsDiagModalClose.addEventListener('click', () => {
        nativePlatform.playBlip();
        this.closeGpsDiagnostics();
      });
    }

    if (this.gpsDiagModal) {
      this.gpsDiagModal.addEventListener('click', (e) => {
        if (e.target === this.gpsDiagModal) {
          nativePlatform.playBlip();
          this.closeGpsDiagnostics();
        }
      });
    }

    if (this.btnGpsForceTest) {
      this.btnGpsForceTest.addEventListener('click', () => this.forceGpsReacquire());
    }

    // Open Calendar & Gallery Memories
    this.btnOpenCalendar.addEventListener('click', () => {
      nativePlatform.playBlip();
      this.calendarModal.open('calendar');
    });

    // Open Legal, Privacy & Anthropology Mission Modal
    if (this.btnOpenLegal) {
      this.btnOpenLegal.addEventListener('click', () => {
        nativePlatform.playBlip();
        this.legalModal.open('mission');
      });
    }

    // Open Streak Stats from Header Badge
    if (this.headerStreakBadge) {
      this.headerStreakBadge.addEventListener('click', () => {
        nativePlatform.playBlip();
        this.calendarModal.open('streak');
      });
    }

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
    this.legalModal.updateLanguage(lang);
    if (this.pwaPrompt) {
      this.pwaPrompt.updateLanguage(lang);
    }
  }

  applyLanguage(lang) {
    // Header
    if (this.brandTitleEl) this.brandTitleEl.textContent = t('appTitle', lang);
    if (this.radiusTagEl) this.radiusTagEl.textContent = t('radiusTag', lang);
    if (this.navMemoriesText) this.navMemoriesText.textContent = t('memoriesNav', lang);
    if (this.navLegalText) this.navLegalText.textContent = t('infoLegalNav', lang);
    if (this.btnGpsTestText) this.btnGpsTestText.textContent = t('gpsVerifyBtn', lang);

    // Initial Card
    if (this.initialTitleEl) this.initialTitleEl.textContent = t('initialTitle', lang);
    if (this.initialSubtitleEl) this.initialSubtitleEl.textContent = t('initialSubtitle', lang);
    if (this.btnRollText) this.btnRollText.textContent = t('startWalkBtn', lang);

    // Tour Card
    if (this.btnFitRouteText) this.btnFitRouteText.textContent = t('btnFitRouteText', lang);
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
  // HIGH-PRECISION GNSS GEOLOCATION ENGINE
  // ═══════════════════════════════════════════════════════════════
  initGeolocation() {
    if (!navigator.geolocation) {
      this.showToast(t('toastGpsReq', this.currentLang));
      if (this.gpsDiagStatus) this.gpsDiagStatus.textContent = '❌ GPS NOT SUPPORTED';
      return;
    }

    const onPos = (pos) => {
      this.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      this.userAccuracy = pos.coords.accuracy || 15;
      this.lastGpsTimestamp = new Date();

      // Update map marker and accuracy circle
      this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng, this.userAccuracy);
      this.updateSpotsLiveDistances();

      // On first GPS lock, center map on the user if no tour is active
      if (!this.hasInitialGpsCentered && (!this.dailyState || !this.dailyState.spots)) {
        this.hasInitialGpsCentered = true;
        if (this.map && this.map.map) {
          this.map.map.flyTo({
            center: [this.userLocation.lng, this.userLocation.lat],
            zoom: 15,
            duration: 1200
          });
        }
      }

      // Update Header GPS Status Pill
      if (this.gpsStatusHeaderText) {
        this.gpsStatusHeaderText.textContent = `GPS ±${Math.round(this.userAccuracy)}m`;
      }

      // Update Diagnostics modal if open
      this.renderGpsDiagnosticsContent();
    };

    const onErr = (err) => {
      console.warn('GPS position error:', err.code, err.message);
      if (this.gpsStatusHeaderText && !this.userLocation) {
        this.gpsStatusHeaderText.textContent = 'GPS ⚠️';
      }
      if (this.gpsDiagStatus) {
        this.gpsDiagStatus.textContent = `⚠️ ${err.message}`;
        this.gpsDiagStatus.className = 'gps-diag-val error';
      }
    };

    // 1. Instant high-accuracy single shot
    navigator.geolocation.getCurrentPosition(onPos, onErr, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });

    // 2. Continuous GNSS live stream
    const startPrecisionWatch = () => {
      if (this.watchId !== null) return;
      this.watchId = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 20000
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

  async fallbackIpLocationPreload() {
    if (this.userLocation) return;

    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude && !this.userLocation && !this.hasInitialGpsCentered) {
          if (this.map && this.map.map) {
            this.map.map.flyTo({
              center: [data.longitude, data.latitude],
              zoom: 12,
              duration: 800
            });
          }
        }
      }
    } catch {}
  }

  openGpsDiagnostics() {
    this.renderGpsDiagnosticsContent();
    if (this.gpsDiagModal) {
      this.gpsDiagModal.classList.add('active');
    }
  }

  closeGpsDiagnostics() {
    if (this.gpsDiagModal) {
      this.gpsDiagModal.classList.remove('active');
    }
  }

  renderGpsDiagnosticsContent() {
    if (!this.gpsDiagModal || !this.gpsDiagModal.classList.contains('active')) return;

    if (this.userLocation) {
      if (this.gpsDiagCoords) {
        this.gpsDiagCoords.textContent = `${this.userLocation.lat.toFixed(5)}° N, ${this.userLocation.lng.toFixed(5)}° E`;
      }
      if (this.gpsDiagAccuracy) {
        this.gpsDiagAccuracy.textContent = `±${Math.round(this.userAccuracy || 10)} meters`;
      }
      if (this.gpsDiagTime && this.lastGpsTimestamp) {
        this.gpsDiagTime.textContent = this.lastGpsTimestamp.toLocaleTimeString();
      }
      if (this.gpsDiagStatus) {
        this.gpsDiagStatus.textContent = '🟢 ACTIVE & STREAMING (GNSS)';
        this.gpsDiagStatus.className = 'gps-diag-val live';
      }
    } else {
      if (this.gpsDiagCoords) this.gpsDiagCoords.textContent = 'Acquiring satellite lock...';
      if (this.gpsDiagAccuracy) this.gpsDiagAccuracy.textContent = '--';
      if (this.gpsDiagTime) this.gpsDiagTime.textContent = '--';
    }

    // Render distances to spots in diagnostics
    if (this.gpsDiagSpotsList) {
      if (this.dailyState && this.dailyState.spots && this.dailyState.spots.length > 0 && this.userLocation) {
        this.gpsDiagSpotsList.innerHTML = '';
        this.dailyState.spots.forEach((spot, idx) => {
          const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
          const row = document.createElement('div');
          row.className = `gps-spot-diag-item ${spot.checkedIn ? 'done' : prox.inRange ? 'in-range' : ''}`;
          row.innerHTML = `
            <span>#${spot.step || idx + 1} (${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)})</span>
            <strong>${spot.checkedIn ? '✔ VERIFIED' : `${prox.distanceMeters} m (${prox.inRange ? '🎯 IN RANGE' : '🚶 AWAY'})`}</strong>
          `;
          this.gpsDiagSpotsList.appendChild(row);
        });
      } else {
        this.gpsDiagSpotsList.innerHTML = '<div class="no-spots-diag">No active tour spots generated yet. Click "Start Today\'s 3-Spot Walk".</div>';
      }
    }
  }

  forceGpsReacquire() {
    nativePlatform.playBlip();
    this.showToast(t('toastGpsWait', this.currentLang));

    if (!navigator.geolocation) {
      nativePlatform.playError();
      this.showToast(t('toastGpsReq', this.currentLang));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        this.userAccuracy = pos.coords.accuracy || 10;
        this.lastGpsTimestamp = new Date();

        this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng, this.userAccuracy);
        this.map.recenterUser();
        this.updateSpotsLiveDistances();

        if (this.gpsStatusHeaderText) {
          this.gpsStatusHeaderText.textContent = `GPS ±${Math.round(this.userAccuracy)}m`;
        }

        this.renderGpsDiagnosticsContent();
        nativePlatform.playCoin();
        this.showToast(`🛰️ GPS: ${this.userLocation.lat.toFixed(4)}, ${this.userLocation.lng.toFixed(4)} (±${Math.round(this.userAccuracy)}m)`);
      },
      (err) => {
        nativePlatform.playError();
        this.showToast(`⚠️ GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  centerOnUser() {
    if (this.userLocation) {
      this.map.recenterUser();
      this.showToast(`📍 ${this.userLocation.lat.toFixed(4)}, ${this.userLocation.lng.toFixed(4)} (±${Math.round(this.userAccuracy || 10)}m)`);
    } else {
      this.forceGpsReacquire();
    }
  }

  updateStreakBadge() {
    const stats = this.streakService.getStreakStats();
    this.streakCountEl.textContent = stats.currentStreak || 0;
  }

  async loadTodayTour() {
    const state = this.streakService.getDailyState();
    if (state && state.spots && state.spots.length === 3) {
      this.dailyState = state;
      this.renderTourUI();

      // Fetch real street routing in background and render on built-in map
      this.fetchAndRenderBuiltInRoute(state.origin, state.spots);

      const pending = state.spots.filter(s => !s.checkedIn).length;
      if (pending > 0) {
        nativePlatform.requestWakeLock();
        nativePlatform.setAppBadge(pending);
      } else {
        nativePlatform.clearAppBadge();
      }
    } else {
      this.initialCard.style.display = 'flex';
      this.tourCard.style.display = 'none';
    }
  }

  async generateDailyTour(isReroll = false) {
    if (isReroll && !this.streakService.canShuffleToday()) {
      nativePlatform.playError();
      this.showToast(t('toastShuffleLimit', this.currentLang));
      if ('vibrate' in navigator) navigator.vibrate(80);
      return;
    }

    nativePlatform.playBlip();

    // If we don't have userLocation yet, actively acquire GPS lock first!
    if (!this.userLocation) {
      this.showToast(t('toastGpsWait', this.currentLang));
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
          });
        });
        this.userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        this.userAccuracy = pos.coords.accuracy || 15;
        this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng, this.userAccuracy);
      } catch (err) {
        console.warn('GPS acquire error during tour generation:', err);
        const mapCenter = this.map.map.getCenter();
        this.userLocation = { lat: mapCenter.lat, lng: mapCenter.lng };
      }
    }

    const origin = this.userLocation;

    try {
      this.dailyState = this.streakService.initDailySpots(origin, null, isReroll);
    } catch {
      nativePlatform.playError();
      this.showToast(t('toastShuffleLimit', this.currentLang));
      return;
    }

    nativePlatform.transition(() => {
      this.renderTourUI();
    });

    // Render built-in pedestrian street route
    this.fetchAndRenderBuiltInRoute(origin, this.dailyState.spots);

    nativePlatform.requestWakeLock();
    nativePlatform.setAppBadge(3);

    if ('vibrate' in navigator) navigator.vibrate([20, 35, 20]);
    this.triggerConfetti();

    this.showToast(isReroll ? t('toastNewSpots', this.currentLang) : t('toastSpotsReady', this.currentLang));
  }

  async fetchAndRenderBuiltInRoute(origin, spots) {
    // 1. Initial fast render with straight TSP lines
    this.map.renderDailySpotsAndRoute(origin, spots, (idx) => this.promptPhotoVerification(idx));

    // 2. Fetch high-res pedestrian street geometry
    try {
      const routeData = await RoutingService.fetchWalkingLoop(origin, spots);
      this.activeStreetRoute = routeData;

      if (routeData && routeData.coordinates && routeData.coordinates.length > 0) {
        this.map.renderDailySpotsAndRoute(
          origin,
          spots,
          (idx) => this.promptPhotoVerification(idx),
          routeData.coordinates
        );

        // Update badge with street distance & estimated walking time
        const distStr = formatDistance(routeData.distanceKm, this.currentLang);
        const timeStr = routeData.durationMinutes > 0 ? ` (${routeData.durationMinutes} min)` : '';
        this.tourDistanceBadge.textContent = `🚶 ${distStr}${timeStr} ${t('inAppRouteBadge', this.currentLang)}`;
      }
    } catch (err) {
      console.warn('Built-in routing fetch error:', err);
    }
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
        checkInBtn.addEventListener('click', () => {
          nativePlatform.playBlip();
          this.promptPhotoVerification(idx);
        });
      }

      this.spotsList.appendChild(item);
    });

    // Google Maps Walking route (Option for external app navigation)
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

  promptPhotoVerification(spotIndex) {
    if (!this.userLocation) {
      nativePlatform.playError();
      this.showToast(t('toastGpsWait', this.currentLang));
      return;
    }

    const spot = this.dailyState.spots[spotIndex];
    if (spot.checkedIn) {
      nativePlatform.playBlip();
      this.showToast(t('toastAlreadyDone', this.currentLang));
      return;
    }

    const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
    if (!prox.inRange) {
      nativePlatform.playError();
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

      const routeCoords = this.activeStreetRoute ? this.activeStreetRoute.coordinates : null;
      this.map.renderDailySpotsAndRoute(
        this.dailyState.origin,
        this.dailyState.spots,
        (idx) => this.promptPhotoVerification(idx),
        routeCoords
      );

      const pending = this.dailyState.spots.filter(s => !s.checkedIn).length;

      if (result.allCompleted) {
        nativePlatform.playVictory();
        nativePlatform.clearAppBadge();
        nativePlatform.releaseWakeLock();

        this.updateStreakBadge();
        this.triggerConfetti(true);
        this.showToast(t('toastAllDone', this.currentLang, { streak: result.streak }));
      } else {
        nativePlatform.playCoin();
        nativePlatform.setAppBadge(pending);
        this.showToast(t('toastSpotDone', this.currentLang, { step: spotIndex + 1 }));
      }
    } else {
      nativePlatform.playError();
      this.showToast(`⚠️ ${result.message}`);
    }
  }

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
