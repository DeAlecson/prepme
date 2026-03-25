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
    // Dynamically load pdf.js from CDN
    if (!window.pdfjsLib) {
      await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
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
