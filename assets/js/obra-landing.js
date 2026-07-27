/**
 * Interações das landings de obra (WebLivro): ler, pagar, modal, sinopse.
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

  function lerLivro() {
    const slug = (OBRA.accessUrl || '').replace(/\.html$/, '');
    window.location.href = `/webLivros/${slug}.html`;
  }

  function irPagamento() {
    const item = encodeURIComponent(
      JSON.stringify({
        id: OBRA.id,
        nome: OBRA.nome,
        preco: OBRA.preco,
        imagem: OBRA.imagem,
        tipo: OBRA.tipo,
        accessUrl: OBRA.accessUrl,
      })
    );
    window.location.href = `/pagamento.html?add=${item}`;
  }

  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalTitle = document.getElementById('modalTitle');
  const modalImg = document.getElementById('modalImg');
  const modalDesc = document.getElementById('modalDesc');
  const modalWords = document.getElementById('modalWords');
  const modalTheme = document.getElementById('modalTheme');
  const modalLang = document.getElementById('modalLang');
  const modalPrice = document.getElementById('modalPrice');

  function abrirDetalhes(data) {
    if (!modalBackdrop) return;
    const d = data || OBRA;
    if (modalTitle) modalTitle.textContent = d.nome || '—';
    if (modalImg) {
      modalImg.src = d.imagem?.startsWith('/') ? d.imagem : `/${d.imagem || ''}`;
      modalImg.alt = `Capa: ${d.nome || 'WebLivro'}`;
    }
    if (modalDesc) modalDesc.textContent = d.descricao || '—';
    if (modalWords) modalWords.textContent = d.info?.palavras || '—';
    if (modalTheme) modalTheme.textContent = d.info?.tematica || d.info?.temática || '—';
    if (modalLang) modalLang.textContent = d.info?.idioma || '—';
    if (modalPrice) {
      modalPrice.textContent =
        typeof d.preco === 'number' ? `R$ ${d.preco.toFixed(2).replace('.', ',')}` : '—';
    }
    modalBackdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function fecharDetalhes() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('show');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-obra-action="ler"]').forEach((el) => {
    el.addEventListener('click', lerLivro);
  });
  document.querySelectorAll('[data-obra-action="pagar"]').forEach((el) => {
    el.addEventListener('click', irPagamento);
  });
  document.querySelectorAll('[data-obra-action="detalhes"]').forEach((el) => {
    el.addEventListener('click', () => abrirDetalhes(OBRA));
  });
  document.querySelectorAll('[data-obra-action="fechar-detalhes"]').forEach((el) => {
    el.addEventListener('click', fecharDetalhes);
  });

  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) fecharDetalhes();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop?.classList.contains('show')) fecharDetalhes();
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
