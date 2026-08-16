import fs from 'fs';
import {
  isPointInCity,
  getRandomPointInCity,
  calculateHaversineDistance,
  getTravelMode,
  getGoogleMapsUrl
} from '../src/geo/geometry.js';

const cities = JSON.parse(fs.readFileSync('./src/data/cities.json', 'utf8'));

console.log('🧪 Starting Automated Geospatial & Routing Verification Tests...\n');

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
assert(cities.length === 5, `Loaded exactly 5 preconfigured cities (got ${cities.length})`);
const expectedCities = ['krakow', 'moscow', 'grodno', 'delft', 'dania_beach'];
expectedCities.forEach(id => {
  const found = cities.find(c => c.id === id);
  assert(!!found, `Found city config for '${id}' (${found ? found.nativeName : 'N/A'})`);
});

// Test 2: Verify Strict Boundary Point Generation
console.log('\n🔍 Testing 500 Random Points per City for 100% Strict Boundary Containment:');
cities.forEach(city => {
  let insideCount = 0;
  const numSamples = 500;
  
  for (let i = 0; i < numSamples; i++) {
    const pt = getRandomPointInCity(city.geojson);
    const inside = isPointInCity([pt.lng, pt.lat], city.geojson);
    if (inside) insideCount++;
  }

  assert(
    insideCount === numSamples,
    `${city.nativeName} (${city.country}): ${insideCount}/${numSamples} points strictly inside boundary (100% precision)`
  );
});

// Test 3: Distance and Routing Mode Logic
console.log('\n🔍 Testing Routing Mode Decisions (< 5km => walking, >= 5km => transit):');
assert(getTravelMode(0.5) === 'walking', '0.5 km triggers walking mode');
assert(getTravelMode(4.99) === 'walking', '4.99 km triggers walking mode');
assert(getTravelMode(5.0) === 'transit', '5.0 km triggers transit mode');
assert(getTravelMode(12.4) === 'transit', '12.4 km triggers transit mode');

// Test 4: Google Maps URL verification
const walkUrl = getGoogleMapsUrl(50.061, 19.938, 50.065, 19.940, 'walking');
assert(walkUrl.includes('travelmode=walking'), `Google Maps walking url has travelmode=walking`);

const transitUrl = getGoogleMapsUrl(50.061, 19.938, 50.120, 20.010, 'transit');
assert(transitUrl.includes('travelmode=transit'), `Google Maps transit url has travelmode=transit`);

// Test 5: Distance Calculation
const dist = calculateHaversineDistance(50.0647, 19.9450, 50.0614, 19.9366); // Kraków main square to Wawel ~0.7 km
assert(dist > 0.4 && dist < 1.2, `Kraków distance test: expected ~0.7 km, got ${dist.toFixed(2)} km`);

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
