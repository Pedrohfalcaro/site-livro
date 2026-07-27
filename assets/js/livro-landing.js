/**
 * Interações das landings de livro físico: pagar, leitor de capítulo, sinopse.
 */
(function () {
  function getObra() {
    const el = document.getElementById('obra-config');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '{}');
    } catch {
      return null;
    }
  }

  const OBRA = getObra();
  if (!OBRA) return;

  function normalizeImagem(path) {
    if (!path) return path;
    if (path.startsWith('/')) return path;
    if (path.startsWith('imagens/')) return `/${path}`;
    return path;
  }

  function adicionarAoCarrinhoEIr() {
    if (typeof Cart === 'undefined') return;
    Cart.add(
      {
        id: OBRA.id,
        nome: OBRA.nome,
        descricao: OBRA.descricao,
        preco: OBRA.preco,
        imagem: normalizeImagem(OBRA.imagem),
        tipo: OBRA.tipo,
        info: OBRA.info,
      },
      1
    );
    window.location.href = '/pagamento.html';
  }

  const reader = document.getElementById('modalCapitulo');
  const scrollEl = document.getElementById('ldcReaderScroll');
  const progressEl = document.getElementById('ldcReaderProgress');

  function updateProgress() {
    if (!scrollEl || !progressEl) return;
    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    const pct = max > 0 ? (scrollEl.scrollTop / max) * 100 : 0;
    progressEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  function abrirCapitulo() {
    if (!reader) return;
    reader.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (scrollEl) {
      scrollEl.scrollTop = 0;
      updateProgress();
      scrollEl.focus({ preventScroll: true });
    }
  }

  function fecharCapitulo() {
    if (!reader) return;
    reader.classList.remove('show');
    document.body.style.overflow = '';
    if (progressEl) progressEl.style.width = '0%';
  }

  document.querySelectorAll('[data-obra-action="pagar"]').forEach((el) => {
    el.addEventListener('click', adicionarAoCarrinhoEIr);
  });
  document.querySelectorAll('[data-obra-action="capitulo"]').forEach((el) => {
    el.addEventListener('click', abrirCapitulo);
  });
  document.querySelectorAll('[data-obra-action="fechar-capitulo"]').forEach((el) => {
    el.addEventListener('click', fecharCapitulo);
  });

  scrollEl?.addEventListener('scroll', updateProgress, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader?.classList.contains('show')) fecharCapitulo();
  });

  const btn = document.getElementById('toggleSinopse');
  const box = document.getElementById('sinopseBox');
  const eyeOpen = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  let open = true;
  btn?.addEventListener('click', () => {
    open = !open;
    box?.classList.toggle('hidden', !open);
    eyeOpen?.classList.toggle('hidden', !open);
    eyeClosed?.classList.toggle('hidden', open);
  });
})();
