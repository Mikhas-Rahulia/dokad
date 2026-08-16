import confetti from 'canvas-confetti';
import { t } from '../i18n/translations.js';
import {
  getRandomPointInCity,
  calculateHaversineDistance,
  formatDistance,
  getTravelMode,
  getGoogleMapsUrl,
  getAppleMapsUrl,
  getYandexMapsUrl
} from '../geo/geometry.js';

export class AppUI {
  constructor({ cityService, mapController }) {
    this.cityService = cityService;
    this.map = mapController;
    
    this.currentCity = this.cityService.currentCity;
    this.currentLang = this.currentCity.lang || 'pl';
    this.userLocation = null;
    this.simulateCenter = this.cityService.getSimulateCenterMode();
    this.currentDestination = null;
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
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.themeIcon = document.getElementById('theme-icon');
    this.btnInfo = document.getElementById('btn-info');
    this.btnInstallPWA = document.getElementById('btn-install-pwa');

    // Map controls
    this.btnLocateMe = document.getElementById('btn-locate-me');
    this.btnRecenterCity = document.getElementById('btn-recenter-city');

    // Bottom Action / Roll
    this.btnRollMain = document.getElementById('btn-roll-main');
    this.btnRollText = document.getElementById('btn-roll-text');
    this.resultCard = document.getElementById('result-card');
    this.distBadge = document.getElementById('dist-badge');
    this.boundaryBadge = document.getElementById('boundary-badge');
    this.destinationAddress = document.getElementById('destination-address');
    this.destinationCoords = document.getElementById('destination-coords');
    this.distLabel = document.getElementById('dist-label');
    this.distValue = document.getElementById('dist-value');
    this.btnRoutePrimary = document.getElementById('btn-route-primary');
    this.routeIcon = document.getElementById('route-icon');
    this.routeText = document.getElementById('route-text');
    this.btnCopyCoords = document.getElementById('btn-copy-coords');
    this.copyText = document.getElementById('copy-text');
    this.btnAppleMaps = document.getElementById('btn-apple-maps');
    this.btnYandexMaps = document.getElementById('btn-yandex-maps');

    // Simulation toggle & GPS status
    this.toggleSimulateCenter = document.getElementById('toggle-simulate-center');
    this.simulateLabel = document.getElementById('simulate-label');
    this.gpsStatusIndicator = document.getElementById('gps-status-indicator');

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

    // Roll spot action
    this.btnRollMain.addEventListener('click', () => this.rollRandomSpot());

    // Copy coords
    this.btnCopyCoords.addEventListener('click', () => this.copyCoordinates());

    // Simulation toggle
    this.toggleSimulateCenter.checked = this.simulateCenter;
    this.toggleSimulateCenter.addEventListener('change', (e) => {
      this.simulateCenter = e.target.checked;
      this.cityService.setSimulateCenterMode(this.simulateCenter);
      this.showToast(this.simulateCenter ? '📍 Tryb testowy: start w centrum miasta' : '🎯 GPS aktywny');
      if (this.currentDestination) {
        this.updateDestinationDistances();
      }
    });

    // City search
    this.citySearchBtn.addEventListener('click', () => this.handleCitySearch());
    this.citySearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCitySearch();
    });

    // PWA install button
    this.btnInstallPWA.addEventListener('click', () => this.promptPWAInstall());
  }

  initGeolocation() {
    if (!navigator.geolocation) {
      this.gpsStatusIndicator.textContent = '● GPS brak';
      this.gpsStatusIndicator.style.color = 'var(--text-muted)';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        this.map.setUserLocation(this.userLocation.lat, this.userLocation.lng);
        this.gpsStatusIndicator.textContent = '● GPS OK';
        this.gpsStatusIndicator.style.color = 'var(--accent-walking)';
      },
      (err) => {
        console.warn('Geolocation denied/error:', err.message);
        this.gpsStatusIndicator.textContent = '● GPS off';
        this.gpsStatusIndicator.style.color = 'var(--text-muted)';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  centerOnUser() {
    if (this.userLocation) {
      this.map.map.flyTo([this.userLocation.lat, this.userLocation.lng], 15, { animate: true });
    } else {
      this.showToast(t('gpsLocating', this.currentLang));
      this.initGeolocation();
    }
  }

  loadInitialCity() {
    this.selectCity(this.currentCity, false);
  }

  selectCity(city, shouldAnimate = true) {
    this.currentCity = city;
    this.cityService.setCurrentCity(city);
    this.currentLang = city.lang || 'pl';

    // Update Header
    this.headerCityFlag.textContent = city.flag || '📍';
    this.headerCityName.textContent = city.nativeName || city.name;
    document.title = `${city.nativeName || city.name} — ${t('appTitle', this.currentLang)}`;

    // Update Language UI
    this.updateLanguageUI();

    // Update Map
    this.map.setCityBoundary(city);

    // Reset result card for new city
    this.resultCard.style.display = 'none';
    this.currentDestination = null;

    this.closeCityModal();
  }

  updateLanguageUI() {
    const lang = this.currentLang;

    // Headings and labels
    this.btnRollText.textContent = t('rollButton', lang);
    this.cityModalTitle.textContent = t('cityPromptTitle', lang);
    this.cityModalSubtitle.textContent = t('cityPromptSubtitle', lang);
    this.citySearchInput.placeholder = t('searchPlaceholder', lang);
    this.citySearchBtn.textContent = t('searchButton', lang);
    this.featuredCitiesLabel.textContent = t('featuredCities', lang);
    this.distLabel.textContent = t('distanceLabel', lang);
    this.copyText.textContent = t('copyCoords', lang);
    this.simulateLabel.textContent = t('simulateCenterToggle', lang);
    this.boundaryBadge.textContent = `🛡️ ${t('boundaryInfo', lang)}`;

    // Render city selector grid
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

  async handleCitySearch() {
    const query = this.citySearchInput.value.trim();
    if (!query) return;

    this.searchStatusMsg.style.display = 'block';
    this.searchStatusMsg.textContent = '🔍 Szukanie granic miasta w OpenStreetMap...';

    try {
      const city = await this.cityService.searchAndFetchCity(query);
      this.searchStatusMsg.style.display = 'none';
      this.citySearchInput.value = '';
      this.selectCity(city);
      this.showToast(`✨ ${city.nativeName} dodano!`);
    } catch (err) {
      this.searchStatusMsg.style.display = 'block';
      this.searchStatusMsg.textContent = `❌ ${err.message || 'Nie znaleziono miasta'}`;
    }
  }

  /**
   * Rolls a random point strictly within city boundaries!
   */
  async rollRandomSpot() {
    if (!this.currentCity || !this.currentCity.geojson) {
      this.showToast('Błąd: brak granic miasta');
      return;
    }

    // Button animation & Haptic
    this.btnRollMain.classList.add('rolling');
    this.btnRollText.textContent = t('rolling', this.currentLang);
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 40, 20]);
    }

    // Heavy client-side Point-In-Polygon calculation
    const point = getRandomPointInCity(this.currentCity.geojson);
    this.currentDestination = point;

    // Place marker on map with flight animation
    this.map.setTargetPoint(point.lat, point.lng, `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);

    // Confetti celebration burst
    this.triggerConfetti();

    // Update Distance and Routing UI
    this.updateDestinationDistances();

    // Show Card
    this.resultCard.style.display = 'flex';
    this.destinationCoords.textContent = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
    this.destinationAddress.textContent = t('calculatingAddress', this.currentLang);

    // Asynchronously reverse geocode address
    this.cityService.reverseGeocode(point.lat, point.lng, this.currentLang).then(address => {
      this.destinationAddress.textContent = address;
    });

    // Reset button state
    setTimeout(() => {
      this.btnRollMain.classList.remove('rolling');
      this.btnRollText.textContent = t('rollButton', this.currentLang);
    }, 450);
  }

  updateDestinationDistances() {
    if (!this.currentDestination) return;

    const point = this.currentDestination;
    const origin = this.getEffectiveOrigin();

    // Calculate distance
    let distKm = 0;
    if (origin) {
      distKm = calculateHaversineDistance(origin.lat, origin.lng, point.lat, point.lng);
      this.map.drawRouteLine(origin.lat, origin.lng, point.lat, point.lng);
    } else {
      // Distance from city center
      const [cLat, cLng] = this.currentCity.center || [point.lat, point.lng];
      distKm = calculateHaversineDistance(cLat, cLng, point.lat, point.lng);
    }

    const mode = getTravelMode(distKm);
    const isWalking = mode === 'walking';

    // Update Distance badge (<5km walking vs >=5km transit)
    this.distValue.textContent = formatDistance(distKm, this.currentLang);
    this.distBadge.className = `distance-badge ${mode}`;
    this.distBadge.textContent = isWalking
      ? t('distanceUnder5kmBadge', this.currentLang)
      : t('distanceOver5kmBadge', this.currentLang);

    // Update Primary Route Button (Walking vs Public Transit)
    this.btnRoutePrimary.className = `btn-nav-primary ${mode}`;
    this.routeIcon.textContent = isWalking ? '🚶' : '🚌';
    this.routeText.textContent = isWalking
      ? t('routeButtonWalking', this.currentLang)
      : t('routeButtonTransit', this.currentLang);

    // Set URLs
    const googleUrl = getGoogleMapsUrl(
      origin ? origin.lat : null,
      origin ? origin.lng : null,
      point.lat,
      point.lng,
      mode
    );
    this.btnRoutePrimary.href = googleUrl;

    this.btnAppleMaps.href = getAppleMapsUrl(point.lat, point.lng, mode);
    this.btnYandexMaps.href = getYandexMapsUrl(
      origin ? origin.lat : null,
      origin ? origin.lng : null,
      point.lat,
      point.lng,
      mode
    );
  }

  getEffectiveOrigin() {
    if (this.simulateCenter) {
      const [cLat, cLng] = this.currentCity.center || [50.0647, 19.9450];
      return { lat: cLat, lng: cLng };
    }
    return this.userLocation;
  }

  copyCoordinates() {
    if (!this.currentDestination) return;
    const text = `${this.currentDestination.lat.toFixed(6)}, ${this.currentDestination.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(`📋 ${t('coordsCopied', this.currentLang)}: ${text}`);
      if ('vibrate' in navigator) navigator.vibrate(15);
    });
  }

  triggerConfetti() {
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 },
        colors: ['#4f46e5', '#10b981', '#38bdf8', '#f59e0b']
      });
    } catch {}
  }

  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
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
      this.showToast('🎉 ' + t('offlineReady', this.currentLang));
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
