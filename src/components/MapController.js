import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class MapController {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.map = null;
    this.boundaryLayer = null;
    this.targetMarker = null;
    this.userMarker = null;
    this.routeLine = null;
    this.tileLayer = null;
    this.isDark = false;

    this.initMap();
  }

  initMap() {
    // Standard Leaflet icon fix for bundlers
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
      minZoom: 4,
      maxZoom: 19
    }).setView([50.0647, 19.9450], 12);

    // Add clean attribution in corner
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
   * Sets and renders city polygon boundaries on the map.
   * @param {Object} city
   */
  setCityBoundary(city) {
    if (this.boundaryLayer) {
      this.map.removeLayer(this.boundaryLayer);
      this.boundaryLayer = null;
    }

    if (this.targetMarker) {
      this.map.removeLayer(this.targetMarker);
      this.targetMarker = null;
    }

    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

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

  /**
   * Animates map and places a marker at the chosen target point.
   * @param {number} lat
   * @param {number} lng
   * @param {string} title
   */
  setTargetPoint(lat, lng, title = '') {
    if (this.targetMarker) {
      this.map.removeLayer(this.targetMarker);
    }

    const targetIcon = L.divIcon({
      className: 'custom-target-marker-container',
      html: `
        <div class="target-pulse-wave"></div>
        <div class="target-marker-pin">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="white" stroke="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 42],
      popupAnchor: [0, -42]
    });

    this.targetMarker = L.marker([lat, lng], {
      icon: targetIcon,
      zIndexOffset: 1000
    }).addTo(this.map);

    if (title) {
      this.targetMarker.bindPopup(`<b>${title}</b>`, {
        closeButton: false,
        className: 'custom-map-popup'
      });
    }

    this.map.flyTo([lat, lng], Math.max(this.map.getZoom(), 14), {
      duration: 1.4,
      easeLinearity: 0.25
    });
  }

  /**
   * Renders the user's current GPS position marker.
   * @param {number} lat
   * @param {number} lng
   * @param {number|null} accuracy
   */
  setUserLocation(lat, lng, accuracy = null) {
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    const userIcon = L.divIcon({
      className: 'custom-user-marker-container',
      html: `
        <div class="user-beacon-halo"></div>
        <div class="user-dot"></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.userMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 900
    }).addTo(this.map);
  }

  /**
   * Draws a direct connection dashed arc between user and target
   */
  drawRouteLine(userLat, userLng, targetLat, targetLng) {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

    const lineCoords = [
      [userLat, userLng],
      [targetLat, targetLng]
    ];

    this.routeLine = L.polyline(lineCoords, {
      color: '#6366f1',
      weight: 3,
      opacity: 0.75,
      dashArray: '8, 8'
    }).addTo(this.map);
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

  recenterTarget() {
    if (this.targetMarker) {
      this.map.setView(this.targetMarker.getLatLng(), 15, { animate: true });
    }
  }
}
