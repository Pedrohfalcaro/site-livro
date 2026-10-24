/**
 * Leitor gamificado e imersivo — Horrores Ocultos: Volume 1.
 *
 * Entrada só por e-mail (sem senha). O backend guarda quem entrou/quando e o progresso
 * (atos concluídos) por e-mail; aqui só desenhamos o estado que ele devolve.
 *
 *   mapa dos 4 contos  →  conto (atos em sequência)  →  conclusão do conto + comentário
 *
 * Imersão: trilha por ato (horrores-audio.js), clima visual por ato, chuva em canvas,
 * batida do coração sincronizada e palavras coloridas que tocam efeitos sonoros.
 * Tudo configurável em src/data/horrores-imersao.json.
 *
 * Endpoints: POST /reader/enter | /reader/ato   (ver site-livro-backend)
 */
(function () {
  'use strict';

  const cfg = JSON.parse(document.getElementById('ho-config').textContent);
  const OBRA = cfg.obra;
  const CONTOS = cfg.contos;
  const IM = cfg.imersao;
  const EMAIL_KEY = 'ho1-email';
  const PREVIEW_KEY = 'ho1-preview';
  const REDUZIR = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const apiBase = window.ApiBase ? window.ApiBase.resolveApiBase() : 'https://site-livro-backend.onrender.com';
  const Audio = window.HorroresAudio;

  const views = {
    espera: $('hoEspera'),
    gate: $('hoGate'),
    mapa: $('hoMapa'),
    conto: $('hoConto'),
    fim: $('hoFim'),
  };

  const app = { email: '', state: null, conto: 1, ato: 1, busy: false };

  /* ---------- utilidades ---------- */

  function lsGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* sem storage: segue sem lembrar */ }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function show(name) {
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    $('hoSom').hidden = !(Audio && Audio.supported) || name === 'gate' || name === 'espera';
    window.scrollTo({ top: 0, behavior: REDUZIR ? 'auto' : 'smooth' });
  }

  async function api(path, body) {
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obra: OBRA, email: app.email, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Algo deu errado. Tente de novo.');
    return data;
  }

  /* ---------- regras de desbloqueio (espelham o backend) ---------- */

  const contoState = (n) => app.state.contos[n - 1];
  const contoLiberado = (n) => n === 1 || contoState(n - 1).concluido;
  const atoConcluido = (c, a) => contoState(c).atosConcluidos.includes(a);
  const atoLiberado = (c, a) => contoLiberado(c) && (a === 1 || atoConcluido(c, a - 1));
  const proximoAtoAberto = (c) => {
    const st = contoState(c);
    return st.concluido ? 1 : st.atosConcluidos.length + 1;
  };
  const totalGeral = () => app.state.contos.reduce((s, c) => s + c.totalAtos, 0);
  const feitosGeral = () => app.state.contos.reduce((s, c) => s + c.atosConcluidos.length, 0);

  /* ---------- lançamento ---------- */

  function liberado() {
    if (Date.now() >= Date.parse(cfg.lancamentoISO)) return true;
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    try {
      if (new URLSearchParams(location.search).get('preview') === '1') sessionStorage.setItem(PREVIEW_KEY, '1');
      return sessionStorage.getItem(PREVIEW_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  /* =====================================================================
     IMERSÃO: som, clima visual, chuva, batida, palavras clicáveis
     ===================================================================== */

  function cenaDoAto(conto, ato) {
    const porConto = IM.contos[String(conto)] || {};
    const cfgAto = porConto[String(ato)] || IM.contos.padrao;
    return { layers: IM.cenas[cfgAto.cena] || IM.cenas.suspense, clima: cfgAto.clima || 'noite' };
  }

  function aplicarCena(layers, clima) {
    $('hoClima').dataset.clima = clima;
    clima === 'chuva' ? iniciarChuva() : pararChuva();
    if (Audio && Audio.supported) Audio.scene(layers);
  }

  // desbloqueia o áudio em qualquer clique/toque (exigência dos navegadores)
  document.addEventListener('pointerdown', () => { if (Audio) Audio.unlock(); }, { capture: true });

  function syncSomUI() {
    if (!Audio || !Audio.supported) return;
    const on = Audio.isEnabled();
    $('hoSomBtn').textContent = on ? '🔊' : '🔇';
    $('hoSomBtn').setAttribute('aria-pressed', String(on));
    $('hoSomMapa').textContent = on ? '🔊 Som ligado' : '🔇 Som desligado';
    $('hoSomMapa').setAttribute('aria-pressed', String(on));
    $('hoSomVol').value = Math.round(Audio.volume() * 100);
    $('hoSomFx').setAttribute('aria-pressed', String(Audio.sfxEnabled()));
    $('hoSomFx').classList.toggle('is-off', !Audio.sfxEnabled());
    $('hoApp').classList.toggle('ho-mudo', !on);
  }

  function alternarSom() {
    Audio.setEnabled(!Audio.isEnabled());
    syncSomUI();
  }

  if (Audio && Audio.supported) {
    $('hoSomBtn').addEventListener('click', alternarSom);
    $('hoSomMapa').addEventListener('click', alternarSom);
    $('hoSomVol').addEventListener('input', (ev) => Audio.setVolume(Number(ev.target.value) / 100));
    $('hoSomFx').addEventListener('click', () => { Audio.setSfxEnabled(!Audio.sfxEnabled()); syncSomUI(); });
    syncSomUI();
  } else {
    $('hoSomMapa').hidden = true;
  }

  // batida do coração: pulso vermelho nas bordas
  window.addEventListener('ho:heartbeat', () => {
    if (REDUZIR) return;
    const el = $('hoClima');
    el.classList.remove('beat');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('beat');
  });

  /* ----- chuva (canvas) ----- */

  const chuva = { ativa: false, raf: 0, gotas: [] };

  function novaGota(w, h, inicio) {
    return {
      x: Math.random() * (w + 200) - 100,
      y: inicio ? Math.random() * h : -30,
      len: 14 + Math.random() * 22,
      v: 14 + Math.random() * 14,
      a: 0.18 + Math.random() * 0.3,
    };
  }

  function iniciarChuva() {
    if (chuva.ativa || REDUZIR) return;
    const cv = $('hoChuva');
    const ctx = cv.getContext('2d');
    chuva.ativa = true;
    cv.classList.add('is-on');
    const ajustar = () => { cv.width = window.innerWidth; cv.height = window.innerHeight; };
    ajustar();
    window.addEventListener('resize', ajustar);
    chuva.ajustar = ajustar;
    chuva.gotas = Array.from({ length: 170 }, () => novaGota(cv.width, cv.height, true));

    const quadro = () => {
      if (!chuva.ativa) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineWidth = 1.1;
      for (const g of chuva.gotas) {
        ctx.strokeStyle = `rgba(185,210,255,${g.a})`;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x - g.len * 0.28, g.y + g.len);
        ctx.stroke();
        g.y += g.v; g.x -= g.v * 0.28;
        if (g.y > cv.height || g.x < -40) Object.assign(g, novaGota(cv.width, cv.height, false));
      }
      chuva.raf = requestAnimationFrame(quadro);
    };
    quadro();
  }

  function pararChuva() {
    if (!chuva.ativa) return;
    chuva.ativa = false;
    cancelAnimationFrame(chuva.raf);
    window.removeEventListener('resize', chuva.ajustar);
    const cv = $('hoChuva');
    cv.classList.remove('is-on');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  }

  /* ----- palavras clicáveis ----- */

  const LETRA = '\\p{L}';

  function textNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.data.trim()) return NodeFilter.FILTER_REJECT;
        return n.parentElement.closest('.ho-w, h3, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  /** Troca um trecho de um nó de texto por um botão de palavra. */
  function envolver(node, inicio, palavra, sfx, cor) {
    const meio = node.splitText(inicio);
    meio.splitText(palavra.length);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ho-w ho-w--${cor}`;
    btn.dataset.sfx = sfx;
    btn.setAttribute('aria-label', `Efeito sonoro: ${palavra}`);
    btn.textContent = meio.data;
    meio.replaceWith(btn);
  }

  function marcarPalavras(root) {
    // 1) marcações manuais do autor: {{palavra|sfx}}
    const manual = /\{\{([^|}]+)\|([a-z]+)\}\}/;
    for (const node of textNodes(root)) {
      let atual = node;
      let m;
      while (atual && (m = manual.exec(atual.data))) {
        const cor = (IM.palavras.lista.find((e) => e.sfx === m[2]) || {}).cor || 'ambiente';
        const inicio = m.index;
        const meio = atual.splitText(inicio);
        const resto = meio.splitText(m[0].length);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ho-w ho-w--${cor}`;
        btn.dataset.sfx = m[2];
        btn.setAttribute('aria-label', `Efeito sonoro: ${m[1]}`);
        btn.textContent = m[1];
        meio.replaceWith(btn);
        atual = resto;
      }
    }

    // mensagens de chat ("Laura: oi") viram balões; o nome toca o som de mensagem
    const nomes = IM.palavras.chat || [];
    if (nomes.length) {
      const re = new RegExp(`^(${nomes.join('|')}):\\s`);
      root.querySelectorAll('p').forEach((p) => {
        const m = re.exec(p.textContent);
        if (!m) return;
        p.classList.add('ho-zap');
        if (p.firstChild && p.firstChild.nodeType === 3) envolver(p.firstChild, 0, `${m[1]}:`, 'mensagem', 'ambiente');
      });
    }

    // 2) dicionário automático (limitado por ato para não poluir o texto)
    for (const entrada of IM.palavras.lista) {
      const re = new RegExp(`(^|[^${LETRA}])(${entrada.regex})(?![${LETRA}])`, 'iu');
      for (let n = 0; n < IM.palavras.limite; n += 1) {
        let achou = false;
        for (const node of textNodes(root)) {
          const m = re.exec(node.data);
          if (!m) continue;
          envolver(node, m.index + m[1].length, m[2], entrada.sfx, entrada.cor);
          achou = true;
          break;
        }
        if (!achou) break;
      }
    }
  }

  $('hoAtoTexto').addEventListener('click', (ev) => {
    const w = ev.target.closest('.ho-w');
    if (!w) return;
    if (Audio) { Audio.unlock(); Audio.sfx(w.dataset.sfx); }
    if (navigator.vibrate && ['corte', 'batida', 'coracao', 'estalo'].includes(w.dataset.sfx)) navigator.vibrate(30);
    w.classList.remove('is-ping');
    void w.offsetWidth;
    w.classList.add('is-ping');
  });

  /* ----- revelar parágrafos ao rolar ----- */

  let observador = null;
  function revelar(root) {
    if (observador) observador.disconnect();
    const alvos = [...root.children];
    if (REDUZIR || !('IntersectionObserver' in window)) { alvos.forEach((el) => el.classList.add('is-in')); return; }
    alvos.forEach((el) => el.classList.add('ho-rv'));
    observador = new IntersectionObserver((itens) => {
      itens.forEach((i) => { if (i.isIntersecting) { i.target.classList.add('is-in'); observador.unobserve(i.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    alvos.forEach((el) => observador.observe(el));
  }

  /* ---------- entrada ---------- */

  async function entrar(email, { silencioso = false } = {}) {
    app.email = email;
    const msg = $('hoGateMsg');
    const btn = $('hoGateBtn');
    if (!silencioso) {
      btn.disabled = true;
      msg.className = 'ho-msg';
      msg.textContent = 'Entrando… na primeira vez o servidor pode levar alguns segundos para acordar.';
    }
    try {
      const data = await api('/reader/enter', {});
      app.state = data.state;
      lsSet(EMAIL_KEY, email);
      renderMapa();
      show('mapa');
      aplicarCena(IM.cenas.menu, 'menu');
    } catch (err) {
      // mantém o e-mail lembrado: a falha pode ser só o servidor fora do ar
      app.email = '';
      $('hoEmail').value = email;
      show('gate');
      msg.className = 'ho-msg ho-msg--err';
      msg.textContent = err.message || 'Não foi possível entrar agora.';
    } finally {
      btn.disabled = false;
    }
  }

  $('hoGateForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (Audio) Audio.unlock();
    const email = $('hoEmail').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('hoGateMsg').className = 'ho-msg ho-msg--err';
      $('hoGateMsg').textContent = 'Digite um e-mail válido.';
      return;
    }
    entrar(email);
  });

  $('hoTrocarEmail').addEventListener('click', () => {
    lsDel(EMAIL_KEY);
    app.email = '';
    app.state = null;
    $('hoEmail').value = '';
    $('hoGateMsg').textContent = '';
    if (Audio) Audio.stop(1);
    pararChuva();
    show('gate');
    $('hoEmail').focus();
  });

  /* ---------- mapa ---------- */

  function renderMapa() {
    $('hoMapaEmail').textContent = app.email;
    const pct = Math.round((feitosGeral() / totalGeral()) * 100);
    $('hoMapaPct').textContent = `${pct}%`;
    $('hoMapaBar').style.width = `${pct}%`;

    $('hoTrilha').innerHTML = CONTOS.map((c) => {
      const st = contoState(c.numero);
      const aberto = contoLiberado(c.numero);
      const feitos = st.atosConcluidos.length;
      const estado = st.concluido ? 'is-done' : aberto ? 'is-open' : 'is-locked';
      const icone = st.concluido ? '✓' : aberto ? c.numero : '🔒';
      const rotulo = st.concluido ? 'Reler' : feitos > 0 ? 'Continuar' : 'Começar';
      const acao = aberto
        ? `<button type="button" class="btn btn-primary" data-abrir-conto="${c.numero}">${rotulo}</button>`
        : `<button type="button" class="btn btn-ghost" disabled aria-disabled="true">🔒 Conclua o conto ${c.numero - 1}</button>`;
      return `
        <li class="ho-node ${estado}">
          <span class="ho-node__badge" aria-hidden="true">${icone}</span>
          <div class="surface ho-node__card">
            <p class="ho-kicker">Conto ${c.numero}</p>
            <h3 class="ho-node__title">${esc(c.titulo)}</h3>
            <p class="text-sm muted mt-1">${esc(c.resumo)}</p>
            <div class="flex items-center justify-between text-xs font-extrabold muted2 mt-4">
              <span>${feitos} de ${c.atos} atos</span>
              <span>${st.concluido ? 'Concluído' : aberto ? 'Liberado' : 'Bloqueado'}</span>
            </div>
            <div class="ho-bar ho-bar--thin mt-2"><div class="ho-bar__fill" style="width:${Math.round((feitos / c.atos) * 100)}%"></div></div>
            <div class="mt-4">${acao}</div>
          </div>
        </li>`;
    }).join('');
  }

  $('hoTrilha').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-abrir-conto]');
    if (!btn) return;
    const n = Number(btn.dataset.abrirConto);
    abrirAto(n, proximoAtoAberto(n));
  });

  /* ---------- conto / atos ---------- */

  function renderAtoGrid() {
    const st = contoState(app.conto);
    $('hoAtoGrid').innerHTML = Array.from({ length: st.totalAtos }, (_, i) => {
      const a = i + 1;
      const feito = atoConcluido(app.conto, a);
      const aberto = atoLiberado(app.conto, a);
      const atual = a === app.ato;
      const cls = ['ho-ato', feito ? 'is-done' : aberto ? 'is-open' : 'is-locked', atual ? 'is-current' : ''].join(' ');
      const rotulo = feito ? '✓' : aberto ? a : '🔒';
      const dica = feito ? `Ato ${a} (concluído)` : aberto ? `Ato ${a}` : `Ato ${a} (bloqueado)`;
      return `<li><button type="button" class="${cls}" data-ato="${a}" ${aberto ? '' : 'disabled aria-disabled="true"'}
        ${atual ? 'aria-current="true"' : ''} aria-label="${dica}" title="${dica}">${rotulo}</button></li>`;
    }).join('');
  }

  const DICA = `
    <p id="hoDica" class="ho-dica">
      🎧 Palavras coloridas fazem barulho — toque nelas:
      <span class="ho-w ho-w--sangue ho-w--leg">sangue e corpo</span>
      <span class="ho-w ho-w--criatura ho-w--leg">a criatura</span>
      <span class="ho-w ho-w--ambiente ho-w--leg">ambiente</span>
    </p>`;

  function abrirAto(conto, ato) {
    app.conto = conto;
    app.ato = ato;
    const meta = CONTOS[conto - 1];
    const st = contoState(conto);

    $('hoContoKicker').textContent = `Conto ${conto} de ${CONTOS.length}`;
    $('hoContoTitulo').textContent = meta.titulo;
    const pct = Math.round((st.atosConcluidos.length / st.totalAtos) * 100);
    $('hoContoPct').textContent = `${st.atosConcluidos.length} de ${st.totalAtos}`;
    $('hoContoBar').style.width = `${pct}%`;
    renderAtoGrid();

    const tpl = document.querySelector(`#hoTextos template[data-conto="${conto}"][data-ato="${ato}"]`);
    $('hoAtoKicker').textContent = `Ato ${ato} de ${st.totalAtos}`;
    const tituloAto = tpl ? tpl.dataset.titulo : `Ato ${ato}`;
    $('hoAtoTitulo').textContent = tituloAto;
    $('hoAtoTitulo').hidden = /^Ato\s/i.test(tituloAto); // atos sem nome: só o rótulo "Ato N de M"
    const texto = $('hoAtoTexto');
    texto.innerHTML = '';
    if (tpl) texto.appendChild(tpl.content.cloneNode(true));
    else texto.textContent = 'Texto indisponível.';
    marcarPalavras(texto);
    revelar(texto);

    if (!$('hoDica')) texto.insertAdjacentHTML('beforebegin', DICA);

    $('hoAtoMsg').textContent = '';
    $('hoAtoAnterior').hidden = ato === 1;

    const feito = atoConcluido(conto, ato);
    const ultimo = ato === st.totalAtos;
    const btn = $('hoAtoAvancar');
    btn.disabled = false;
    if (ultimo) btn.textContent = feito ? 'Ver conclusão do conto →' : 'Finalizar conto e comentar →';
    else btn.textContent = feito ? 'Próximo ato →' : 'Finalizar ato e avançar →';

    const cena = cenaDoAto(conto, ato);
    aplicarCena(cena.layers, cena.clima);
    show('conto');
  }

  $('hoAtoGrid').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-ato]');
    if (btn && !btn.disabled) abrirAto(app.conto, Number(btn.dataset.ato));
  });

  $('hoAtoAnterior').addEventListener('click', () => abrirAto(app.conto, app.ato - 1));
  $('hoVoltarMapa').addEventListener('click', () => {
    renderMapa();
    aplicarCena(IM.cenas.menu, 'menu');
    show('mapa');
  });

  $('hoAtoAvancar').addEventListener('click', async () => {
    if (app.busy) return;
    const st = contoState(app.conto);
    const ultimo = app.ato === st.totalAtos;
    const jaFeito = atoConcluido(app.conto, app.ato);

    if (!jaFeito) {
      app.busy = true;
      const btn = $('hoAtoAvancar');
      btn.disabled = true;
      $('hoAtoMsg').className = 'ho-msg';
      $('hoAtoMsg').textContent = 'Salvando…';
      try {
        const data = await api('/reader/ato', { conto: app.conto, ato: app.ato });
        app.state = data.state;
      } catch (err) {
        $('hoAtoMsg').className = 'ho-msg ho-msg--err';
        $('hoAtoMsg').textContent = err.message;
        btn.disabled = false;
        app.busy = false;
        return;
      }
      app.busy = false;
    }

    if (ultimo) mostrarFim(app.conto);
    else abrirAto(app.conto, app.ato + 1);
  });

  /* ---------- conto concluído ---------- */

  function mostrarFim(conto) {
    const meta = CONTOS[conto - 1];
    const ehUltimo = conto === CONTOS.length;
    $('hoFimKicker').textContent = ehUltimo ? '🎃 Fim do livro' : `🎃 Conto ${conto} concluído`;
    $('hoFimTitulo').textContent = ehUltimo ? 'Você leu Horrores Ocultos' : meta.titulo;
    $('hoFimTexto').textContent = ehUltimo
      ? 'Os quatro contos de Desejos de Amor ficaram para trás. Obrigado por ter lido até aqui.'
      : `Você terminou o conto ${conto}. O conto ${conto + 1} está liberado.`;

    // aviso extra do conto (ex.: "a Parte 2 estará no segundo volume")
    const nota = meta.fimNota ? ` ${meta.fimNota}` : '';
    $('hoFimTexto').textContent += nota;

    const proximo = $('hoFimProximo');
    if (ehUltimo) {
      proximo.textContent = 'Conhecer outras histórias';
      proximo.onclick = () => { location.href = '/loja.html'; };
    } else {
      proximo.textContent = `Ir para o conto ${conto + 1} →`;
      proximo.onclick = () => abrirAto(conto + 1, 1);
    }
    $('hoFimMapa').onclick = () => {
      renderMapa();
      aplicarCena(IM.cenas.menu, 'menu');
      show('mapa');
    };

    const box = $('hoComentarios');
    if (window.CommentsWidget) {
      box.innerHTML = window.CommentsWidget.buildHTML(`Comentários — ${meta.titulo}`, { email: app.email });
      window.CommentsWidget.init({ container: box, obra: OBRA, cap: conto, apiBase });
    } else {
      box.innerHTML = '';
    }
    show('fim'); // a trilha do último ato continua tocando
  }

  /* ---------- início ---------- */

  function iniciar() {
    if (!liberado()) {
      $('hoEsperaData').textContent = cfg.lancamentoLabel;
      show('espera');
      return;
    }
    const salvo = lsGet(EMAIL_KEY);
    if (salvo) {
      $('hoEmail').value = salvo;
      show('gate');
      $('hoGateMsg').textContent = 'Retomando sua leitura…';
      entrar(salvo, { silencioso: true });
    } else {
      show('gate');
    }
  }

  iniciar();
})();
