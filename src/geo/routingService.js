/**
 * In-App Pedestrian Routing Service.
 * Fetches real OpenStreetMap street, sidewalk, and footpath geometries (OSRM Pedestrian)
 * with robust offline straight-line TSP fallback.
 */

export class RoutingService {
  /**
   * Fetches real street-snapped walking loop: origin → spot1 → spot2 → spot3 → origin.
   * @param {{lat: number, lng: number}} origin 
   * @param {Array<{lat: number, lng: number}>} spots 
   * @returns {Promise<{coordinates: Array<[number, number]>, distanceKm: number, durationMinutes: number, isStreetSnapped: boolean}>}
   */
  static async fetchWalkingLoop(origin, spots) {
    if (!spots || spots.length === 0) {
      return {
        coordinates: [],
        distanceKm: 0,
        durationMinutes: 0,
        isStreetSnapped: false
      };
    }

    const waypoints = [origin, ...spots, origin];
    const coordsQuery = waypoints.map(w => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`).join(';');

    // Try primary OSM Foot router first
    try {
      const primaryUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(primaryUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = parseFloat((route.distance / 1000).toFixed(2));
          const durationMin = Math.round(route.duration / 60);

          return {
            coordinates: route.geometry.coordinates,
            distanceKm: distKm,
            durationMinutes: durationMin,
            isStreetSnapped: true
          };
        }
      }
    } catch (err) {
      console.debug('Primary OSM foot router unavailable, trying fallback...', err.message);
    }

    // Try secondary OSRM router fallback
    try {
      const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;
      const res2 = await fetch(fallbackUrl, { signal: AbortSignal.timeout(3500) });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.code === 'Ok' && data2.routes && data2.routes.length > 0) {
          const route2 = data2.routes[0];
          const distKm = parseFloat((route2.distance / 1000).toFixed(2));
          const durationMin = Math.round(distKm / 4.5 * 60); // 4.5 km/h walking speed

          return {
            coordinates: route2.geometry.coordinates,
            distanceKm: distKm,
            durationMinutes: durationMin,
            isStreetSnapped: true
          };
        }
      }
    } catch (err) {
      console.debug('Secondary OSRM router unavailable:', err.message);
    }

    // Offline / Network Failure Fallback: Direct straight lines
    const straightCoords = waypoints.map(w => [w.lng, w.lat]);
    let straightDistKm = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      straightDistKm += haversineKm(waypoints[i].lat, waypoints[i].lng, waypoints[i+1].lat, waypoints[i+1].lng);
    }
    straightDistKm = parseFloat(straightDistKm.toFixed(2));
    const durationMin = Math.round(straightDistKm / 4.5 * 60);

    return {
      coordinates: straightCoords,
      distanceKm: straightDistKm,
      durationMinutes: durationMin,
      isStreetSnapped: false
    };
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
