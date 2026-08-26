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
console.log('\n🔍 Testing Optimal TSP Walking Route Solver:');
const origin = { lat: 50.0600, lng: 19.9400 };
const p1 = { lat: 50.0645, lng: 19.9400 }; // 500m
const p2 = { lat: 50.0690, lng: 19.9400 }; // 1000m
const p3 = { lat: 50.0735, lng: 19.9400 }; // 1500m
const scrambled = [p3, p1, p2];
const { orderedSpots, totalDistanceKm } = solveOptimalRoute(origin, scrambled);

assert(orderedSpots[0].lat === p1.lat, 'Visits nearest point first');
assert(orderedSpots[1].lat === p2.lat, 'Visits middle point second');
assert(orderedSpots[2].lat === p3.lat, 'Visits farthest point third');
assert(totalDistanceKm < 2.0, `Total route distance ~1.5 km (got ${totalDistanceKm.toFixed(2)} km)`);

// Test 5: 100m Proximity Check
console.log('\n🔍 Testing 100m Arrival Proximity:');
const proxClose = checkProximity(50.0604, 19.9400, 50.0600, 19.9400, 100);
assert(proxClose.inRange === true, `~45m away is within 100m proximity (got ${proxClose.distanceMeters}m)`);
const proxFar = checkProximity(50.0630, 19.9400, 50.0600, 19.9400, 100);
assert(proxFar.inRange === false, `~330m away is NOT within 100m proximity (got ${proxFar.distanceMeters}m)`);

// Test 6: Google Maps URL
const gUrl = getGoogleMapsOptimalRouteUrl(origin, orderedSpots);
assert(gUrl.includes('travelmode=walking'), 'Google Maps URL specifies walking mode');
assert(gUrl.includes('waypoints='), 'Google Maps URL contains waypoints');

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
