/**
 * Player áudio-série (episódios) com progresso localStorage
 */
(function () {
  const STORAGE_KEY = 'adc-t1-progress';

  function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.scrollToSection = scrollToSection;

  const cfg = document.getElementById('serie-config');
  if (!cfg) return;
  const SERIE = JSON.parse(cfg.textContent);

  /* ===== Progresso ===== */
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { watched: [], lastEp: null, lastPart: 1 }; }
    catch { return { watched: [], lastEp: null, lastPart: 1 }; }
  }

  function saveProgress(epNum, partNum) {
    const p = loadProgress();
    p.lastEp = epNum;
    p.lastPart = partNum;
    const key = `${epNum}-${partNum}`;
    if (!p.watched.includes(key)) p.watched.push(key);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }

  function isWatched(epNum, partNum) {
    const p = loadProgress();
    return p.watched.includes(`${epNum}-${partNum}`);
  }

  function epProgress(epObj) {
    const total = epObj.parts.length;
    const done = epObj.parts.filter(pt => isWatched(epObj.ep, pt.parte)).length;
    if (done === 0) return 'empty';
    if (done >= total) return 'done';
    return 'progress';
  }

  /* ===== Estado ===== */
  let selectedEp = null;
  let selectedPart = 0;

  /* ===== Elementos ===== */
  const epGrid      = document.getElementById('epGrid');
  const tituloEp    = document.getElementById('tituloEp');
  const subTituloEp = document.getElementById('subTituloEp');
  const partsArea   = document.getElementById('partsArea');
  const partsPills  = document.getElementById('partsPills');
  const btnAssistir = document.getElementById('btnAssistir');
  const btnYoutube  = document.getElementById('btnYoutube');
  const btnPrev     = document.getElementById('btnPrev');
  const btnNext     = document.getElementById('btnNext');
  const btnPrev2    = document.getElementById('btnPrev2');
  const btnNext2    = document.getElementById('btnNext2');
  const ytFrame     = document.getElementById('ytFrame');
  const playerHint  = document.getElementById('playerHint');
  const nowTitle    = document.getElementById('nowTitle');
  const statusLine  = document.getElementById('statusLine');
  const epSinopseText = document.getElementById('epSinopseText');

  /* ===== Render Episódios ===== */
  function pad2(n) { return String(n).padStart(2, '0'); }

  function renderEpGrid() {
    epGrid.innerHTML = SERIE.eps.map((e, idx) => {
      const state = epProgress(e);
      const isActive = selectedEp === idx;
      const stateIcon = state === 'done' ? '✓' : state === 'progress' ? '◑' : '';
      const sinopseShort = e.sinopse ? e.sinopse.slice(0, 90) + (e.sinopse.length > 90 ? '…' : '') : '';
      return `<button class="ep-card ${isActive ? 'active' : ''}"
                onclick="selecionarEp(${idx})"
                aria-label="Selecionar episódio ${pad2(e.ep)} — ${e.titulo}"
                data-state="${state}">
        <div class="ep-card__header">
          <span class="ep-card__num">EP ${pad2(e.ep)}</span>
          ${stateIcon ? `<span class="ep-card__state" aria-label="${state === 'done' ? 'Ouvido' : 'Em andamento'}">${stateIcon}</span>` : ''}
        </div>
        <p class="ep-card__title">${escapeHTML(e.titulo)}</p>
        ${sinopseShort ? `<p class="ep-card__sinopse">${escapeHTML(sinopseShort)}</p>` : ''}
        ${e.parts.length > 1 ? `<p class="ep-card__parts">${e.parts.length} partes</p>` : ''}
      </button>`;
    }).join('');
  }

  function tituloCompleto(epObj, partObj) {
    const base = `EP ${pad2(epObj.ep)} — ${epObj.titulo}`;
    if (epObj.parts.length > 1) {
      const t = partObj.tituloParte ? partObj.tituloParte : `Parte ${partObj.parte}`;
      return `${base} • ${t}`;
    }
    return base;
  }

  function selecionarEp(idx) {
    selectedEp = idx;
    selectedPart = 0;
    renderEpGrid();
    renderPartes();
    atualizarSelecao();
    carregarVideo();
    const epNumber = SERIE.eps[idx].ep;
    location.hash = `ep${pad2(epNumber)}p${selectedPart + 1}`;
  }

  function renderPartes() {
    if (selectedEp === null) { partsArea.classList.add('hidden'); partsPills.innerHTML = ''; return; }
    const epObj = SERIE.eps[selectedEp];
    if (epObj.parts.length <= 1) { partsArea.classList.add('hidden'); partsPills.innerHTML = ''; return; }
    partsArea.classList.remove('hidden');
    partsPills.innerHTML = epObj.parts.map((p, pIdx) => {
      const label = p.tituloParte ? `P${p.parte}` : `Parte ${p.parte}`;
      const watched = isWatched(epObj.ep, p.parte);
      return `<button class="part-pill ${selectedPart === pIdx ? 'active' : ''} ${watched ? 'watched' : ''}"
                onclick="selecionarParte(${pIdx})"
                title="${escapeHTML(p.tituloParte || ('Parte ' + p.parte))}">
        ${label}${watched ? ' ✓' : ''}
      </button>`;
    }).join('');
  }

  function selecionarParte(pIdx) {
    selectedPart = pIdx;
    renderPartes();
    atualizarSelecao();
    carregarVideo();
    const epNumber = SERIE.eps[selectedEp].ep;
    location.hash = `ep${pad2(epNumber)}p${selectedPart + 1}`;
  }

  function atualizarSelecao() {
    if (selectedEp === null) {
      tituloEp.textContent = '—';
      subTituloEp.textContent = 'Escolha um episódio acima.';
      btnAssistir.disabled = true; btnAssistir.style.opacity = '.6';
      btnYoutube.disabled = true; btnYoutube.style.opacity = '.6';
      setNavDisabled(true);
      statusLine.textContent = 'Selecione um episódio para começar.';
      return;
    }
    const epObj = SERIE.eps[selectedEp];
    const partObj = epObj.parts[selectedPart];
    tituloEp.textContent = `EP ${pad2(epObj.ep)} — ${epObj.titulo}`;
    subTituloEp.textContent = (epObj.parts.length > 1)
      ? (partObj.tituloParte || `Parte ${partObj.parte}`)
      : 'Episódio único.';
    btnAssistir.disabled = false; btnAssistir.style.opacity = '1';
    btnYoutube.disabled = false; btnYoutube.style.opacity = '1';
    epSinopseText.textContent = epObj.sinopse || '';
    const hasParts = epObj.parts.length > 1;
    if (!hasParts) {
      setNavDisabled(true);
    } else {
      const isFirst = selectedPart === 0;
      const isLast  = selectedPart === epObj.parts.length - 1;
      btnPrev.disabled = isFirst; btnPrev.style.opacity = isFirst ? '.6' : '1';
      btnNext.disabled = isLast;  btnNext.style.opacity = isLast ? '.6' : '1';
      btnPrev2.disabled = isFirst; btnPrev2.style.opacity = isFirst ? '.6' : '1';
      btnNext2.disabled = isLast;  btnNext2.style.opacity = isLast ? '.6' : '1';
    }
    statusLine.textContent = `Pronto: ${tituloCompleto(epObj, partObj)}.`;
  }

  function setNavDisabled(disabled) {
    [btnPrev, btnNext, btnPrev2, btnNext2].forEach(b => {
      b.disabled = disabled; b.style.opacity = disabled ? '.6' : '1';
    });
  }

  function carregarVideo() {
    if (selectedEp === null) return;
    const epObj = SERIE.eps[selectedEp];
    const partObj = epObj.parts[selectedPart];
    ytFrame.src = `https://www.youtube-nocookie.com/embed/${partObj.videoId}?rel=0&modestbranding=1&playsinline=1`;
    nowTitle.textContent = tituloCompleto(epObj, partObj);
    playerHint.textContent = 'Clique em "Próxima parte" para avançar, ou escolha outro episódio.';
    saveProgress(epObj.ep, partObj.parte);
    renderEpGrid();
    renderPartes();
    document.dispatchEvent(new CustomEvent('adc:ep-selected', { detail: { ep: epObj.ep } }));
  }

  function abrirNoYoutube() {
    if (selectedEp === null) return;
    const partObj = SERIE.eps[selectedEp].parts[selectedPart];
    window.open(`https://www.youtube.com/watch?v=${partObj.videoId}`, '_blank', 'noopener,noreferrer');
  }

  function irParaParte(dir) {
    if (selectedEp === null) return;
    const epObj = SERIE.eps[selectedEp];
    if (epObj.parts.length <= 1) return;
    const next = selectedPart + dir;
    if (next < 0 || next >= epObj.parts.length) return;
    selecionarParte(next);
    scrollToSection('assistir');
  }

  function resetarSelecao() {
    selectedEp = null; selectedPart = 0;
    renderEpGrid(); renderPartes(); atualizarSelecao();
    ytFrame.src = 'about:blank';
    nowTitle.textContent = '—';
    epSinopseText.textContent = 'Selecione um episódio para ver a sinopse.';
    playerHint.textContent = 'Selecione um episódio para carregar o vídeo.';
    location.hash = '';
  }

  function escapeHTML(str) {
    return String(str)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  /* ===== Olhinhos ===== */
  (function () {
    const pairs = [
      ['toggleSinopse', 'sinopseBox', 'eyeOpen', 'eyeClosed'],
      ['toggleEpSinopse', 'epSinopseBox', 'eyeOpen2', 'eyeClosed2'],
    ];
    pairs.forEach(([btnId, boxId, openId, closedId]) => {
      const btn = document.getElementById(btnId);
      const box = document.getElementById(boxId);
      const eo  = document.getElementById(openId);
      const ec  = document.getElementById(closedId);
      let open = true;
      btn?.addEventListener('click', () => {
        open = !open;
        box.classList.toggle('hidden', !open);
        eo.classList.toggle('hidden', !open);
        ec.classList.toggle('hidden', open);
      });
    });
  })();

  /* ===== Init ===== */
  document.addEventListener('DOMContentLoaded', () => {
    renderEpGrid();
    atualizarSelecao();
    const h = (location.hash || '').replace('#', '').toLowerCase().trim();
    const m = h.match(/^ep(\d{2})p(\d+)$/);
    if (m) {
      const epNum  = parseInt(m[1], 10);
      const partNum = parseInt(m[2], 10);
      const idx = SERIE.eps.findIndex(e => e.ep === epNum);
      if (idx >= 0) {
        selectedEp = idx;
        const epObj = SERIE.eps[idx];
        selectedPart = Math.max(0, Math.min(epObj.parts.length - 1, partNum - 1));
        renderEpGrid(); renderPartes(); atualizarSelecao(); carregarVideo();
      }
    }
  });

  window.selecionarEp = selecionarEp;
  window.selecionarParte = selecionarParte;
  window.abrirNoYoutube = abrirNoYoutube;
  window.irParaParte = irParaParte;
  window.resetarSelecao = resetarSelecao;
})();
