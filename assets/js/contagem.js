/**
 * Contagem regressiva (horas, minutos e segundos) até uma data.
 *
 * Qualquer elemento com data-contagem-ate="<ISO 8601>" é atualizado a cada segundo.
 *   data-contagem-modo="blocos"  → preenche filhos [data-c="h" | "m" | "s"] (visual grande, na home)
 *   (padrão)                     → escreve "38h 12m 09s" no próprio elemento
 *   data-contagem-prefixo="..."  → texto antes do tempo (ex.: "Disponível em ")
 *   data-contagem-fim="..."      → texto quando chega a zero (se ausente, o elemento é escondido)
 *
 * Ao chegar a zero dispara window "ho:lancou" (uma vez por data), para as páginas liberarem os botões.
 *
 * Pré-visualização: ?preview=1 libera o conteúdo como se a data já tivesse passado
 * (Contagem.liberado() devolve true), sem mexer na contagem exibida.
 */
(function (global) {
  'use strict';

  const PREVIEW_KEY = 'ho1-preview';
  const avisados = new Set();

  function preview() {
    try {
      if (new URLSearchParams(global.location.search).get('preview') === '1') sessionStorage.setItem(PREVIEW_KEY, '1');
      return sessionStorage.getItem(PREVIEW_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  const doisDigitos = (n) => String(n).padStart(2, '0');

  function partes(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
  }

  function atualizar(el) {
    const ate = Date.parse(el.dataset.contagemAte);
    if (!Number.isFinite(ate)) return;
    const falta = ate - Date.now();

    if (falta <= 0) {
      if (el.dataset.contagemFim) {
        el.textContent = el.dataset.contagemFim;
      } else {
        el.hidden = true;
      }
      el.classList.add('contagem-fim');
      if (!avisados.has(el.dataset.contagemAte)) {
        avisados.add(el.dataset.contagemAte);
        global.dispatchEvent(new CustomEvent('ho:lancou', { detail: { ate: el.dataset.contagemAte } }));
      }
      return;
    }

    const { h, m, s } = partes(falta);
    if (el.dataset.contagemModo === 'blocos') {
      const campos = { h: String(h), m: doisDigitos(m), s: doisDigitos(s) };
      el.querySelectorAll('[data-c]').forEach((c) => { c.textContent = campos[c.dataset.c]; });
    } else {
      el.textContent = `${el.dataset.contagemPrefixo || ''}${h}h ${doisDigitos(m)}m ${doisDigitos(s)}s`;
    }
  }

  function tick() {
    document.querySelectorAll('[data-contagem-ate]').forEach(atualizar);
  }

  function iniciar() {
    tick();
    global.setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  global.Contagem = {
    preview,
    /** true se a data já passou ou se está em pré-visualização (?preview=1). */
    liberado(iso) { return preview() || Date.now() >= Date.parse(iso); },
  };
})(window);
