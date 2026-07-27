/**
 * Menu mobile da navbar (páginas HTML estáticas).
 */
(function () {
  function init() {
    const btnMenu = document.getElementById('btnMobileMenu');
    const panel = document.getElementById('mobileNavPanel');
    if (!btnMenu || !panel) return;

    btnMenu.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      btnMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    panel.querySelectorAll('a, button[data-scroll]').forEach((el) => {
      el.addEventListener('click', () => {
        panel.classList.remove('open');
        btnMenu.setAttribute('aria-expanded', 'false');
      });
    });

    panel.querySelectorAll('[data-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.scroll;
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
