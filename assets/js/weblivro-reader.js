/**
 * Leitor WebLivro: capítulos, progresso e gate de acesso.
 */
(function () {
  const configEl = document.getElementById('wl-config');
  if (!configEl) return;

  const config = JSON.parse(configEl.textContent || '{}');
  const panels = [...document.querySelectorAll('.wl-chapter-panel')];
  const capGrid = document.getElementById('wlCapGrid');
  const progressBar = document.getElementById('wlProgressBar');

  function unlock() {
    document.body.classList.remove('wl-locked');
    document.documentElement.style.overflow = '';
  }

  window.__wlUnlock = unlock;

  if (globalThis.AccessGate) {
    AccessGate.setupGate({
      config,
      unlock,
      inputId: 'wlGateInput',
      emailId: 'wlGateEmail',
      confirmId: 'wlGateConfirm',
      cancelId: 'wlGateCancel',
      msgId: 'wlGateMsg',
    });
  } else if (!config.gated) {
    unlock();
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

  // ===== Navegação de capítulos =====
  const capBtns = [];

  if (capGrid && panels.length) {
    for (let i = 0; i < panels.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wl-cap-btn' + (i === 0 ? ' active' : '');
      btn.textContent = String(i + 1);
      btn.setAttribute('aria-label', 'Capítulo ' + (i + 1));
      btn.addEventListener('click', () => setChapter(i));
      capGrid.appendChild(btn);
      capBtns.push(btn);
    }
  }

  function setChapter(index) {
    if (index < 0 || index >= panels.length) return;
    capBtns.forEach((b, i) => b.classList.toggle('active', i === index));
    panels.forEach((p, i) => {
      p.hidden = i !== index;
      if (i === index) {
        p.classList.remove('wl-chapter-panel');
        void p.offsetWidth;
        p.classList.add('wl-chapter-panel');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateProgress();
  }

  if (panels.length) setChapter(0);
})();
