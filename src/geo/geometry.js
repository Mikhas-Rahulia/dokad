/**
 * Geospatial computations: Ray-casting Point-in-Polygon,
 * Bounding Box extraction, random point sampling, and Haversine distance.
 */

/**
 * Checks if a point [lng, lat] is inside a GeoJSON Polygon ring (array of coordinates).
 * Uses ray-casting algorithm.
 * @param {[number, number]} point [lng, lat]
 * @param {Array<[number, number]>} ring Array of [lng, lat]
 * @returns {boolean}
 */
export function pointInRing(point, ring) {
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks if a point is inside a single GeoJSON Polygon (outer boundary minus inner holes).
 * @param {[number, number]} point [lng, lat]
 * @param {Array<Array<[number, number]>>} polygonCoords Array of linear rings
 * @returns {boolean}
 */
export function pointInPolygonGeometry(point, polygonCoords) {
  if (!polygonCoords || polygonCoords.length === 0) return false;
  // Outer ring
  const inOuter = pointInRing(point, polygonCoords[0]);
  if (!inOuter) return false;

  // Inner rings (holes)
  for (let i = 1; i < polygonCoords.length; i++) {
    if (pointInRing(point, polygonCoords[i])) {
      return false; // Inside a hole
    }
  }

  return true;
}

/**
 * Checks if a point [lng, lat] is inside a GeoJSON Polygon or MultiPolygon.
 * @param {[number, number]} point [lng, lat]
 * @param {Object} geojson GeoJSON geometry or Feature
 * @returns {boolean}
 */
export function isPointInCity(point, geojson) {
  if (!geojson) return false;
  const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;

  if (geometry.type === 'Polygon') {
    return pointInPolygonGeometry(point, geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInPolygonGeometry(point, poly)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * Computes bounding box [minLng, minLat, maxLng, maxLat] from GeoJSON
 * @param {Object} geojson
 * @returns {[number, number, number, number]}
 */
export function getBoundingBox(geojson) {
  const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function updateBounds(coord) {
    const lng = coord[0];
    const lat = coord[1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  function traverse(coords) {
    if (typeof coords[0] === 'number') {
      updateBounds(coords);
    } else {
      coords.forEach(traverse);
    }
  }

  traverse(geometry.coordinates);
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Generates a random point [lat, lng] strictly within the city's polygon boundaries.
 * @param {Object} geojson GeoJSON Polygon or MultiPolygon
 * @param {number} maxAttempts Maximum rejection sampling attempts
 * @returns {{lat: number, lng: number}}
 */
export function getRandomPointInCity(geojson, maxAttempts = 2000) {
  const bbox = getBoundingBox(geojson);
  const [minLng, minLat, maxLng, maxLat] = bbox;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randLng = minLng + Math.random() * (maxLng - minLng);
    const randLat = minLat + Math.random() * (maxLat - minLat);
    const point = [randLng, randLat];

    if (isPointInCity(point, geojson)) {
      return { lat: randLat, lng: randLng };
    }
  }

  // Fallback: Return center if sampling fails
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2
  };
}

/**
 * Calculates geodesic distance between two points using the Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determines travel mode based on distance threshold.
 * If distance < 5 km -> walking
 * If distance >= 5 km -> transit
 * @param {number} distKm
 * @returns {'walking' | 'transit'}
 */
export function getTravelMode(distKm) {
  return distKm < 5.0 ? 'walking' : 'transit';
}

/**
 * Formats distance nicely in local units
 * @param {number} distKm
 * @param {string} lang
 * @returns {string}
 */
export function formatDistance(distKm, lang = 'ru') {
  if (distKm === null || isNaN(distKm)) return '—';
  
  if (distKm < 1.0) {
    const meters = Math.round(distKm * 1000);
    switch (lang) {
      case 'pl': return `${meters} m`;
      case 'be': return `${meters} м`;
      case 'nl': return `${meters} m`;
      case 'en': return `${meters} m (${Math.round(meters * 3.28084)} ft)`;
      case 'ru':
      default:
        return `${meters} м`;
    }
  }

  const rounded = distKm < 10 ? distKm.toFixed(1) : Math.round(distKm).toString();
  switch (lang) {
    case 'pl': return `${rounded} km`;
    case 'be': return `${rounded} км`;
    case 'nl': return `${rounded} km`;
    case 'en': return `${rounded} km (${(distKm * 0.621371).toFixed(1)} mi)`;
    case 'ru':
    default:
      return `${rounded} км`;
  }
}

/**
 * Generates Google Maps routing URL.
 * @param {number|null} originLat
 * @param {number|null} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @param {'walking' | 'transit'} mode
 * @returns {string}
 */
export function getGoogleMapsUrl(originLat, originLng, destLat, destLng, mode = 'walking') {
  const travelParam = mode === 'walking' ? 'walking' : 'transit';
  if (originLat !== null && originLng !== null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat.toFixed(6)},${originLng.toFixed(6)}&destination=${destLat.toFixed(6)},${destLng.toFixed(6)}&travelmode=${travelParam}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat.toFixed(6)},${destLng.toFixed(6)}&travelmode=${travelParam}`;
}

/**
 * Generates direct Jakdojade routing URL for Poland.
 * Uses query format `?fc=lat:lng&tc=lat:lng` with coordinate indicators so Jakdojade
 * immediately starts route calculation upon opening.
 * @param {number|null} originLat
 * @param {number|null} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @param {string} citySlug
 * @returns {string}
 */
export function getJakdojadeUrl(originLat, originLng, destLat, destLng, citySlug = 'krakow') {
  const slug = (citySlug || 'krakow').toLowerCase().replace(/[\s_]+/g, '-');
  const dLat = destLat.toFixed(5);
  const dLng = destLng.toFixed(5);
  
  if (originLat !== null && originLng !== null) {
    const oLat = originLat.toFixed(5);
    const oLng = originLng.toFixed(5);
    return `https://jakdojade.pl/${slug}/trasa?fc=${oLat}:${oLng}&tc=${dLat}:${dLng}&ft=LOCATION_TYPE_COORDINATE&tt=LOCATION_TYPE_COORDINATE&fn=Start&tn=Cel&t=1`;
  }
  
  return `https://jakdojade.pl/${slug}/trasa?tc=${dLat}:${dLng}&tt=LOCATION_TYPE_COORDINATE&tn=Cel&t=1`;
}

/**
 * Generates Apple Maps URL
 * @param {number} destLat
 * @param {number} destLng
 * @param {'walking' | 'transit'} mode
 * @returns {string}
 */
export function getAppleMapsUrl(destLat, destLng, mode = 'walking') {
  const dirFlag = mode === 'walking' ? 'w' : 'r';
  return `https://maps.apple.com/?daddr=${destLat.toFixed(6)},${destLng.toFixed(6)}&dirflg=${dirFlag}`;
}

/**
 * Generates Yandex Maps URL (strictly for Belarus & Russia)
 * @param {number|null} originLat
 * @param {number|null} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @param {'walking' | 'transit'} mode
 * @returns {string}
 */
export function getYandexMapsUrl(originLat, originLng, destLat, destLng, mode = 'walking') {
  const rtext = originLat !== null && originLng !== null
    ? `~${originLat.toFixed(6)},${originLng.toFixed(6)}~${destLat.toFixed(6)},${destLng.toFixed(6)}`
    : `~${destLat.toFixed(6)},${destLng.toFixed(6)}`;
  const rtt = mode === 'walking' ? 'pd' : 'mt';
  return `https://yandex.ru/maps/?rtext=${rtext}&rtt=${rtt}`;
}
