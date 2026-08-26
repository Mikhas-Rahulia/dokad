import defaultCities from '../data/cities.json';

const STORAGE_KEY_CITY = 'dokad_current_city_id';
const STORAGE_KEY_CUSTOM_CITIES = 'dokad_custom_cities_v1';
const STORAGE_KEY_SIMULATE = 'dokad_simulate_center';

// Map country codes or names to standard languages
const COUNTRY_LANG_MAP = {
  'PL': 'pl',
  'RU': 'ru',
  'BY': 'be',
  'NL': 'nl',
  'US': 'en',
  'GB': 'en',
  'DE': 'de',
  'FR': 'fr',
  'IT': 'it',
  'ES': 'es',
  'UA': 'uk',
  'CZ': 'cs',
  'LT': 'lt',
  'LV': 'lv'
};

export class CityService {
  constructor() {
    this.cities = [...defaultCities];
    this.loadCustomCities();
    this.currentCity = this.loadSavedCity();
  }

  loadCustomCities() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_CITIES);
      if (saved) {
        const custom = JSON.parse(saved);
        if (Array.isArray(custom)) {
          custom.forEach(c => {
            if (!this.cities.some(existing => existing.id === c.id)) {
              this.cities.push(c);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load custom cities from storage', e);
    }
  }

  saveCustomCity(city) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_CITIES);
      let list = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.id !== city.id);
      list.unshift(city);
      localStorage.setItem(STORAGE_KEY_CUSTOM_CITIES, JSON.stringify(list.slice(0, 20)));
    } catch (e) {
      console.warn('Failed to save custom city', e);
    }
  }

  getAllCities() {
    return this.cities;
  }

  getFeaturedCities() {
    return defaultCities;
  }

  getCityById(id) {
    return this.cities.find(c => c.id === id) || defaultCities[0];
  }

  loadSavedCity() {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_CITY);
      if (savedId) {
        const found = this.cities.find(c => c.id === savedId);
        if (found) return found;
      }
    } catch (e) {
      console.warn('Failed to load saved city', e);
    }
    // Default to Kraków
    return defaultCities[0];
  }

  setCurrentCity(city) {
    this.currentCity = city;
    try {
      localStorage.setItem(STORAGE_KEY_CITY, city.id);
    } catch (e) {
      console.warn('Failed to persist city', e);
    }
    return this.currentCity;
  }

  getSimulateCenterMode() {
    try {
      return localStorage.getItem(STORAGE_KEY_SIMULATE) === 'true';
    } catch {
      return false;
    }
  }

  setSimulateCenterMode(val) {
    try {
      localStorage.setItem(STORAGE_KEY_SIMULATE, val ? 'true' : 'false');
    } catch (e) {
      console.warn(e);
    }
  }

  /**
   * Searches for a city via OpenStreetMap Nominatim and extracts its boundary polygon.
   * @param {string} query
   * @returns {Promise<Object>}
   */
  async searchAndFetchCity(query) {
    if (!query || query.trim().length < 2) {
      throw new Error('Query too short');
    }

    const cleanQuery = query.trim();
    // Check if query matches an existing city
    const existing = this.cities.find(c =>
      c.name.toLowerCase() === cleanQuery.toLowerCase() ||
      c.nativeName.toLowerCase() === cleanQuery.toLowerCase()
    );
    if (existing) return existing;

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&polygon_geojson=1&addressdetails=1&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Network error while searching city');
    }

    const results = await response.json();
    if (!results || results.length === 0) {
      throw new Error('City not found');
    }

    const item = results[0];
    if (!item.geojson || (item.geojson.type !== 'Polygon' && item.geojson.type !== 'MultiPolygon')) {
      throw new Error('No exact boundary polygon available for this location');
    }

    const address = item.address || {};
    const countryCode = (address.country_code || 'US').toUpperCase();
    const lang = COUNTRY_LANG_MAP[countryCode] || 'en';
    const cityName = address.city || address.town || address.village || address.municipality || item.name || cleanQuery;

    const newCity = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: cityName,
      nativeName: cityName,
      country: address.country || countryCode,
      countryCode: countryCode,
      lang: lang,
      langName: lang.toUpperCase(),
      flag: countryCodeToEmoji(countryCode),
      query: cleanQuery,
      center: [parseFloat(item.lat), parseFloat(item.lon)],
      displayName: item.display_name,
      geojson: item.geojson,
      boundingbox: item.boundingbox
    };

    this.cities.unshift(newCity);
    this.saveCustomCity(newCity);
    return newCity;
  }

  /**
   * Reverse geocode a coordinate to get street/neighborhood
   * @param {number} lat
   * @param {number} lng
   * @param {string} lang
   * @returns {Promise<string>}
   */
  async reverseGeocode(lat, lng, lang = 'ru') {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&format=json&accept-language=${lang}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const data = await res.json();
      if (data && data.address) {
        const road = data.address.road || data.address.pedestrian || data.address.suburb || data.address.neighbourhood || '';
        const house = data.address.house_number ? ` ${data.address.house_number}` : '';
        const district = data.address.city_district || data.address.suburb || '';
        if (road) return `${road}${house}${district ? ` (${district})` : ''}`;
      }
      return data.display_name ? data.display_name.split(',').slice(0, 3).join(',') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }
}

function countryCodeToEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '📍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
