import {
  calculateHaversineDistance,
  formatDistance,
  generateRandomSpotsInRadius,
  solveOptimalRoute,
  checkProximity,
  getGoogleMapsOptimalRouteUrl
} from '../src/geo/geometry.js';

console.log('🧪 Starting Automated Geospatial, Routing & Streak Verification Tests...\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// Test 1: Distance calculation accuracy (Krakow Main Square to Wawel Castle ~700m)
const krakowSquare = { lat: 50.0617, lng: 19.9373 };
const wawelCastle = { lat: 50.0540, lng: 19.9354 };
const wawelDistKm = calculateHaversineDistance(krakowSquare.lat, krakowSquare.lng, wawelCastle.lat, wawelCastle.lng);
assert(wawelDistKm > 0.6 && wawelDistKm < 1.0, `Krakow Square to Wawel distance (~850m): got ${(wawelDistKm * 1000).toFixed(0)}m`);

// Test 2: Uniform 2 km Random Spot Generation (500 batches = 1500 points)
console.log('\n🔍 Testing 1500 Generated Spots to ensure 100% are strictly within 2.0 km radius:');
const origin = { lat: 50.0647, lng: 19.9450 };
let allWithin2km = true;
let totalGenerated = 0;

for (let i = 0; i < 500; i++) {
  const spots = generateRandomSpotsInRadius(origin.lat, origin.lng, 2.0, 3, 100);
  assert(spots.length === 3, `Batch ${i + 1} generated exactly 3 spots`);
  totalGenerated += spots.length;

  for (const s of spots) {
    const dist = calculateHaversineDistance(origin.lat, origin.lng, s.lat, s.lng);
    if (dist > 2.001) {
      allWithin2km = false;
      console.error(`Point out of 2km bounds: ${dist.toFixed(3)} km`);
    }
  }
}
assert(allWithin2km, `All ${totalGenerated} random points strictly within 2.0 km radius`);

// Test 3: Optimal TSP Shortest Route Solver
console.log('\n🔍 Testing Optimal Route Permutation Solver:');
const sampleOrigin = { lat: 50.0600, lng: 19.9400 };
// 3 points arranged in a line: P1 at 500m north, P2 at 1000m north, P3 at 1500m north
const p1 = { lat: 50.0645, lng: 19.9400 }; // 500m
const p2 = { lat: 50.0690, lng: 19.9400 }; // 1000m
const p3 = { lat: 50.0735, lng: 19.9400 }; // 1500m

// Pass in scrambled order
const scrambledSpots = [p3, p1, p2];
const { orderedSpots, totalDistanceKm } = solveOptimalRoute(sampleOrigin, scrambledSpots);

assert(orderedSpots[0].lat === p1.lat, 'Optimal route visits closest point first (P1)');
assert(orderedSpots[1].lat === p2.lat, 'Optimal route visits middle point second (P2)');
assert(orderedSpots[2].lat === p3.lat, 'Optimal route visits farthest point last (P3)');
assert(totalDistanceKm < 2.0, `Optimal line distance ~1.5 km (got ${totalDistanceKm.toFixed(2)} km)`);

// Test 4: 100m Proximity Check-in logic
console.log('\n🔍 Testing 100m Proximity Verification:');
// 50 meters away
const userNear = { lat: 50.0604, lng: 19.9400 };
const spotTarget = { lat: 50.0600, lng: 19.9400 };
const proxNear = checkProximity(userNear.lat, userNear.lng, spotTarget.lat, spotTarget.lng, 100);
assert(proxNear.inRange === true, `50m away is in range (got ${proxNear.distanceMeters}m)`);

// 250 meters away
const userFar = { lat: 50.0625, lng: 19.9400 };
const proxFar = checkProximity(userFar.lat, userFar.lng, spotTarget.lat, spotTarget.lng, 100);
assert(proxFar.inRange === false, `280m away is NOT in range (got ${proxFar.distanceMeters}m)`);

// Test 5: Google Maps Multi-Waypoint URL Builder
console.log('\n🔍 Testing Google Maps Multi-Waypoint URL:');
const gUrl = getGoogleMapsOptimalRouteUrl(sampleOrigin, orderedSpots, 'walking');
assert(gUrl.includes('api=1'), 'URL has Google Maps Dir API param');
assert(gUrl.includes('travelmode=walking'), 'URL specifies travelmode=walking');
assert(gUrl.includes('origin='), 'URL specifies origin coordinates');
assert(gUrl.includes('destination='), 'URL specifies destination coordinates');
assert(gUrl.includes('waypoints='), 'URL specifies intermediate waypoints');

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
