/* ── File Parsers ── */

const Parsers = {

  async parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt')  return readFileAsText(file);
    if (ext === 'pdf')  return this.parsePDF(file);
    if (ext === 'docx') return this.parseDOCX(file);
    throw new Error(`Unsupported file type: .${ext}`);
  },

  async parsePDF(file) {
    // Try CDNs in order until one works
    const CDNS = [
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
      'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js',
    ];

    if (!window.pdfjsLib) {
      let loaded = false;
      for (const cdn of CDNS) {
        try {
          await this._loadScript(cdn);
          if (window.pdfjsLib) { loaded = true; break; }
        } catch { /* try next */ }
      }
      if (!loaded) throw new Error('PDF library could not load. Please use a TXT or DOCX file instead.');
    }

    const lib = window.pdfjsLib;
    // Point worker to same CDN that served the main script
    lib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/build/pdf.worker.min.js`;

    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await lib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n\n');
  },

  async parseDOCX(file) {
    const CDNS = [
      'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    ];
    if (!window.mammoth) {
      let loaded = false;
      for (const cdn of CDNS) {
        try {
          await this._loadScript(cdn);
          if (window.mammoth) { loaded = true; break; }
        } catch { /* try next */ }
      }
      if (!loaded) throw new Error('DOCX library could not load. Please use a TXT file instead.');
    }
    const buffer = await readFileAsArrayBuffer(file);
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  },

  _loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => setTimeout(res, 50); // small delay for global assignment
      s.onerror = () => rej(new Error(`Failed to load: ${src}`));
      document.head.appendChild(s);
    });
  },
};
