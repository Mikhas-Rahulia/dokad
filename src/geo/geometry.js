/**
 * Geospatial computations: Ray-casting Point-in-Polygon,
 * 1.5 km square boundary sampling, closed-loop TSP optimal route solver (with return to start),
 * 21m proximity arrival check, and Google Maps walking navigation URLs.
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
      return {
        lat: Number(randLat.toFixed(6)),
        lng: Number(randLng.toFixed(6))
      };
    }
  }

  // Fallback: Return center if sampling fails
  return {
    lat: Number(((minLat + maxLat) / 2).toFixed(6)),
    lng: Number(((minLng + maxLng) / 2).toFixed(6))
  };
}

/**
 * Generates 3 random spots strictly inside city boundaries with spacing.
 * @param {Object} geojson
 * @param {number} count (default 3)
 * @returns {Array<{lat: number, lng: number, id: string}>}
 */
export function generate3SpotsInCity(geojson, count = 3) {
  const spots = [];
  const maxAttempts = 1000;
  let attempts = 0;

  while (spots.length < count && attempts < maxAttempts) {
    attempts++;
    const pt = getRandomPointInCity(geojson);
    // Ensure not too close to previous spots (at least 150m)
    const tooClose = spots.some(s => calculateHaversineDistance(s.lat, s.lng, pt.lat, pt.lng) * 1000 < 150);
    if (!tooClose || attempts > 500) {
      spots.push({
        lat: pt.lat,
        lng: pt.lng,
        id: `spot_${spots.length + 1}_${Date.now()}`
      });
    }
  }

  while (spots.length < count) {
    const pt = getRandomPointInCity(geojson);
    spots.push({
      lat: pt.lat,
      lng: pt.lng,
      id: `spot_${spots.length + 1}_${Date.now()}`
    });
  }

  return spots;
}

/**
 * Generates uniformly distributed random points strictly within a 1.5 km square (1.5 x 1.5 km) centered on (centerLat, centerLng).
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} sideKm (default 1.5 km)
 * @param {number} count (default 3)
 * @param {number} minDistanceBetweenMeters (default 150m)
 * @returns {Array<{lat: number, lng: number, id: string}>}
 */
export function generateRandomSpotsInSquare(centerLat, centerLng, sideKm = 1.5, count = 3, minDistanceBetweenMeters = 150) {
  const spots = [];
  const maxAttempts = 1000;
  let attempts = 0;

  const halfSideKm = sideKm / 2; // 0.75 km from center
  const dLatMax = halfSideKm / 111.32;
  const dLngMax = halfSideKm / (111.32 * Math.cos(centerLat * (Math.PI / 180)));

  while (spots.length < count && attempts < maxAttempts) {
    attempts++;
    const offsetLat = (Math.random() * 2 - 1) * dLatMax;
    const offsetLng = (Math.random() * 2 - 1) * dLngMax;

    const candidate = {
      lat: Number((centerLat + offsetLat).toFixed(6)),
      lng: Number((centerLng + offsetLng).toFixed(6))
    };

    const distToCenter = calculateHaversineDistance(centerLat, centerLng, candidate.lat, candidate.lng);
    if (distToCenter * 1000 < minDistanceBetweenMeters) continue;

    const tooClose = spots.some(existing => {
      const d = calculateHaversineDistance(existing.lat, existing.lng, candidate.lat, candidate.lng);
      return d * 1000 < minDistanceBetweenMeters;
    });

    if (!tooClose) {
      spots.push({
        ...candidate,
        id: `spot_${spots.length + 1}_${Date.now()}`
      });
    }
  }

  while (spots.length < count) {
    const offsetLat = (Math.random() * 2 - 1) * dLatMax;
    const offsetLng = (Math.random() * 2 - 1) * dLngMax;
    spots.push({
      lat: Number((centerLat + offsetLat).toFixed(6)),
      lng: Number((centerLng + offsetLng).toFixed(6)),
      id: `spot_${spots.length + 1}_${Date.now()}`
    });
  }

  return spots;
}

/**
 * Backward compatibility alias for circular radius helper
 */
