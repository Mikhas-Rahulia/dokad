/**
 * Geospatial computations: Haversine distance, uniform 2km random sampling,
 * TSP optimal route solver, 100m arrival proximity verification, and Google Maps URL generation.
 */

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
 * Formats distance nicely in meters or kilometers.
 * @param {number} distKm
 * @returns {string}
 */
export function formatDistance(distKm) {
  if (distKm === null || isNaN(distKm)) return '—';
  
  if (distKm < 1.0) {
    const meters = Math.round(distKm * 1000);
    return `${meters} m`;
  }

  const rounded = distKm < 10 ? distKm.toFixed(2) : distKm.toFixed(1);
  return `${rounded} km`;
}

/**
 * Generates uniformly distributed random points strictly within radiusKm of center.
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusKm (default 2.0 km)
 * @param {number} count (default 3)
 * @param {number} minDistanceBetweenMeters (default 150m to avoid overlapping spots)
 * @returns {Array<{lat: number, lng: number, id: string}>}
 */
export function generateRandomSpotsInRadius(centerLat, centerLng, radiusKm = 2.0, count = 3, minDistanceBetweenMeters = 150) {
  const spots = [];
  const maxAttempts = 500;
  let attempts = 0;

  while (spots.length < count && attempts < maxAttempts) {
    attempts++;
    // Uniform polar area sampling
    const r = radiusKm * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;

    const dLat = (r * Math.cos(theta)) / 111.32;
    const dLng = (r * Math.sin(theta)) / (111.32 * Math.cos(centerLat * (Math.PI / 180)));

    const candidate = {
      lat: Number((centerLat + dLat).toFixed(6)),
      lng: Number((centerLng + dLng).toFixed(6))
    };

    // Ensure candidate is <= radiusKm from center
    const distToCenter = calculateHaversineDistance(centerLat, centerLng, candidate.lat, candidate.lng);
    if (distToCenter > radiusKm) continue;

    // Ensure candidate is not too close to center
    if (distToCenter * 1000 < minDistanceBetweenMeters) continue;

    // Ensure candidate is not too close to previously generated spots
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

  // If constraints were too tight, backfill without inter-spot distance constraints
  while (spots.length < count) {
    const r = radiusKm * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const dLat = (r * Math.cos(theta)) / 111.32;
    const dLng = (r * Math.sin(theta)) / (111.32 * Math.cos(centerLat * (Math.PI / 180)));
    spots.push({
      lat: Number((centerLat + dLat).toFixed(6)),
      lng: Number((centerLng + dLng).toFixed(6)),
      id: `spot_${spots.length + 1}_${Date.now()}`
    });
  }

  return spots;
}

/**
 * Solves the Traveling Salesperson shortest path starting from origin and visiting all 3 spots.
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
    return { orderedSpots: [spots[0]], totalDistanceKm: dist, legs: [dist] };
  }

  // For N=3, generate all 6 permutations:
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
    const total = leg0 + leg1 + leg2;

    if (total < minTotalDistance) {
      minTotalDistance = total;
      bestPermutation = perm;
      bestLegs = [leg0, leg1, leg2];
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
 * Checks if user is within proximity distance (e.g. 100 meters) of a spot.
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} spotLat
 * @param {number} spotLng
 * @param {number} maxDistMeters (default 100)
 * @returns {{inRange: boolean, distanceMeters: number, distanceKm: number}}
 */
export function checkProximity(userLat, userLng, spotLat, spotLng, maxDistMeters = 100) {
  const distanceKm = calculateHaversineDistance(userLat, userLng, spotLat, spotLng);
  const distanceMeters = distanceKm * 1000;
  return {
    inRange: distanceMeters <= maxDistMeters,
    distanceMeters: Math.round(distanceMeters),
    distanceKm: distanceKm
  };
}

/**
 * Builds Google Maps walking route URL for multi-stop navigation.
 * Uses official universal Google Maps Dir API format.
 * @param {{lat: number, lng: number}} origin
 * @param {Array<{lat: number, lng: number}>} orderedSpots (3 spots in optimal order)
 * @param {string} mode ('walking' | 'bicycling' | 'driving')
 * @returns {string}
 */
export function getGoogleMapsOptimalRouteUrl(origin, orderedSpots, mode = 'walking') {
  if (!orderedSpots || orderedSpots.length === 0) return '#';

  const origStr = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;

  if (orderedSpots.length === 1) {
    const destStr = `${orderedSpots[0].lat.toFixed(6)},${orderedSpots[0].lng.toFixed(6)}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origStr}&destination=${destStr}&travelmode=${mode}`;
  }

  const destination = orderedSpots[orderedSpots.length - 1];
  const destStr = `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;

  // Waypoints are all spots except the final destination
  const waypoints = orderedSpots.slice(0, orderedSpots.length - 1);
  const waypointsStr = waypoints
    .map(sp => `${sp.lat.toFixed(6)},${sp.lng.toFixed(6)}`)
    .join('%7C'); // Encoded pipe |

  return `https://www.google.com/maps/dir/?api=1&origin=${origStr}&destination=${destStr}&waypoints=${waypointsStr}&travelmode=${mode}`;
}
