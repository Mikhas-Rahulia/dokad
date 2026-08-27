/**
 * Photo Storage — OPFS Worker (fast path) + IndexedDB (metadata + fallback)
 * OPFS: Zero main-thread blocking, ~6ms per 5MB photo write.
 * IndexedDB: Structured metadata index for calendar queries and full photo gallery.
 */

const DB_NAME = 'dokad_memories_db';
const DB_VERSION = 2;
const META_STORE = 'photo_meta';
const PHOTO_STORE = 'photos';

class PhotoStorage {
  constructor() {
    this.dbPromise = this.initDB();
    this.opfsWorker = null;
    this.opfsAvailable = false;
    this.initOPFS();
  }

  initOPFS() {
    try {
      if (typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage) {
        this.opfsWorker = new Worker(
          new URL('../workers/photoWorker.js', import.meta.url),
          { type: 'module' }
        );
        this.opfsAvailable = true;
      }
    } catch {
      this.opfsAvailable = false;
    }
  }

  initDB() {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Photo metadata store
        if (!db.objectStoreNames.contains(META_STORE)) {
          const store = db.createObjectStore(META_STORE, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
        // Legacy full photo store (fallback when OPFS unavailable)
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          const legacyStore = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
          legacyStore.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Saves a photo.
   * If OPFS is available, persists the binary off the main thread via Worker (~6ms).
   * Also indexes the photo metadata into IndexedDB for fast timeline queries.
   */
  async savePhoto(dateStr, spotIndex, dataUrl, meta = {}) {
    const id = `${dateStr}_spot_${spotIndex}`;
    const filename = `${id}.jpg`;

    // 1. Offload heavy binary write to OPFS Worker if available
    if (this.opfsWorker && this.opfsAvailable) {
      try {
        this.opfsWorker.postMessage({
          action: 'write',
          filename,
          dataUrl
        });
      } catch (err) {
        console.warn('OPFS Worker postMessage error:', err);
      }
    }

    // 2. Save metadata + dataUrl thumbnail to IndexedDB
    const db = await this.dbPromise;
    if (!db) return null;

    const metaRecord = {
      id,
      date: dateStr,
      spotIndex,
      image: dataUrl,
      lat: meta.lat || 0,
      lng: meta.lng || 0,
      step: meta.step || spotIndex + 1,
      cityName: meta.cityName || 'City Walk',
      timestamp: meta.timestamp || new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      tx.objectStore(META_STORE).put(metaRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });

    // Also write to legacy store for backward compatibility
    if (db.objectStoreNames.contains(PHOTO_STORE)) {
      await new Promise((resolve) => {
        const tx = db.transaction(PHOTO_STORE, 'readwrite');
        tx.objectStore(PHOTO_STORE).put(metaRecord);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }

    return metaRecord;
  }

  /**
   * Retrieves all photos taken on a given date.
   */
  async getPhotosByDate(dateStr) {
    const db = await this.dbPromise;
    if (!db) return [];

    // First try metadata store
    const metas = await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).index('date').getAll(IDBKeyRange.only(dateStr));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });

    if (metas.length > 0) {
      return metas.sort((a, b) => a.spotIndex - b.spotIndex);
    }

    // Fallback: try legacy photo store
    if (db.objectStoreNames.contains(PHOTO_STORE)) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_STORE, 'readonly');
        const req = tx.objectStore(PHOTO_STORE).index('date').getAll(IDBKeyRange.only(dateStr));
        req.onsuccess = () => {
          const sorted = (req.result || []).sort((a, b) => a.spotIndex - b.spotIndex);
          resolve(sorted);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    }

    return [];
  }

  /**
   * Retrieves all verified photos across all dates, sorted from newest to oldest.
   * Powers the full Photo Gallery.
   */
  async getAllPhotos() {
    const db = await this.dbPromise;
    if (!db) return [];

    let photos = [];
    try {
      photos = await new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readonly');
        const req = tx.objectStore(META_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      photos = [];
    }

    if (photos.length === 0 && db.objectStoreNames.contains(PHOTO_STORE)) {
      try {
        photos = await new Promise((resolve, reject) => {
          const tx = db.transaction(PHOTO_STORE, 'readonly');
          const req = tx.objectStore(PHOTO_STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      } catch {
        photos = [];
      }
    }

    return photos.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
  }

  /**
   * Returns a list of all distinct dates with photos.
   */
  async getAllMemoryDates() {
    const db = await this.dbPromise;
    if (!db) return [];
    const dates = new Set();

    // From metadata store
    await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).getAll();
      req.onsuccess = () => {
        (req.result || []).forEach(r => dates.add(r.date));
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });

    // From legacy store
    if (db.objectStoreNames.contains(PHOTO_STORE)) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(PHOTO_STORE, 'readonly');
          const req = tx.objectStore(PHOTO_STORE).getAll();
          req.onsuccess = () => {
            (req.result || []).forEach(r => dates.add(r.date));
            resolve();
          };
          req.onerror = (e) => reject(e.target.error);
        });
      } catch {}
    }

    return [...dates].sort().reverse();
  }
}

export const photoStorage = new PhotoStorage();
