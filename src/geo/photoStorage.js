/**
 * IndexedDB storage for BeReal-style daily walk verification photos.
 */

const DB_NAME = 'dokad_memories_db';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

class PhotoStorage {
  constructor() {
    this.dbPromise = this.initDB();
  }

  initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Saves a verified photo taken at a destination.
   * @param {string} dateStr 'YYYY-MM-DD'
   * @param {number} spotIndex (0, 1, or 2)
   * @param {string} dataUrl Base64 image
   * @param {Object} metadata { lat, lng, step, timestamp, cityName }
   */
  async savePhoto(dateStr, spotIndex, dataUrl, metadata = {}) {
    const db = await this.dbPromise;
    const id = `${dateStr}_spot_${spotIndex + 1}`;
    const record = {
      id,
      date: dateStr,
      spotIndex,
      step: spotIndex + 1,
      image: dataUrl,
      lat: metadata.lat,
      lng: metadata.lng,
      cityName: metadata.cityName || '',
      timestamp: metadata.timestamp || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieves all photos taken on a given date.
   * @param {string} dateStr 'YYYY-MM-DD'
   * @returns {Promise<Array<Object>>}
   */
  async getPhotosByDate(dateStr) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('date');
      const req = index.getAll(IDBKeyRange.only(dateStr));
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => a.spotIndex - b.spotIndex);
        resolve(sorted);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Returns a list of all distinct dates with photos.
   * @returns {Promise<Array<string>>}
   */
  async getAllMemoryDates() {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const dates = [...new Set((req.result || []).map(r => r.date))];
        resolve(dates.sort().reverse());
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }
}

export const photoStorage = new PhotoStorage();
