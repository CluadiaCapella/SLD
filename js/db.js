/**
 * Portable Media Viewer & Analytics - Database Manager (IndexedDB)
 */
const DB_NAME = 'PortableMediaAppDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        
        // Profiles Store
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        // Media Items Store
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('profileId', 'profileId', { unique: false });
        }
        // Subjects Store
        if (!db.objectStoreNames.contains('subjects')) {
          const subStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subStore.createIndex('profileId', 'profileId', { unique: false });
        }
        // Events Store
        if (!db.objectStoreNames.contains('events')) {
          const evtStore = db.createObjectStore('events', { keyPath: 'id' });
          evtStore.createIndex('profileId', 'profileId', { unique: false });
        }
        // App Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this.ensureDefaultSetup();
        resolve(this);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async ensureDefaultSetup() {
    const profiles = await this.getAll('profiles');
    if (profiles.length === 0) {
      const defaultProfile = {
        id: 'default-profile',
        name: 'Main Collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.put('profiles', defaultProfile);
      await this.setSetting('activeProfileId', 'default-profile');
    }

    const weights = await this.getSetting('scoringWeights');
    if (!weights) {
      await this.setSetting('scoringWeights', {
        heart1: 1,
        heart2: 3,
        heart3: 10,
        eventCCount: 10,
        eventTag: 1
      });
    }

    const theme = await this.getSetting('theme');
    if (!theme) {
      await this.setSetting('theme', 'dark');
    }
  }

  // Generic DB Operations
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Settings Handlers
  async getSetting(key) {
    const record = await this.get('settings', key);
    return record ? record.value : null;
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  }

  // Profile Specific Helpers
  async getActiveProfileId() {
    return (await this.getSetting('activeProfileId')) || 'default-profile';
  }

  async setActiveProfileId(profileId) {
    await this.setSetting('activeProfileId', profileId);
  }

  async getActiveMedia() {
    const activeProfileId = await this.getActiveProfileId();
    return this.getByIndex('media', 'profileId', activeProfileId);
  }

  async getActiveSubjects() {
    const activeProfileId = await this.getActiveProfileId();
    return this.getByIndex('subjects', 'profileId', activeProfileId);
  }

  async getActiveEvents() {
    const activeProfileId = await this.getActiveProfileId();
    return this.getByIndex('events', 'profileId', activeProfileId);
  }

  // Merge Profiles Engine
  async mergeProfiles(sourceProfileId, targetProfileId, newProfileName) {
    const newProfileId = 'profile-' + Date.now();
    const newProfile = {
      id: newProfileId,
      name: newProfileName || 'Merged Profile',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.put('profiles', newProfile);

    // Fetch media, subjects, and events from source and target
    const sourceMedia = await this.getByIndex('media', 'profileId', sourceProfileId);
    const targetMedia = await this.getByIndex('media', 'profileId', targetProfileId);
    const sourceSubjects = await this.getByIndex('subjects', 'profileId', sourceProfileId);
    const targetSubjects = await this.getByIndex('subjects', 'profileId', targetProfileId);
    const sourceEvents = await this.getByIndex('events', 'profileId', sourceProfileId);
    const targetEvents = await this.getByIndex('events', 'profileId', targetProfileId);

    // Copy Media
    for (const m of [...sourceMedia, ...targetMedia]) {
      const clonedMedia = { ...m, id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), profileId: newProfileId };
      await this.put('media', clonedMedia);
    }

    // Copy & Deduplicate Subjects by Name
    const subjectNameMap = new Map();
    for (const s of [...sourceSubjects, ...targetSubjects]) {
      if (!subjectNameMap.has(s.name.toLowerCase())) {
        const clonedSubject = { ...s, id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), profileId: newProfileId };
        subjectNameMap.set(s.name.toLowerCase(), clonedSubject);
        await this.put('subjects', clonedSubject);
      }
    }

    // Copy Events
    for (const e of [...sourceEvents, ...targetEvents]) {
      const clonedEvent = { ...e, id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), profileId: newProfileId };
      await this.put('events', clonedEvent);
    }

    await this.setActiveProfileId(newProfileId);
    return newProfile;
  }
}

export const db = new Database();
