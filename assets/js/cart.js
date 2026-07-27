/**
 * Sacola de compras (localStorage key: "estante").
 * Expõe API global Cart e aliases legados (add, remover, getEstante, etc.).
 */
(function (global) {
  const STORAGE_KEY = 'estante';

  function getEstante() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setEstante(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function clearEstante() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function formatBRL(v) {
    try {
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return `R$ ${String(v).replace('.', ',')}`;
    }
  }

  function getTotals() {
    const estante = getEstante();
    return {
      itens: estante.reduce((s, x) => s + x.quantidade, 0),
      valor: estante.reduce((s, x) => s + x.preco * x.quantidade, 0),
    };
  }

  /**
   * Adiciona item à sacola.
   * Uso simples: add(nome, preco, imagem)
   * Uso completo: add({ nome, preco, imagem, descricao, ... }, qtd)
   */
  function add(nomeOrItem, preco, imagem) {
    let item;
    let qtd = 1;

    if (typeof nomeOrItem === 'object' && nomeOrItem !== null) {
      item = nomeOrItem;
      if (typeof preco === 'number') qtd = preco;
    } else {
      item = { nome: nomeOrItem, preco, imagem };
    }

    const estante = getEstante();
    const idx = estante.findIndex((x) => {
      if (item.id && x.id) return x.id === item.id;
      return x.nome === item.nome;
    });

    if (idx >= 0) {
      estante[idx].quantidade = (estante[idx].quantidade || 1) + qtd;
    } else {
      estante.push({
        id: item.id,
        nome: item.nome,
        descricao: item.descricao,
        preco: item.preco,
        imagem: item.imagem,
        youtube: item.youtube || null,
        tipo: item.tipo || 'livro',
        info: item.info || {},
        quantidade: qtd,
      });
    }

    setEstante(estante);
    atualizarSacola();
    return estante;
  }

  function remove(index) {
    const estante = getEstante();
    estante.splice(index, 1);
    setEstante(estante);
    atualizarSacola();
  }

  function atualizarSacola() {
    const lista = document.getElementById('listaEstante');
    const totalSpan = document.getElementById('totalValor');
    const contador = document.getElementById('sacolaContador');
    if (!lista && !totalSpan && !contador) return;

    const estante = getEstante();
    const { itens: totalItens, valor: totalValor } = getTotals();

    if (contador) {
      contador.textContent = totalItens;
      contador.classList.toggle('hidden', totalItens === 0);
    }

    if (!lista) return;

    if (estante.length === 0) {
      lista.innerHTML = `
        <div class="text-center py-10">
          <div class="text-5xl mb-3">📭</div>
          <p class="font-semibold">Sua sacola está vazia</p>
          <p class="text-sm muted2 mt-1">Adicione um item para começar.</p>
        </div>
      `;
      if (totalSpan) totalSpan.textContent = 'R$ 0,00';
      return;
    }

    lista.innerHTML = estante
      .map(
        (x, i) => `
    <div class="flex items-center gap-4 pb-4 border-b" style="border-color:var(--border)">
      <img src="${x.imagem}" class="w-14 h-20 object-cover rounded-xl border" style="border-color:var(--border)" alt="${x.nome}">
      <div class="flex-1">
        <h3 class="font-extrabold text-sm">${x.nome}</h3>
        <p class="text-xs muted2">R$ ${x.preco.toFixed(2)} × ${x.quantidade}</p>
        <p class="text-sm font-extrabold mt-1">R$ ${(x.preco * x.quantidade).toFixed(2)}</p>
      </div>
      <button class="btn btn-ghost !px-3 !py-2" onclick="remover(${i})">✕</button>
    </div>
  `
      )
      .join('');

    if (totalSpan) totalSpan.textContent = 'R$ ' + totalValor.toFixed(2);
  }

  function toggleEstante() {
    const drawer = document.getElementById('popupEstante');
    const overlay = document.getElementById('overlayEstante');
    if (!drawer || !overlay) return;

    const isOpen = drawer.classList.contains('open');

    if (isOpen) {
      drawer.classList.remove('open');
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    } else {
      drawer.classList.add('open');
      overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
      atualizarSacola();
    }
  }

  function initEscapeClose() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const drawer = document.getElementById('popupEstante');
      if (drawer?.classList.contains('open')) toggleEstante();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEscapeClose);
  } else {
    initEscapeClose();
  }

  const api = {
    STORAGE_KEY,
    getEstante,
    setEstante,
    clearEstante,
    add,
    addToEstante: add,
    remove,
    getTotals,
    formatBRL,
    atualizarSacola,
    toggleEstante,
  };

  global.Cart = api;

  // Aliases legados usados inline nos HTMLs
  global.getEstante = getEstante;
  global.setEstante = setEstante;
  global.add = add;
  global.addToEstante = add;
  global.remover = remove;
  global.atualizarSacola = atualizarSacola;
  global.toggleEstante = toggleEstante;
  global.formatBRL = formatBRL;
})(window);
