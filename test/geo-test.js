import fs from 'fs';
import {
  isPointInCity,
  getRandomPointInCity,
  generate3SpotsInCity,
  calculateHaversineDistance,
  solveOptimalRoute,
  checkProximity,
  getGoogleMapsOptimalRouteUrl
} from '../src/geo/geometry.js';

const cities = JSON.parse(fs.readFileSync('./src/data/cities.json', 'utf8'));

console.log('🧪 Starting Geospatial, Boundary & 3-Spot Route Tests...\n');

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

// Test 1: Verify all 5 cities loaded
assert(cities.length === 5, `Loaded 5 preconfigured cities (got ${cities.length})`);
const expectedCities = ['krakow', 'moscow', 'grodno', 'delft', 'dania_beach'];
expectedCities.forEach(id => {
  const found = cities.find(c => c.id === id);
  assert(!!found, `Found city config for '${id}' (${found ? found.nativeName : 'N/A'})`);
});

// Test 2: Strict Boundary Point Sampling
console.log('\n🔍 Testing 200 Random Points per City for 100% Boundary Containment:');
cities.forEach(city => {
  let insideCount = 0;
  const numSamples = 200;
  for (let i = 0; i < numSamples; i++) {
    const pt = getRandomPointInCity(city.geojson);
    const inside = isPointInCity([pt.lng, pt.lat], city.geojson);
    if (inside) insideCount++;
  }
  assert(insideCount === numSamples, `${city.nativeName}: ${insideCount}/${numSamples} points strictly inside boundaries`);
});

// Test 3: Generate 3 daily spots inside city
console.log('\n🔍 Testing 3 Daily Spots Generation per City:');
cities.forEach(city => {
  const spots = generate3SpotsInCity(city.geojson, 3);
  assert(spots.length === 3, `${city.nativeName}: generated exactly 3 spots`);
  const allInside = spots.every(s => isPointInCity([s.lng, s.lat], city.geojson));
  assert(allInside, `${city.nativeName}: all 3 spots strictly inside polygon boundary`);
});

// Test 4: Optimal Route Solver
console.log('\n🔍 Testing Optimal Closed-Loop TSP Walking Route Solver (with return to start):');
const origin = { lat: 50.0600, lng: 19.9400 };
const p1 = { lat: 50.0640, lng: 19.9400 }; // North
const p2 = { lat: 50.0640, lng: 19.9460 }; // North-East
const p3 = { lat: 50.0600, lng: 19.9460 }; // East
const scrambled = [p2, p3, p1];
const { orderedSpots, totalDistanceKm, legs } = solveOptimalRoute(origin, scrambled);

assert(orderedSpots.length === 3, 'Returns all 3 spots in route');
assert(legs.length === 4, `Route has exactly 4 legs returning to origin (got ${legs.length})`);
assert(totalDistanceKm > 1.0 && totalDistanceKm < 2.5, `Total loop route distance is optimal (got ${totalDistanceKm.toFixed(2)} km)`);

// Test 5: 21m Proximity Check
console.log('\n🔍 Testing 21m Arrival Proximity:');
const proxClose = checkProximity(50.06015, 19.9400, 50.0600, 19.9400, 21);
assert(proxClose.inRange === true, `~16m away is within 21m proximity (got ${proxClose.distanceMeters}m)`);
const proxFar = checkProximity(50.0604, 19.9400, 50.0600, 19.9400, 21);
assert(proxFar.inRange === false, `~45m away is NOT within 21m proximity (got ${proxFar.distanceMeters}m)`);

// Test 6: Google Maps Closed-Loop URL (Origin == Destination)
console.log('\n🔍 Testing Google Maps Closed-Loop Walking URL:');
const gUrl = getGoogleMapsOptimalRouteUrl(origin, orderedSpots);
assert(gUrl.includes('travelmode=walking'), 'Google Maps URL specifies walking mode');
assert(gUrl.includes('waypoints='), 'Google Maps URL contains waypoints');
assert(gUrl.includes(`origin=${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`), 'Google Maps URL origin is start point');
assert(gUrl.includes(`destination=${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`), 'Google Maps URL destination is start point (Point 4 - loop)');

// Test 7: 1.5 km Square Spot Generation
console.log('\n🔍 Testing 1.5 km Square Spot Generation:');
const { generateRandomSpotsInSquare } = await import('../src/geo/geometry.js');
const squareSpots = generateRandomSpotsInSquare(origin.lat, origin.lng, 1.5, 3, 150);
assert(squareSpots.length === 3, 'Generates exactly 3 spots in 1.5 km square');
squareSpots.forEach((s, idx) => {
  const dLatKm = Math.abs(s.lat - origin.lat) * 111.32;
  const dLngKm = Math.abs(s.lng - origin.lng) * (111.32 * Math.cos(origin.lat * (Math.PI / 180)));
  assert(dLatKm <= 0.751, `Spot #${idx + 1} lat within 0.75 km from center (got ${dLatKm.toFixed(3)} km)`);
  assert(dLngKm <= 0.751, `Spot #${idx + 1} lng within 0.75 km from center (got ${dLngKm.toFixed(3)} km)`);
});

// Test 7: StreakService 1 Shuffle Per Day Limit
console.log('\n🔍 Testing StreakService 1 Shuffle Per Day Limit:');
// Mock localStorage for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

const { StreakService } = await import('../src/geo/streakService.js');
const streakService = new StreakService();

assert(streakService.canShuffleToday() === true, 'Initially allows shuffle today');
assert(streakService.getShufflesRemaining() === 1, 'Initially has 1 shuffle remaining');

const daily1 = streakService.initDailySpots(origin, null, false);
assert(daily1.spots.length === 3, 'Initial generation creates 3 spots');
assert(daily1.shufflesUsed === 0, 'Initial generation uses 0 shuffles');
assert(streakService.getShufflesRemaining() === 1, 'Still has 1 shuffle remaining after initial generation');

// Perform the 1 allowed shuffle
const daily2 = streakService.initDailySpots(origin, null, true);
assert(daily2.spots.length === 3, 'First shuffle generates 3 new spots');
assert(daily2.shufflesUsed === 1, 'First shuffle sets shufflesUsed = 1');
assert(streakService.canShuffleToday() === false, 'Can no longer shuffle today');
assert(streakService.getShufflesRemaining() === 0, 'Has 0 shuffles remaining');

// Attempting second shuffle must throw error
let threw = false;
try {
  streakService.initDailySpots(origin, null, true);
} catch (err) {
  threw = err.message === 'MAX_SHUFFLES_REACHED';
}
assert(threw === true, 'Second shuffle on same day is blocked with MAX_SHUFFLES_REACHED');

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
