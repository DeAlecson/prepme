/* ── Storage ── */

const Storage = {
  KEY_PREFIX: 'prepme_',

  // API Key — session only (clears on tab close)
  getApiKey()   { return sessionStorage.getItem('prepme_api_key') || ''; },
  setApiKey(k)  { sessionStorage.setItem('prepme_api_key', k); },
  clearApiKey() { sessionStorage.removeItem('prepme_api_key'); },

  // Proxy URL — persisted across sessions (no secret, just a URL)
  getProxyUrl()   { return localStorage.getItem('prepme_proxy_url') || ''; },
  setProxyUrl(u)  { localStorage.setItem('prepme_proxy_url', u); },
  clearProxyUrl() { localStorage.removeItem('prepme_proxy_url'); },

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
