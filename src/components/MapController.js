import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class MapController {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.userMarker = null;
    this.radiusCircle = null;
    this.spotMarkers = [];
    this.routePolyline = null;
    this.tileLayer = null;

    this.initMap();
  }

  initMap() {
    // Leaflet icon bundler fix
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Default view: Center on Krakow or sensible default until GPS locates
    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: true,
      zoomAnimation: true,
      minZoom: 3,
      maxZoom: 19
    }).setView([50.0647, 19.9450], 14);

    L.control.attribution({
      position: 'bottomright',
      prefix: false
    }).addAttribution('&copy; <a href="https://openstreetmap.org" target="_blank">OSM</a> | CartoDB').addTo(this.map);

    this.setDarkTiles();
  }

  setDarkTiles() {
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }
    // High-contrast clean dark voyager tiles for retro-pixel aesthetic
    this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);
  }

  /**
   * Sets user GPS marker and 2km perimeter circle.
   * @param {number} lat
   * @param {number} lng
   * @param {boolean} updateCircle
   */
  setUserLocation(lat, lng, updateCircle = true) {
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

    if (updateCircle && !this.radiusCircle) {
      this.set2KmRadius(lat, lng);
    }
  }

  /**
   * Renders the 2km boundary circle around origin.
   * @param {number} lat
   * @param {number} lng
   */
  set2KmRadius(lat, lng) {
    if (this.radiusCircle) {
      this.map.removeLayer(this.radiusCircle);
    }

    this.radiusCircle = L.circle([lat, lng], {
      radius: 2000,
      color: '#3b82f6',
      weight: 2,
      opacity: 0.8,
      dashArray: '6, 6',
      fillColor: '#3b82f6',
      fillOpacity: 0.06
    }).addTo(this.map);
  }

  /**
   * Renders the 3 daily spots and connecting optimal route line.
   * @param {{lat: number, lng: number}} origin
   * @param {Array<{lat: number, lng: number, step: number, checkedIn: boolean}>} spots
   * @param {Function} onCheckInCallback
   */
  renderDailySpotsAndRoute(origin, spots, onCheckInCallback = null) {
    // Clear old spot markers
    this.spotMarkers.forEach(m => this.map.removeLayer(m));
    this.spotMarkers = [];

    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }

    if (!spots || spots.length === 0) return;

    // Draw connecting route: origin -> spot1 -> spot2 -> spot3
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

    // Create markers for each spot
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

      const marker = L.marker([spot.lat, lngToFloat(spot.lng)], {
        icon,
        zIndexOffset: 800 + idx
      }).addTo(this.map);

      // Bind click popup with checkin status
      const popupContent = document.createElement('div');
      popupContent.className = 'spot-popup-content';
      popupContent.innerHTML = `
        <div class="popup-title">🎯 SPOT #${spot.step || idx + 1}</div>
        <div class="popup-coords">${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}</div>
        <div class="popup-status">${isCheckedIn ? '✅ ARRIVED (CHECKED IN)' : '📍 WITHIN 2 KM'}</div>
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

    // Fit map bounds to show whole tour
    const allCoords = [[origin.lat, origin.lng], ...spots.map(s => [s.lat, s.lng])];
    const bounds = L.latLngBounds(allCoords);
    this.map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 15,
      animate: true,
      duration: 1.0
    });
  }

  recenter(lat, lng) {
    if (lat !== undefined && lng !== undefined) {
      this.map.flyTo([lat, lng], 14, { animate: true });
    } else if (this.userMarker) {
      this.map.flyTo(this.userMarker.getLatLng(), 15, { animate: true });
    }
  }
}

function lngToFloat(val) {
  return typeof val === 'number' ? val : parseFloat(val);
}
