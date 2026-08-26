import confetti from 'canvas-confetti';
import { t } from '../i18n/translations.js';
import { StreakService } from '../geo/streakService.js';
import {
  formatDistance,
  checkProximity,
  getGoogleMapsOptimalRouteUrl,
  getAppleMapsUrl,
  getYandexMapsUrl
} from '../geo/geometry.js';

export class AppUI {
  constructor({ cityService, mapController }) {
    this.cityService = cityService;
    this.map = mapController;
    this.streakService = new StreakService();

    this.currentCity = this.cityService.currentCity;
    this.currentLang = this.currentCity.lang || 'pl';
    this.userLocation = null;
    this.dailyState = null;
    this.deferredInstallPrompt = null;
    this.isDark = localStorage.getItem('dokad_theme') === 'dark';

    this.cacheElements();
    this.bindEvents();
    this.initPWAInstall();
    this.applyTheme(this.isDark);
    this.updateLanguageUI();
    this.loadInitialCity();
    this.initGeolocation();
  }

  cacheElements() {
    // Header
    this.btnSelectCity = document.getElementById('btn-select-city');
    this.headerCityFlag = document.getElementById('header-city-flag');
    this.headerCityName = document.getElementById('header-city-name');
    this.streakCountEl = document.getElementById('streak-count');
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.themeIcon = document.getElementById('theme-icon');
    this.btnInfo = document.getElementById('btn-info');
    this.btnInstallPWA = document.getElementById('btn-install-pwa');

    // Map controls
    this.btnLocateMe = document.getElementById('btn-locate-me');
    this.btnRecenterCity = document.getElementById('btn-recenter-city');

    // Cards
    this.initialCard = document.getElementById('initial-card');
    this.initialTitle = document.getElementById('initial-title');
    this.initialSubtitle = document.getElementById('initial-subtitle');
    this.btnGenerateDaily = document.getElementById('btn-generate-daily');
    this.btnRollText = document.getElementById('btn-roll-text');

    this.tourCard = document.getElementById('tour-card');
    this.tourProgressBadge = document.getElementById('tour-progress-badge');
    this.tourDistanceBadge = document.getElementById('tour-distance-badge');
    this.spotsList = document.getElementById('spots-list');
    this.btnGoogleRoute = document.getElementById('btn-google-route');
    this.routeText = document.getElementById('route-text');
    this.btnRerollDaily = document.getElementById('btn-reroll-daily');
    this.rerollText = document.getElementById('reroll-text');
    this.btnCopyCoords = document.getElementById('btn-copy-coords');
    this.copyText = document.getElementById('copy-text');
    this.btnAppleMaps = document.getElementById('btn-apple-maps');
    this.btnYandexMaps = document.getElementById('btn-yandex-maps');

    // City Modal
    this.modalCity = document.getElementById('modal-city');
    this.modalCityClose = document.getElementById('modal-city-close');
    this.cityModalTitle = document.getElementById('city-modal-title');
    this.cityModalSubtitle = document.getElementById('city-modal-subtitle');
    this.citySearchInput = document.getElementById('city-search-input');
    this.citySearchBtn = document.getElementById('city-search-btn');
    this.featuredCitiesLabel = document.getElementById('featured-cities-label');
    this.featuredCitiesGrid = document.getElementById('featured-cities-grid');
    this.searchStatusMsg = document.getElementById('search-status-msg');

    // Info Modal
    this.modalInfo = document.getElementById('modal-info');
    this.modalInfoClose = document.getElementById('modal-info-close');

    // Toast
    this.toast = document.getElementById('toast');
  }

  bindEvents() {
    // City selection modal
    this.btnSelectCity.addEventListener('click', () => this.openCityModal());
    this.modalCityClose.addEventListener('click', () => this.closeCityModal());
    this.modalCity.addEventListener('click', (e) => {
      if (e.target === this.modalCity) this.closeCityModal();
    });

    // Info modal
    this.btnInfo.addEventListener('click', () => this.openInfoModal());
    this.modalInfoClose.addEventListener('click', () => this.closeInfoModal());
    this.modalInfo.addEventListener('click', (e) => {
      if (e.target === this.modalInfo) this.closeInfoModal();
    });

    // Theme toggle
    this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());

