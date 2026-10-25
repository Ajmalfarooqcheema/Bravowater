// Water Quality Report viewer for BRAVO.
// Shows reports/latest.docx if present, otherwise reports/latest.jpg.
// Optional: reports/latest.json  ->  { "file": "latest.docx", "date": "25 Oct 2026" }
(function () {
  var view = document.getElementById('report-view');
  var dateEl = document.getElementById('report-date');
  if (!view) return;

  var stage = null;

  function setDate(label) {
    if (dateEl) dateEl.textContent = label ? 'Report date: ' + label : 'Latest lab report';
  }

  function isZip(buf) {
    if (!buf || buf.byteLength < 4) return false;
    var b = new Uint8Array(buf, 0, 2);
    return b[0] === 0x50 && b[1] === 0x4B; // "PK" - a real .docx is a zip
  }

  // Scale the A4-width pages down to fit narrow (mobile) screens.
  function fit() {
    if (!stage) return;
    var pages = stage.querySelectorAll('section');
    var natural = 0;
    stage.style.transform = 'none';
    stage.style.width = 'auto';
    pages.forEach(function (p) { natural = Math.max(natural, p.offsetWidth); });
    if (!natural) return;
    var scale = Math.min(1, view.clientWidth / natural);
    stage.style.width = natural + 'px';
    stage.style.transformOrigin = 'top left';
    stage.style.transform = scale < 1 ? 'scale(' + scale + ')' : 'none';
    view.style.height = scale < 1 ? Math.ceil(stage.offsetHeight * scale) + 'px' : 'auto';
  }

  function showImage(src, label) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.className = 'block w-full h-auto';
      img.alt = 'BRAVO Drinking Water quality report' + (label ? ' — ' + label : '');
      img.onload = function () {
        stage = null;
        view.style.height = 'auto';
        view.innerHTML = '';
        view.appendChild(img);
        resolve();
      };
      img.onerror = function () { reject(new Error('image failed: ' + src)); };
      img.src = src;
    });
  }

  function showDocx(buf) {
    if (!window.docx || !window.JSZip) return Promise.reject(new Error('docx-preview not loaded'));
    var holder = document.createElement('div');
    return window.docx.renderAsync(buf, holder, null, {
      inWrapper: false,
      ignoreLastRenderedPageBreak: true
    }).then(function () {
      view.innerHTML = '';
      view.appendChild(holder);
      stage = holder;
      fit();
      // fonts/images can change layout after first paint
      setTimeout(fit, 300);
    });
  }

  function loadDocx(path, version) {
    return fetch(path + version, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('missing ' + path);
      return res.arrayBuffer();
    }).then(function (buf) {
      if (!isZip(buf)) throw new Error('not a docx: ' + path);
      return showDocx(buf);
    });
  }

  function tryFiles(files, version, label) {
    if (!files.length) {
      view.innerHTML = '<p class="p-6 text-center font-body-sm text-body-sm text-on-surface-variant">The latest lab report will be uploaded here shortly.</p>';
      return;
    }
    var f = files[0], path = 'reports/' + f;
    var attempt = /\.docx$/i.test(f) ? loadDocx(path, version) : showImage(path + version, label);
    attempt.catch(function () { tryFiles(files.slice(1), version, label); });
  }

  window.addEventListener('resize', fit);

  fetch('reports/latest.json', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : {}; })
    .catch(function () { return {}; })
    .then(function (cfg) {
      var label = cfg.date || '';
      setDate(label);
      var version = label ? '?v=' + encodeURIComponent(label) : '';
      tryFiles(cfg.file ? [cfg.file] : ['latest.docx', 'latest.jpg'], version, label);
    });
})();
