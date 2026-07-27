/**
 * Leitor de contos: partes, progresso, gate e BGM opcional.
 */
(function () {
  const configEl = document.getElementById('conto-config');
  if (!configEl) return;

  const config = JSON.parse(configEl.textContent || '{}');
  const panels = [...document.querySelectorAll('.conto-chapter-panel')];
  const partsWrap = document.getElementById('contoParts');
  const progressBar = document.getElementById('contoProgressBar');

  function unlockConto() {
    document.body.classList.remove('conto-locked');
    document.documentElement.style.overflow = '';
  }

  if (globalThis.AccessGate) {
    AccessGate.setupGate({
      config,
      unlock: unlockConto,
      inputId: 'contoGateInput',
      emailId: 'contoGateEmail',
      confirmId: 'contoGateConfirm',
      cancelId: 'contoGateCancel',
      msgId: 'contoGateMsg',
    });
  } else if (!config.gated) {
    unlockConto();
  }

  // ===== Progresso de scroll =====
  function updateProgress() {
    if (!progressBar) return;
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    const pct = total > 0 ? (doc.scrollTop / total) * 100 : 0;
    progressBar.style.width = pct + '%';
  }

  document.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  // ===== Navegação de partes =====
  const partBtns = [];

  if (partsWrap && panels.length) {
    panels.forEach((panel, i) => {
      const label = panel.dataset.label || `Parte ${i + 1}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'conto-part-btn' + (i === 0 ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => setPart(i));
      partsWrap.appendChild(btn);
      partBtns.push(btn);
    });
  }

  function setPart(index) {
    if (typeof index !== 'number' || index < 0 || index >= panels.length) return;

    partBtns.forEach((b, i) => b.classList.toggle('active', i === index));
    panels.forEach((p, i) => {
      p.classList.toggle('active', i === index);
      p.hidden = false;
    });

    if (config.temaParte2 && index === 1) {
      document.body.classList.add('conto-alt-theme');
    } else {
      document.body.classList.remove('conto-alt-theme');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateProgress();
  }

  if (panels.length) setPart(0);

  // ===== BGM =====
  const audio = document.getElementById('contoBgm');
  const toggle = document.getElementById('contoBgmToggle');
  const vol = document.getElementById('contoBgmVol');

  if (audio && toggle && vol) {
    const savedVol = parseFloat(localStorage.getItem('bgmVol') || '0.15');
    const savedPlay = localStorage.getItem('bgmPlay') === '1';

    audio.volume = Number.isNaN(savedVol) ? 0.15 : savedVol;
    vol.value = String(audio.volume);

    const updateLabel = () => {
      toggle.textContent = audio.paused ? 'Música: Off' : 'Música: On';
    };

    toggle.addEventListener('click', async () => {
      try {
        if (audio.paused) {
          await audio.play();
          localStorage.setItem('bgmPlay', '1');
        } else {
          audio.pause();
          localStorage.setItem('bgmPlay', '0');
        }
        updateLabel();
      } catch (e) {
        console.warn('Playback bloqueado:', e);
      }
    });

    vol.addEventListener('input', () => {
      audio.volume = parseFloat(vol.value);
      localStorage.setItem('bgmVol', String(audio.volume));
    });

    if (savedPlay) {
      audio.play().then(updateLabel).catch(() => updateLabel());
    } else {
      updateLabel();
    }

    document.addEventListener(
      'pointerdown',
      () => {
        if (audio.paused && savedPlay) audio.play().catch(() => {});
      },
      { once: true }
    );
  }
})();
