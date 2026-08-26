import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class MapController {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.boundaryLayer = null;
    this.userMarker = null;
    this.spotMarkers = [];
    this.routePolyline = null;
    this.tileLayer = null;
    this.isDark = false;

    this.initMap();
  }

  initMap() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: true,
      zoomAnimation: true,
      minZoom: 3,
      maxZoom: 19
    }).setView([50.0647, 19.9450], 12);

    L.control.attribution({
      position: 'bottomright',
      prefix: false
    }).addAttribution('&copy; <a href="https://openstreetmap.org" target="_blank">OSM</a> | CartoDB').addTo(this.map);

    this.setTileTheme(this.isDark);
  }

  setTileTheme(isDark = false) {
    this.isDark = isDark;
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    this.tileLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);
  }

  /**
   * Sets city boundary polygon and centers map.
   * @param {Object} city
   */
  setCityBoundary(city) {
    if (this.boundaryLayer) {
      this.map.removeLayer(this.boundaryLayer);
      this.boundaryLayer = null;
    }

    this.clearTourMarkers();

    if (!city.geojson) {
      this.map.setView(city.center || [50.0647, 19.9450], 12);
      return;
    }

    const boundaryStyle = {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.85,
      dashArray: '6, 6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08
    };

    this.boundaryLayer = L.geoJSON(city.geojson, {
      style: boundaryStyle
    }).addTo(this.map);

    const bounds = this.boundaryLayer.getBounds();
    this.map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 13,
      animate: true,
      duration: 1.2
    });
  }

  clearTourMarkers() {
    this.spotMarkers.forEach(m => this.map.removeLayer(m));
    this.spotMarkers = [];

    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
  }

  setUserLocation(lat, lng) {
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      const userIcon = L.divIcon({
        className: 'custom-user-marker-container',
        html: `
          <div class="user-beacon-halo"></div>
          <div class="user-dot"></div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      this.userMarker = L.marker([lat, lng], {
        icon: userIcon,
        zIndexOffset: 1000
      }).addTo(this.map);
    }
  }

  /**
   * Renders the 3 daily spots and connecting optimal route line.
   * @param {{lat: number, lng: number}} origin
   * @param {Array<{lat: number, lng: number, step: number, checkedIn: boolean}>} spots
   * @param {Function} onCheckInCallback
   */
  renderDailySpotsAndRoute(origin, spots, onCheckInCallback = null) {
    this.clearTourMarkers();

    if (!spots || spots.length === 0) return;

    // Draw route: origin -> spot1 -> spot2 -> spot3
    const routeCoords = [
      [origin.lat, origin.lng],
      ...spots.map(s => [s.lat, s.lng])
    ];

    this.routePolyline = L.polyline(routeCoords, {
      color: '#4f46e5',
      weight: 3,
      opacity: 0.85,
      dashArray: '8, 8'
    }).addTo(this.map);

    spots.forEach((spot, idx) => {
      const isCheckedIn = !!spot.checkedIn;
      const markerClass = isCheckedIn ? 'spot-pin checked-in' : 'spot-pin pending';
      const label = isCheckedIn ? '✔' : `${spot.step || idx + 1}`;

      const icon = L.divIcon({
        className: 'custom-spot-marker-container',
        html: `
          <div class="${markerClass}">
            <span class="spot-pin-number">${label}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
      });

      const marker = L.marker([spot.lat, spot.lng], {
        icon,
        zIndexOffset: 800 + idx
      }).addTo(this.map);

      const popupContent = document.createElement('div');
      popupContent.className = 'spot-popup-content';
      popupContent.innerHTML = `
        <div class="popup-title">🎯 SPOT #${spot.step || idx + 1}</div>
        <div class="popup-coords">${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}</div>
        <div class="popup-status">${isCheckedIn ? '✅ VISITED' : '📍 IN CITY BOUNDS'}</div>
      `;

      if (!isCheckedIn && onCheckInCallback) {
        const btn = document.createElement('button');
        btn.className = 'pixel-btn pixel-btn-sm popup-checkin-btn';
        btn.textContent = '📍 CHECK IN';
        btn.addEventListener('click', () => {
          onCheckInCallback(idx);
          marker.closePopup();
        });
        popupContent.appendChild(btn);
      }

      marker.bindPopup(popupContent, {
        closeButton: false,
        className: 'custom-map-popup'
      });

      this.spotMarkers.push(marker);
    });

    // Fit map bounds to show tour
    const allCoords = [[origin.lat, origin.lng], ...spots.map(s => [s.lat, s.lng])];
    const bounds = L.latLngBounds(allCoords);
    this.map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 15,
      animate: true,
      duration: 1.0
    });
  }

  recenter() {
    if (this.boundaryLayer) {
      this.map.fitBounds(this.boundaryLayer.getBounds(), {
        padding: [40, 40],
        maxZoom: 13,
        animate: true
      });
    }
  }

  recenterUser() {
    if (this.userMarker) {
      this.map.flyTo(this.userMarker.getLatLng(), 15, { animate: true });
    }
  }
}