    // Map controls
    this.btnLocateMe.addEventListener('click', () => this.centerOnUser());
    this.btnRecenterCity.addEventListener('click', () => this.map.recenter());

    // Generate & Reroll 3 spots
    this.btnGenerateDaily.addEventListener('click', () => this.generateDailyTour());
    this.btnRerollDaily.addEventListener('click', () => this.generateDailyTour(true));

    // Copy coords
    this.btnCopyCoords.addEventListener('click', () => this.copyCoordinates());

    // City search
    this.citySearchBtn.addEventListener('click', () => this.handleCitySearch());
    this.citySearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCitySearch();
    });

    // PWA install button
    this.btnInstallPWA.addEventListener('click', () => this.promptPWAInstall());
  }

  initGeolocation() {
    if (!navigator.geolocation) return;

    const onPos = (pos) => {
      this.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng);
      this.updateSpotsLiveDistances();
    };

    navigator.geolocation.getCurrentPosition(onPos, (err) => console.warn(err.message), {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 10000
    });

    navigator.geolocation.watchPosition(onPos, (err) => console.warn(err.message), {
      enableHighAccuracy: true,
      maximumAge: 5000
    });
  }

  centerOnUser() {
    if (this.userLocation) {
      this.map.recenterUser();
    } else {
      this.showToast(t('gpsLocating', this.currentLang));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng);
          this.map.recenterUser();
        },
        () => this.showToast('⚠️ GPS ERROR')
      );
    }
  }

  loadInitialCity() {
    this.selectCity(this.currentCity, false);
  }

  selectCity(city) {
    this.currentCity = city;
    this.cityService.setCurrentCity(city);
    this.currentLang = city.lang || 'pl';

    // Update Header
    this.headerCityFlag.textContent = city.flag || '📍';
    this.headerCityName.textContent = city.nativeName || city.name;
    document.title = `${city.nativeName || city.name} — ${t('appTitle', this.currentLang)}`;

    // Update Language UI
    this.updateLanguageUI();

    // Update Map boundary
    this.map.setCityBoundary(city);

    // Load active daily tour if existing for this city
    const existing = this.streakService.getDailyState(city.id);
    if (existing && existing.spots && existing.spots.length === 3) {
      this.dailyState = existing;
      this.renderTourUI();
      this.map.renderDailySpotsAndRoute(existing.origin, existing.spots, (idx) => this.handleCheckIn(idx));
    } else {
      this.dailyState = null;
      this.initialCard.style.display = 'flex';
      this.tourCard.style.display = 'none';
    }

    this.updateStreakBadge();
    this.closeCityModal();
  }

  updateLanguageUI() {
    const lang = this.currentLang;

    this.btnRollText.textContent = t('rollButton', lang);
    this.initialTitle.textContent = t('todayTour', lang);
    this.initialSubtitle.textContent = t('todayTourSubtitle', lang);
    this.rerollText.textContent = t('newSpotsButton', lang);
    this.routeText.textContent = t('routeButtonGoogle', lang);
    this.copyText.textContent = t('copyCoords', lang);

    this.cityModalTitle.textContent = t('cityPromptTitle', lang);
    this.cityModalSubtitle.textContent = t('cityPromptSubtitle', lang);
    this.citySearchInput.placeholder = t('searchPlaceholder', lang);
    this.citySearchBtn.textContent = t('searchButton', lang);
    this.featuredCitiesLabel.textContent = t('featuredCities', lang);

    this.renderCityGrid();
  }

  renderCityGrid() {
    const allCities = this.cityService.getAllCities();
    this.featuredCitiesGrid.innerHTML = '';

    allCities.forEach(city => {
      const card = document.createElement('button');
      card.className = `city-card ${city.id === this.currentCity.id ? 'active' : ''}`;
      card.innerHTML = `
        <span class="city-card-flag">${city.flag || '📍'}</span>
        <span class="city-card-name">${city.nativeName || city.name}</span>
        <span class="city-card-lang">${city.country} (${city.langName || city.lang.toUpperCase()})</span>
      `;
      card.addEventListener('click', () => {
        this.selectCity(city);
        this.showToast(`📍 ${city.nativeName} (${city.country})`);
      });
      this.featuredCitiesGrid.appendChild(card);
    });
  }

  updateStreakBadge() {
    const stats = this.streakService.getStreakStats();
    this.streakCountEl.textContent = stats.currentStreak || 0;
  }

  generateDailyTour(isReroll = false) {
    if (!this.currentCity || !this.currentCity.geojson) {
      this.showToast('BŁĄD: BRAK GRANIC');
      return;
    }

    const origin = this.userLocation || {
      lat: this.currentCity.center ? this.currentCity.center[0] : 50.0647,
      lng: this.currentCity.center ? this.currentCity.center[1] : 19.9450
    };

    this.dailyState = this.streakService.initDailySpots(origin, this.currentCity);

    this.map.renderDailySpotsAndRoute(origin, this.dailyState.spots, (idx) => this.handleCheckIn(idx));
    this.renderTourUI();

    if ('vibrate' in navigator) navigator.vibrate([25, 40, 25]);
    this.triggerConfetti();

    this.showToast(isReroll ? '🎲 NOWE 3 PUNKTY!' : '🎯 3 PUNKTY DNIA WYLOSOWANE!');
  }

  renderTourUI() {
    if (!this.dailyState) return;

    this.initialCard.style.display = 'none';
    this.tourCard.style.display = 'flex';

    const spots = this.dailyState.spots;
    const completedCount = spots.filter(s => s.checkedIn).length;
    const totalDistStr = formatDistance(this.dailyState.totalDistanceKm, this.currentLang);

    this.tourProgressBadge.textContent = `${completedCount}/3 ${t('completedSpots', this.currentLang)}`;
    this.tourProgressBadge.className = `pixel-badge progress-badge ${completedCount === 3 ? 'all-done' : ''}`;
    this.tourDistanceBadge.textContent = `🚶 ${totalDistStr} ${t('totalRoute', this.currentLang)}`;

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

      const item = document.createElement('div');
      item.className = `spot-item ${isCheckedIn ? 'done' : inProximity ? 'in-range' : ''}`;
      item.innerHTML = `
        <div class="spot-item-left">
          <span class="spot-number-badge ${isCheckedIn ? 'done' : ''}">${isCheckedIn ? '✔' : spot.step}</span>
          <div class="spot-details">
            <div class="spot-title">SPOT ${spot.step}</div>
            <div class="spot-distance" id="spot-dist-${idx}">
              ${isCheckedIn ? `✅ ${t('arrivedBadge', this.currentLang)}` : `📍 ${distText}`}
            </div>
          </div>
        </div>
        <div class="spot-item-right">
          ${
            isCheckedIn
              ? `<span class="badge-checked">${t('arrivedBadge', this.currentLang)}</span>`
              : `<button class="pixel-btn pixel-btn-checkin ${inProximity ? 'ready' : ''}" data-idx="${idx}">
                   ${inProximity ? t('checkInReadyBtn', this.currentLang) : t('checkInBtn', this.currentLang)}
                 </button>`
          }
        </div>
      `;

      const checkInBtn = item.querySelector('.pixel-btn-checkin');
      if (checkInBtn) {
        checkInBtn.addEventListener('click', () => this.handleCheckIn(idx));
      }

      this.spotsList.appendChild(item);
    });

    // Google Maps Walking route
    const googleUrl = getGoogleMapsOptimalRouteUrl(this.dailyState.origin, this.dailyState.spots);
    this.btnGoogleRoute.href = googleUrl;

    // Apple Maps route
    const lastSpot = this.dailyState.spots[this.dailyState.spots.length - 1];
    this.btnAppleMaps.href = getAppleMapsUrl(lastSpot.lat, lastSpot.lng);

    // Yandex Maps route
    const isYandexTerritory = this.currentCity.countryCode === 'BY' || 
                              this.currentCity.countryCode === 'RU' ||
                              this.currentCity.id === 'moscow' ||
                              this.currentCity.id === 'grodno';

    if (isYandexTerritory) {
      this.btnYandexMaps.style.display = 'inline-flex';
      this.btnYandexMaps.href = getYandexMapsUrl(
        this.dailyState.origin.lat,
        this.dailyState.origin.lng,
        lastSpot.lat,
        lastSpot.lng
      );
    } else {
      this.btnYandexMaps.style.display = 'none';
    }
  }

  updateSpotsLiveDistances() {
    if (!this.dailyState || !this.dailyState.spots || !this.userLocation) return;

    this.dailyState.spots.forEach((spot, idx) => {
      if (spot.checkedIn) return;

      const prox = checkProximity(this.userLocation.lat, this.userLocation.lng, spot.lat, spot.lng, 21);
      const distEl = document.getElementById(`spot-dist-${idx}`);
      if (distEl) {
        distEl.textContent = `📍 ${formatDistance(prox.distanceKm, this.currentLang)}`;
      }

      const btn = document.querySelector(`.pixel-btn-checkin[data-idx="${idx}"]`);
      if (btn) {
        if (prox.inRange) {
          btn.classList.add('ready');
          btn.textContent = t('checkInReadyBtn', this.currentLang);
        } else {
          btn.classList.remove('ready');
          btn.textContent = t('checkInBtn', this.currentLang);
        }
      }
    });
  }

  handleCheckIn(spotIndex) {
    if (!this.userLocation) {
      this.showToast(t('gpsLocating', this.currentLang));
      return;
    }

    const result = this.streakService.checkInSpot(spotIndex, this.userLocation);

    if (result.success) {
      if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);

      this.dailyState = this.streakService.getDailyState(this.currentCity.id);
      this.renderTourUI();
      this.map.renderDailySpotsAndRoute(this.dailyState.origin, this.dailyState.spots, (idx) => this.handleCheckIn(idx));

      if (result.allCompleted) {
        this.updateStreakBadge();
        this.triggerConfetti(true);
        this.showToast(`🎉 STREAK: ${result.streak} ${t('streakLabel', this.currentLang)}! 🔥`);
      } else {
        this.showToast(result.message);
      }
    } else {
      if ('vibrate' in navigator) navigator.vibrate(100);
      this.showToast(`⚠️ ${result.message}`);
    }
  }

  copyCoordinates() {
    if (!this.dailyState || !this.dailyState.spots) return;
    const text = this.dailyState.spots.map(s => `${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}`).join(' | ');
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(`📋 ${t('coordsCopied', this.currentLang)}`);
      if ('vibrate' in navigator) navigator.vibrate(15);
    });
  }

  async handleCitySearch() {
    const query = this.citySearchInput.value.trim();
    if (!query) return;

    this.searchStatusMsg.style.display = 'block';
    this.searchStatusMsg.textContent = '🔍 SZUKANIE W OPENSTREETMAP...';

    try {
      const city = await this.cityService.searchAndFetchCity(query);
      this.searchStatusMsg.style.display = 'none';
      this.citySearchInput.value = '';
      this.selectCity(city);
      this.showToast(`✨ ${city.nativeName} DODANO!`);
    } catch (err) {
      this.searchStatusMsg.style.display = 'block';
      this.searchStatusMsg.textContent = `❌ ${err.message || 'NIE ZNALEZIONO'}`;
    }
  }

  triggerConfetti(isGrand = false) {
    try {
      if (isGrand) {
        confetti({
          particleCount: 100,
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
    }, 2500);
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    this.applyTheme(this.isDark);
    localStorage.setItem('dokad_theme', this.isDark ? 'dark' : 'light');
  }

  applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    this.themeIcon.textContent = isDark ? '☀️' : '🌙';
    this.map.setTileTheme(isDark);
  }

  openCityModal() {
    this.modalCity.classList.add('active');
    this.citySearchInput.focus();
  }

  closeCityModal() {
    this.modalCity.classList.remove('active');
  }

  openInfoModal() {
    this.modalInfo.classList.add('active');
  }

  closeInfoModal() {
    this.modalInfo.classList.remove('active');
  }

  initPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      this.btnInstallPWA.style.display = 'flex';
    });

    window.addEventListener('appinstalled', () => {
      this.btnInstallPWA.style.display = 'none';
      this.deferredInstallPrompt = null;
      this.showToast('🎉 PWA ZAINSTALOWANE');
    });
  }

  promptPWAInstall() {
    if (this.deferredInstallPrompt) {
      this.deferredInstallPrompt.prompt();
      this.deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.btnInstallPWA.style.display = 'none';
        }
        this.deferredInstallPrompt = null;
      });
    } else {
      this.showToast(t('installPrompt', this.currentLang));
    }
  }
}
