/* ── Scraper — Jina AI Reader ── */

const Scraper = {
  JINA_BASE: 'https://r.jina.ai/',

  async fetchUrl(url) {
    if (!url || !url.startsWith('http')) return null;
    try {
      // No custom headers — keeps it a simple CORS request (no preflight)
      const res = await fetch(this.JINA_BASE + url);
      if (!res.ok) return null;
      const text = await res.text();
      return text.length > 200 ? text : null;
    } catch {
      return null;
    }
  },

  async scrapeAll({ jdUrl, linkedinUrl, glassdoorUrl }) {
    const results = { jdText: null, linkedinText: null, glassdoorText: null };

    const fetches = [];

    if (jdUrl) fetches.push(
      this.fetchUrl(jdUrl).then(t => { results.jdText = t; })
    );

    if (linkedinUrl) fetches.push(
      this.fetchUrl(linkedinUrl).then(t => { results.linkedinText = t; })
    );

    if (glassdoorUrl) {
      // Fetch overview + reviews + interview pages in parallel
      const glassdoorParts = await Promise.all([
        this.fetchUrl(glassdoorUrl),
        this.fetchUrl(glassdoorUrl.replace('/Overview/', '/Reviews/')),
        this.fetchUrl(glassdoorUrl.replace('/Overview/', '/Interview/')),
      ]);
      const combined = glassdoorParts.filter(Boolean).join('\n\n---\n\n');
      results.glassdoorText = combined.length > 200 ? combined : null;
    }

    await Promise.all(fetches);
    return results;
  },
};
