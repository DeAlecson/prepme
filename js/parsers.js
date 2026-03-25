/* ── File Parsers ── */

const Parsers = {

  async parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt') return readFileAsText(file);
    if (ext === 'pdf') return this.parsePDF(file);
    if (ext === 'docx') return this.parseDOCX(file);
    throw new Error(`Unsupported file type: .${ext}`);
  },

  async parsePDF(file) {
    if (!window.pdfjsLib) {
      await this._loadScript('https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js');
    }
    // Set worker using the same version that actually loaded
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('PDF library failed to load. Try a TXT or DOCX file instead.');
    lib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.js`;

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
    if (!window.mammoth) {
      await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    }
    const buffer = await readFileAsArrayBuffer(file);
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  },

  _loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  },
};
