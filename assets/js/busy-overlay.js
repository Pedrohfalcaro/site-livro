/* Overlay de tela cheia pra segurar o usuário enquanto o backend responde
   (o Render demora pra "esquentar" quando fica sem uso). */
(function () {
  var el = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'busy-overlay';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.innerHTML =
      '<div class="busy-overlay-box">' +
      '<div class="busy-spinner" aria-hidden="true"></div>' +
      '<p class="busy-overlay-text" data-busy-text></p>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function show(mensagem) {
    var node = ensureEl();
    node.querySelector('[data-busy-text]').textContent =
      mensagem || 'Aguardando resposta do sistema…';
    node.classList.add('show');
  }

  function hide() {
    if (el) el.classList.remove('show');
  }

  window.BusyOverlay = { show: show, hide: hide };
})();
