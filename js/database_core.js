/**
 * IndexedDB Core Database Manager Subsystem
 */

const DB_NAME = 'PortableMediaAppDB';
const DB_VERSION = 1;

const DEFAULT_MEDAL_SETTINGS = {
  goldPts: 1.0, silverPts: 0.3, bronzePts: 0.1,
  maxGold: 1, maxSilver: 2, maxBronze: 5
};

const DEFAULT_SUBJECT_GROUPS = [
  { id: 'brown', name: '🟤 Brown', emoji: '🟤', color: '#a16207', cssClass: 'group-border-brown', isBuiltIn: true },
  { id: 'purple', name: '🟣 Purple', emoji: '🟣', color: '#a855f7', cssClass: 'group-border-purple', isBuiltIn: true },
  { id: 'green', name: '🟢 Green', emoji: '🟢', color: '#22c55e', cssClass: 'group-border-green', isBuiltIn: true },
  { id: 'yellow', name: '🟡 Yellow', emoji: '🟡', color: '#eab308', cssClass: 'group-border-yellow', isBuiltIn: true },
  { id: 'orange', name: '🟠 Orange', emoji: '🟠', color: '#f97316', cssClass: 'group-border-orange', isBuiltIn: true },
];

let currentSubjectGroupsList = DEFAULT_SUBJECT_GROUPS;

class Database {
  constructor() { this.db = null; }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('profileId', 'profileId', { unique: false });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          const subStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subStore.createIndex('profileId', 'profileId', { unique: false });
        }
        if (!db.objectStoreNames.contains('events')) {
          const evtStore = db.createObjectStore('events', { keyPath: 'id' });
          evtStore.createIndex('profileId', 'profileId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
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
      await this.put('profiles', { id: 'default-profile', name: 'Main Collection', createdAt: new Date().toISOString() });
      await this.setSetting('activeProfileId', 'default-profile');
    }

    const weights = await this.getSetting('scoringWeights');
    if (!weights) {
      await this.setSetting('scoringWeights', { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1 });
    }

    const points = await this.getSetting('actionPointsMap');
    if (!points) {
      await this.setSetting('actionPointsMap', DEFAULT_ACTION_POINTS);
    }

    const medalSettings = await this.getSetting('medalSettings');
    if (!medalSettings) {
      await this.setSetting('medalSettings', DEFAULT_MEDAL_SETTINGS);
    }

    const groups = await this.getSetting('subjectGroups');
    if (!groups) {
      await this.setSetting('subjectGroups', DEFAULT_SUBJECT_GROUPS);
    }

    const theme = await this.getSetting('theme');
    if (!theme) await this.setSetting('theme', 'dark');
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.db.objectStoreNames.contains(storeName)) { resolve(null); return; }
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.db.objectStoreNames.contains(storeName)) { resolve([]); return; }
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSetting(key) {
    const record = await this.get('settings', key);
    return record ? record.value : null;
  }

  async setSetting(key, value) { return this.put('settings', { key, value }); }

  async getActiveProfileId() { return (await this.getSetting('activeProfileId')) || 'default-profile'; }
  async setActiveProfileId(profileId) { await this.setSetting('activeProfileId', profileId); }

  async getActiveCollectionId() { return (await this.getSetting('activeCollectionId')) || 'default-collection'; }
  async setActiveCollectionId(collectionId) { await this.setSetting('activeCollectionId', collectionId); }

  async getActiveMedia() {
    const activeProfileId = await this.getActiveProfileId();
    const allMedia = await this.getAll('media');
    const items = allMedia.filter(m => !m.profileId || m.profileId === activeProfileId);
    for (const m of items) {
      if (!m.profileId) {
        m.profileId = activeProfileId;
        await this.put('media', m);
      }
      if (!m.hash && m.dataUrl) {
        m.hash = await calculateContentHash(m.dataUrl);
        await this.put('media', m);
      }
      if (!m.blueBookEvents) {
        m.blueBookEvents = [];
        if (m.dateTag || m.heartTags) {
          m.blueBookEvents.push({
            id: 'sld-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            dateTag: m.dateTag || getTodaySmartDateTag(),
            heartTags: m.heartTags || { pink: 0, grey: 0, blue: 0 }
          });
        }
        await this.put('media', m);
      }
    }
    return items;
  }

  async getActiveSubjects() {
    const activeProfileId = await this.getActiveProfileId();
    const allSubs = await this.getAll('subjects');
    const items = allSubs.filter(s => !s.profileId || s.profileId === activeProfileId);
    for (const s of items) {
      if (!s.profileId) {
        s.profileId = activeProfileId;
        await this.put('subjects', s);
      }
    }
    return items;
  }

  async getActiveEvents() {
    const activeProfileId = await this.getActiveProfileId();
    const allEvts = await this.getAll('events');
    const items = allEvts.filter(e => !e.profileId || e.profileId === activeProfileId);
    for (const e of items) {
      if (!e.profileId) {
        e.profileId = activeProfileId;
        await this.put('events', e);
      }
    }
    return items;
  }
}

const db = new Database();

window.DB_NAME = DB_NAME;
window.DB_VERSION = DB_VERSION;
window.DEFAULT_MEDAL_SETTINGS = DEFAULT_MEDAL_SETTINGS;
window.DEFAULT_SUBJECT_GROUPS = DEFAULT_SUBJECT_GROUPS;
window.Database = Database;
window.db = db;
