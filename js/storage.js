/* ── Storage ── */

const Storage = {
  KEY_PREFIX: 'prepme_',

  // API Key — session only
  getApiKey() { return sessionStorage.getItem('prepme_api_key') || ''; },
  setApiKey(key) { sessionStorage.setItem('prepme_api_key', key); },
  clearApiKey() { sessionStorage.removeItem('prepme_api_key'); },

  // Profiles — persisted in localStorage
  getProfiles() {
    try { return JSON.parse(localStorage.getItem('prepme_profiles') || '[]'); }
    catch { return []; }
  },

  saveProfile(profile) {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx > -1) profiles[idx] = profile;
    else profiles.unshift(profile);
    localStorage.setItem('prepme_profiles', JSON.stringify(profiles));
  },

  deleteProfile(id) {
    const profiles = this.getProfiles().filter(p => p.id !== id);
    localStorage.setItem('prepme_profiles', JSON.stringify(profiles));
  },

  getProfile(id) {
    return this.getProfiles().find(p => p.id === id) || null;
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
};