export function generateRandomSpotsInRadius(centerLat, centerLng, radiusKm = 1.5, count = 3, minDistanceBetweenMeters = 150) {
  return generateRandomSpotsInSquare(centerLat, centerLng, radiusKm, count, minDistanceBetweenMeters);
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
 * Solves Traveling Salesperson shortest path starting from origin, visiting all 3 spots,
 * AND returning back to origin (Point 4 - Closed Loop).
 * @param {{lat: number, lng: number}} origin
 * @param {Array<{lat: number, lng: number}>} spots (array of 3 points)
 * @returns {{orderedSpots: Array<Object>, totalDistanceKm: number, legs: Array<number>}}
 */
export function solveOptimalRoute(origin, spots) {
  if (!spots || spots.length === 0) {
    return { orderedSpots: [], totalDistanceKm: 0, legs: [] };
  }

  if (spots.length === 1) {
    const dist = calculateHaversineDistance(origin.lat, origin.lng, spots[0].lat, spots[0].lng);
    return { orderedSpots: [{ ...spots[0], step: 1 }], totalDistanceKm: dist * 2, legs: [dist, dist] };
  }

  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0]
  ];

  let bestPermutation = permutations[0];
  let minTotalDistance = Infinity;
  let bestLegs = [];

  for (const perm of permutations) {
    const p0 = spots[perm[0]];
    const p1 = spots[perm[1]];
    const p2 = spots[perm[2]];

    const leg0 = calculateHaversineDistance(origin.lat, origin.lng, p0.lat, p0.lng);
    const leg1 = calculateHaversineDistance(p0.lat, p0.lng, p1.lat, p1.lng);
    const leg2 = calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    const leg3 = calculateHaversineDistance(p2.lat, p2.lng, origin.lat, origin.lng); // Return to start (Point 4)
    const total = leg0 + leg1 + leg2 + leg3;

    if (total < minTotalDistance - 1e-6 || (Math.abs(total - minTotalDistance) < 1e-6 && leg0 < bestLegs[0])) {
      minTotalDistance = total;
      bestPermutation = perm;
      bestLegs = [leg0, leg1, leg2, leg3];
    }
  }

  const orderedSpots = bestPermutation.map((idx, stepNum) => ({
    ...spots[idx],
    step: stepNum + 1
  }));

  return {
    orderedSpots,
    totalDistanceKm: minTotalDistance,
    legs: bestLegs
  };
}

/**
 * Checks if user is within proximity distance (e.g. 21 meters) of a spot.
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} spotLat
 * @param {number} spotLng
 * @param {number} maxDistMeters (default 21)
 * @returns {{inRange: boolean, distanceMeters: number, distanceKm: number}}
 */
export function checkProximity(userLat, userLng, spotLat, spotLng, maxDistMeters = 21) {
  const distanceKm = calculateHaversineDistance(userLat, userLng, spotLat, spotLng);
  const distanceMeters = distanceKm * 1000;
  return {
    inRange: distanceMeters <= maxDistMeters,
    distanceMeters: Math.round(distanceMeters),
    distanceKm: distanceKm
  };
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
 * Builds Google Maps walking route URL for multi-stop navigation
 * including the final return to the starting origin (Point 4 - Closed Loop).
 * @param {{lat: number, lng: number}} origin
 * @param {Array<{lat: number, lng: number}>} orderedSpots (3 spots in optimal order)
 * @returns {string}
 */
export function getGoogleMapsOptimalRouteUrl(origin, orderedSpots) {
  if (!orderedSpots || orderedSpots.length === 0) return '#';

  const origStr = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
  // Destination is the origin (Point 4 = final return to start)
  const destStr = origStr;

  const waypointsStr = orderedSpots
    .map(sp => `${sp.lat.toFixed(6)},${sp.lng.toFixed(6)}`)
    .join('%7C');

  return `https://www.google.com/maps/dir/?api=1&origin=${origStr}&destination=${destStr}&waypoints=${waypointsStr}&travelmode=walking`;
}

/**
 * Generates Apple Maps URL
 * @param {number} destLat
 * @param {number} destLng
 * @returns {string}
 */
export function getAppleMapsUrl(destLat, destLng) {
  return `https://maps.apple.com/?daddr=${destLat.toFixed(6)},${destLng.toFixed(6)}&dirflg=w`;
}

/**
 * Generates a GeoJSON Polygon representation of a circular accuracy buffer around coordinates.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMeters
 * @param {number} points
 * @returns {Object} GeoJSON Feature
 */
export function createGeoJSONCircle(lat, lng, radiusMeters = 20, points = 32) {
  const coords = [];
  const km = Math.max(radiusMeters, 5) / 1000;
  const distanceX = km / (111.32 * Math.cos(lat * (Math.PI / 180)));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // Close ring

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    properties: {
      radius: radiusMeters
    }
  };
}
