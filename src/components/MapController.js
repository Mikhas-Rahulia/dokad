import { Map, Marker, Popup, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function createGeoJSONCircle(lat, lng, radiusMeters = 20, points = 32) {
  const coords = [];
  const km = Math.max(5, Math.min(radiusMeters, 500)) / 1000;
  const distanceX = km / (111.32 * Math.cos(lat * Math.PI / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    properties: {}
  };
}

export class MapController {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.boundarySourceId = 'city-boundary';
    this.accuracySourceId = 'user-accuracy';
    this.userMarker = null;
    this.spotMarkers = [];
    this.routeSourceId = 'walk-route';
    this.isDark = false;

    this.initMap();
  }

  initMap() {
    this.map = new Map({
      container: this.containerId,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>'
          }
        },
        layers: [{
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19
        }]
      },
      center: [19.9450, 50.0647],
      zoom: 12,
      minZoom: 3,
      maxZoom: 19,
      pitchWithRotate: false,
      dragRotate: false,
      fadeDuration: 0,
      trackResize: true,
      attributionControl: false,
      touchZoomRotate: true
    });

    this.map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    // Wait for style to load before adding dynamic sources
    this.map.on('style.load', () => {
      this._addDynamicSources();
    });
  }

  _addDynamicSources() {
    // Boundary source
    if (!this.map.getSource(this.boundarySourceId)) {
      this.map.addSource(this.boundarySourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      this.map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: this.boundarySourceId,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.08
        }
      });
      this.map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: this.boundarySourceId,
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.85,
          'line-dasharray': [3, 3]
        }
      });
    }

    // Accuracy circle source
    if (!this.map.getSource(this.accuracySourceId)) {
      this.map.addSource(this.accuracySourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      this.map.addLayer({
        id: 'accuracy-fill',
        type: 'fill',
        source: this.accuracySourceId,
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.12
        }
      });
      this.map.addLayer({
        id: 'accuracy-line',
        type: 'line',
        source: this.accuracySourceId,
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.5,
          'line-opacity': 0.5
        }
      });
    }

    // Route polyline source
    if (!this.map.getSource(this.routeSourceId)) {
      this.map.addSource(this.routeSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: this.routeSourceId,
        paint: {
          'line-color': '#4f46e5',
          'line-width': 3,
          'line-opacity': 0.85,
          'line-dasharray': [4, 4]
        }
      });
    }
  }

  setCityBoundary(city) {
    this.clearTourMarkers();

    if (!city.geojson) {
      const center = city.center || [50.0647, 19.9450];
      this.map.flyTo({ center: [center[1], center[0]], zoom: 12, duration: 1200 });
      return;
    }

    const src = this.map.getSource(this.boundarySourceId);
    if (src) {
      const geojson = city.geojson.type === 'Feature' ? city.geojson : { type: 'Feature', geometry: city.geojson, properties: {} };
      src.setData(geojson);
    }

    // Calculate bounds from geojson
    const bounds = this._getBoundsFromGeoJSON(city.geojson);
    if (bounds) {
      this.map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 1200 });
    }
  }

  _getBoundsFromGeoJSON(geojson) {
    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
    let coords = [];

    const extractCoords = (c) => {
      if (typeof c[0] === 'number') {
        coords.push(c);
      } else {
        c.forEach(extractCoords);
      }
    };

    extractCoords(geometry.coordinates);

    if (coords.length === 0) return null;

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    return [[minLng, minLat], [maxLng, maxLat]];
  }

  clearTourMarkers() {
    this.spotMarkers.forEach(m => m.remove());
    this.spotMarkers = [];

    const routeSrc = this.map.getSource(this.routeSourceId);
    if (routeSrc) {
      routeSrc.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  setUserLocation(lat, lng, accuracy = 20) {
    // Update Marker
    if (this.userMarker) {
      this.userMarker.setLngLat([lng, lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'custom-user-marker-container';
      el.innerHTML = `
        <div class="user-beacon-halo"></div>
        <div class="user-dot"></div>
      `;

      this.userMarker = new Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(this.map);
    }

    // Update Accuracy Circle
    const accuracySrc = this.map.getSource(this.accuracySourceId);
    if (accuracySrc) {
      const circleGeoJSON = createGeoJSONCircle(lat, lng, accuracy);
      accuracySrc.setData(circleGeoJSON);
    }
  }

  renderDailySpotsAndRoute(origin, spots, onCheckInCallback = null) {
    this.clearTourMarkers();
    if (!spots || spots.length === 0) return;

    // Draw closed loop route: origin → spot1 → spot2 → spot3 → origin (Point 4)
    const routeCoords = [
      [origin.lng, origin.lat],
      ...spots.map(s => [s.lng, s.lat]),
      [origin.lng, origin.lat]
    ];

    const routeSrc = this.map.getSource(this.routeSourceId);
    if (routeSrc) {
      routeSrc.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: routeCoords },
        properties: {}
      });
    }

    // Add spot markers
    spots.forEach((spot, idx) => {
      const isCheckedIn = !!spot.checkedIn;
      const markerClass = isCheckedIn ? 'spot-pin checked-in' : 'spot-pin pending';
      const label = isCheckedIn ? '✔' : `${spot.step || idx + 1}`;

      const el = document.createElement('div');
      el.className = 'custom-spot-marker-container';
      el.innerHTML = `<div class="${markerClass}"><span class="spot-pin-number">${label}</span></div>`;

      const popup = new Popup({ closeButton: false, className: 'custom-map-popup', offset: [0, -20] });

      const popupHtml = `
        <div class="spot-popup-content">
          <div class="popup-title">🎯 SPOT #${spot.step || idx + 1}</div>
          <div class="popup-coords">${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}</div>
          <div class="popup-status">${isCheckedIn ? '✅ VISITED' : '📍 IN CITY BOUNDS'}</div>
        </div>
      `;
      popup.setHTML(popupHtml);

      const marker = new Marker({ element: el })
        .setLngLat([spot.lng, spot.lat])
        .setPopup(popup)
        .addTo(this.map);

      if (!isCheckedIn && onCheckInCallback) {
        el.addEventListener('click', () => onCheckInCallback(idx));
      }

      this.spotMarkers.push(marker);
    });

    // Fit map bounds to show entire tour
    const allCoords = [[origin.lng, origin.lat], ...spots.map(s => [s.lng, s.lat])];
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of allCoords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    this.map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: 60,
      maxZoom: 15,
      duration: 1000
    });
  }

  recenter() {
    const src = this.map.getSource(this.boundarySourceId);
    if (src && src._data && src._data.type !== 'FeatureCollection') {
      const bounds = this._getBoundsFromGeoJSON(src._data);
      if (bounds) {
        this.map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 800 });
      }
    }
  }

  recenterUser() {
    if (this.userMarker) {
      const lngLat = this.userMarker.getLngLat();
      this.map.flyTo({ center: lngLat, zoom: 16, duration: 800 });
    }
  }
}
