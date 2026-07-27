/**
 * Catálogo único de produtos (loja) e contos.
 * Edite aqui para adicionar/alterar itens — as páginas leem desta fonte.
 */
(function (global) {
  const PRODUTOS = [
    {
      id: 'ldc1',
      tipo: 'livro',
      titulo: 'A Lenda do Caos — Tríplice Caótica',
      preco: 57.9,
      imagem: 'imagens/LdC1.png',
      link: 'obras/ldc1.html',
      leitor: null,
    },
    {
      id: 'idw',
      tipo: 'weblivro',
      titulo: 'O Incidente de Willowbrook',
      preco: 5.9,
      imagem: 'imagens/IdW.jpg',
      link: 'obras/idw.html',
      leitor: 'webLivros/idw.html',
    },
    {
      id: 'auc',
      tipo: 'weblivro',
      titulo: 'A Última Colheita',
      preco: 2.5,
      imagem: 'imagens/AUCcapa.png',
      link: 'obras/auc.html',
      leitor: 'webLivros/auc.html',
    },
  ];

  const CONTOS = [
    {
      id: 'o-chamado-das-profundezas',
      titulo: 'O Chamado das Profundezas',
      desc: 'Um conto sobre culpa, transformação e o preço de desafiar aquilo que jamais deveria ser despertado.',
      imagem: 'imagens/ChamadoProfundezasCapa.png',
      link: 'contos/o-chamado-das-profundezas.html',
      tags: ['emocional'],
      bgm: false,
    },
    {
      id: 'sonho-pirata',
      titulo: 'Sonho de pirata',
      desc: 'Um conto sobre discriminação, perseguição e manipulação. Mas acima de tud. O poder da liberdade para mudar o mundo.',
      imagem: 'imagens/ContoSonhoPirataCapa.png',
      link: 'contos/sonho-pirata.html',
      tags: ['emocional'],
      bgm: false,
    },
    {
      id: 'o-natal',
      titulo: 'O Natal',
      desc: 'Um conto sobre o tempo que passa e o que se recusa a mudar, contado através de um Natal que permanece.',
      imagem: 'imagens/ContoONCapa.png',
      link: 'contos/o-natal.html',
      tags: ['emocional'],
      bgm: true,
    },
    {
      id: 'meu-universo',
      titulo: 'Meu Universo',
      desc: 'Um conto ambientado entre estrelas, silêncio e decisões que mudam rotas.',
      imagem: 'imagens/ContoMUcapa.png',
      link: 'contos/meu-universo.html',
      tags: ['emocional'],
      bgm: true,
    },
    {
      id: 'a-voz-do-vazio',
      titulo: 'A voz do vazio',
      desc: 'Um conto sobre o luto e a esperança, contado através de reinos que caem e ascendem do vazio.',
      imagem: 'imagens/ContoVdVcapa.png',
      link: 'contos/a-voz-do-vazio.html',
      tags: ['emocional'],
      bgm: true,
    },
    {
      id: 'meus-monstros',
      titulo: 'Meus Monstros',
      desc: 'Um conto sobre insegurança e dores carregadas pela vida.',
      imagem: 'imagens/ContosMM.jpg',
      link: 'contos/meus-monstros.html',
      tags: ['suspense'],
      bgm: false,
    },
    {
      id: 'jardineiro-do-inferno',
      titulo: 'Jardineiro do Inferno',
      desc: 'Um conto sobre suspense e horror de uma vida miserável.',
      imagem: 'imagens/ContoJdIcapa.png',
      link: 'contos/jardineiro-do-inferno.html',
      tags: ['suspense'],
      bgm: false,
    },
  ];

  /** Resolve caminhos do catálogo a partir da profundidade da página atual. */
  function assetBase() {
    const path = global.location?.pathname || '';
    if (path.includes('/obras/') || path.includes('/contos/') || path.includes('/webLivros/') || path.includes('/pagamentos/')) {
      return '../';
    }
    return '';
  }

  function resolvePath(relativePath) {
    if (!relativePath || relativePath.startsWith('http') || relativePath.startsWith('/')) {
      return relativePath;
    }
    return assetBase() + relativePath;
  }

  function getProdutos() {
    return PRODUTOS.map((p) => ({
      ...p,
      imagem: resolvePath(p.imagem),
      link: resolvePath(p.link),
      leitor: p.leitor ? resolvePath(p.leitor) : null,
    }));
  }

  function getContos() {
    return CONTOS.map((c) => ({
      ...c,
      imagem: resolvePath(c.imagem),
      link: resolvePath(c.link),
    }));
  }

  function getProdutoById(id) {
    return PRODUTOS.find((p) => p.id === id) || null;
  }

  global.Catalog = {
    produtos: PRODUTOS,
    contos: CONTOS,
    getProdutos,
    getContos,
    getProdutoById,
    resolvePath,
    assetBase,
  };

  // Aliases legados
  global.PRODUTOS = PRODUTOS;
  global.CONTOS = CONTOS;
})(window);
