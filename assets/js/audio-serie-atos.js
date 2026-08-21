/**
 * Player áudio-série (atos) com progresso localStorage
 */
(function () {
  const STORAGE_KEY = 'adc-spf-progress';

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
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { watched: [], lastAto: null }; }
    catch { return { watched: [], lastAto: null }; }
  }

  function saveProgress(idx) {
    const p = loadProgress();
    const item = SERIE.itens[idx];
    p.lastAto = item.tipo === 'Trailer' ? 0 : item.numero;
    const key = String(idx);
    if (!p.watched.includes(key)) p.watched.push(key);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }

  function isWatched(idx) {
    return loadProgress().watched.includes(String(idx));
  }

  /* ===== Estado ===== */
  let selectedIdx = null;

  /* ===== Elementos ===== */
  const atoGrid      = document.getElementById('atoGrid');
  const tituloAto    = document.getElementById('tituloAto');
  const subTituloAto = document.getElementById('subTituloAto');
  const btnAssistir  = document.getElementById('btnAssistir');
  const btnYoutube   = document.getElementById('btnYoutube');
  const btnPrev      = document.getElementById('btnPrev');
  const btnNext      = document.getElementById('btnNext');
  const btnPrev2     = document.getElementById('btnPrev2');
  const btnNext2     = document.getElementById('btnNext2');
  const ytFrame      = document.getElementById('ytFrame');
  const playerHint   = document.getElementById('playerHint');
  const nowTitle     = document.getElementById('nowTitle');
  const statusLine   = document.getElementById('statusLine');
  const atoSinopseText = document.getElementById('atoSinopseText');

  function labelBotao(item, idx) {
    const watched = isWatched(idx);
    const label = item.tipo === 'Trailer' ? 'Trailer' : `Ato ${String(item.numero).padStart(2, '0')}`;
    return watched ? `${label} ✓` : label;
  }

  function tituloCompleto(item) {
    if (item.tipo === 'Trailer') return `TRAILER — ${SERIE.nome}`;
    return `ATO ${String(item.numero).padStart(2, '0')} — ${item.titulo}`;
  }

  function escapeHTML(str) {
    return String(str)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function renderGrid() {
    atoGrid.innerHTML = SERIE.itens.map((item, idx) => {
      const watched = isWatched(idx);
      const isActive = selectedIdx === idx;
      const sinopseShort = item.sinopse
        ? item.sinopse.replace(/\n/g, ' ').slice(0, 90) + (item.sinopse.length > 90 ? '…' : '')
        : '';
      return `<button class="ato-card ${isActive ? 'active' : ''} ${watched ? 'watched' : ''}"
                onclick="selecionar(${idx})"
                aria-label="Selecionar ${labelBotao(item, idx)}"
                data-tipo="${item.tipo}">
        <p class="ato-card__label">${escapeHTML(item.tipo === 'Trailer' ? 'Trailer' : `Ato ${String(item.numero).padStart(2, '0')}`)}</p>
        <p class="ato-card__title">${escapeHTML(item.titulo)}</p>
        ${sinopseShort ? `<p class="ato-card__sinopse">${escapeHTML(sinopseShort)}</p>` : ''}
        ${watched ? '<span class="ato-card__badge">✓</span>' : ''}
      </button>`;
    }).join('');
  }

  function selecionar(idx) {
    selectedIdx = idx;
    renderGrid();
    atualizarSelecao();
    carregarVideo();
    const item = SERIE.itens[idx];
    const h = item.tipo === 'Trailer' ? 'trailer' : `ato${String(item.numero).padStart(2, '0')}`;
    location.hash = h;
  }

  function atualizarSelecao() {
    if (selectedIdx === null) {
      tituloAto.textContent = '—';
      subTituloAto.textContent = 'Escolha um item acima.';
      btnAssistir.disabled = true; btnAssistir.style.opacity = '.6';
      btnYoutube.disabled = true; btnYoutube.style.opacity = '.6';
      setNavDisabled(true);
      statusLine.textContent = 'Selecione o Trailer ou um Ato para começar.';
      return;
    }
    const item = SERIE.itens[selectedIdx];
    tituloAto.textContent = tituloCompleto(item);
    subTituloAto.textContent = item.subtitulo || '';
    btnAssistir.disabled = false; btnAssistir.style.opacity = '1';
    btnYoutube.disabled = false; btnYoutube.style.opacity = '1';
    atoSinopseText.textContent = item.sinopse || '—';
    const isFirst = selectedIdx === 0;
    const isLast  = selectedIdx === SERIE.itens.length - 1;
    btnPrev.disabled = isFirst; btnPrev.style.opacity = isFirst ? '.6' : '1';
    btnNext.disabled = isLast;  btnNext.style.opacity = isLast ? '.6' : '1';
    btnPrev2.disabled = isFirst; btnPrev2.style.opacity = isFirst ? '.6' : '1';
    btnNext2.disabled = isLast;  btnNext2.style.opacity = isLast ? '.6' : '1';
    statusLine.textContent = `Pronto: ${tituloCompleto(item)}.`;
  }

  function setNavDisabled(disabled) {
    [btnPrev, btnNext, btnPrev2, btnNext2].forEach(b => {
      b.disabled = disabled; b.style.opacity = disabled ? '.6' : '1';
    });
  }

  function carregarVideo() {
    if (selectedIdx === null) return;
    const item = SERIE.itens[selectedIdx];
    ytFrame.src = `https://www.youtube-nocookie.com/embed/${item.videoId}?rel=0&modestbranding=1&playsinline=1`;
    nowTitle.textContent = tituloCompleto(item);
    playerHint.textContent = 'Clique em "Próximo" para avançar, ou escolha outro ato.';
    saveProgress(selectedIdx);
    renderGrid();
    const item = SERIE.itens[selectedIdx];
    const capNum = item.tipo === 'Trailer' ? 0 : item.numero;
    document.dispatchEvent(new CustomEvent('adc:ato-selected', { detail: { cap: capNum } }));
  }

  function abrirNoYoutube() {
    if (selectedIdx === null) return;
    const item = SERIE.itens[selectedIdx];
    window.open(`https://www.youtube.com/watch?v=${item.videoId}`, '_blank', 'noopener,noreferrer');
  }

  function irParaAto(dir) {
    if (selectedIdx === null) return;
    const next = selectedIdx + dir;
    if (next < 0 || next >= SERIE.itens.length) return;
    selecionar(next);
    scrollToSection('assistir');
  }

  function resetarSelecao() {
    selectedIdx = null;
    renderGrid(); atualizarSelecao();
    ytFrame.src = 'about:blank';
    nowTitle.textContent = '—';
    atoSinopseText.textContent = 'Selecione um item para ver a sinopse.';
    playerHint.textContent = 'Selecione o Trailer ou um Ato para carregar o vídeo.';
    location.hash = '';
  }

  /* ===== Olhinhos ===== */
  (function () {
    const pairs = [
      ['toggleSinopse', 'sinopseBox', 'eyeOpen', 'eyeClosed'],
      ['toggleAtoSinopse', 'atoSinopseBox', 'eyeOpen2', 'eyeClosed2'],
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
    renderGrid();
    atualizarSelecao();
    const h = (location.hash || '').replace('#', '').toLowerCase().trim();
    if (!h) return;
    let idx = -1;
    if (h === 'trailer') { idx = 0; }
    else {
      const m = h.match(/^ato(\d{2})$/);
      if (m) {
        const n = parseInt(m[1], 10);
        idx = SERIE.itens.findIndex(it => it.tipo === 'Ato' && it.numero === n);
      }
    }
    if (idx >= 0) { selectedIdx = idx; renderGrid(); atualizarSelecao(); carregarVideo(); }
  });

  window.selecionar = selecionar;
  window.abrirNoYoutube = abrirNoYoutube;
  window.irParaAto = irParaAto;
  window.resetarSelecao = resetarSelecao;
})();
