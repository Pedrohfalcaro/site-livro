/**
 * Alternância de tema claro/escuro (localStorage key: "theme").
 * Auto-inicializa nos botões #temaClaro, #temaEscuro, #temaClaroM, #temaEscuroM.
 */
(function (global) {
  const KEY = 'theme';

  function apply(theme) {
    if (document.body.classList.contains('reader-page')) return;
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }

  function setTheme(theme) {
    localStorage.setItem(KEY, theme);
    apply(theme);
  }

  function getTheme() {
    return localStorage.getItem(KEY) || 'light';
  }

  function init() {
    apply(getTheme());

    const bindings = [
      ['temaClaro', 'light'],
      ['temaEscuro', 'dark'],
      ['temaClaroM', 'light'],
      ['temaEscuroM', 'dark'],
    ];

    for (const [id, theme] of bindings) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => setTheme(theme));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.Theme = { apply, setTheme, getTheme, init };
})(window);
