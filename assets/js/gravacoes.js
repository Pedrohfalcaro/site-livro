/**
 * Área de gravações (/gravacoes). SPA simples com rotas por hash:
 *   #/                       -> obras
 *   #/<temp>                 -> personagens do amigo + progresso
 *   #/<temp>/<pers>          -> episódios do personagem
 *   #/<temp>/<pers>/<ep>     -> roteiro corrido, diálogo por diálogo
 *
 * Entrada: 1º acesso = senha + definir e-mail; depois = só o e-mail.
 */
(function () {
  'use strict';

  var CFG = JSON.parse(document.getElementById('gravConfig').textContent);
  var API = window.ApiBase.resolveApiBase();
  var LS = 'gravacoes.sessao';
  var app = document.getElementById('gravApp');

  var sessao = null; // { ator, email, token }
  var estado = { takes: [], enviados: [] };
  var estadoDe = '';
  var arquivosEscolhidos = {};
  var vendo = null; // criador: id da voz que está sendo vista
  var contas = []; // criador: quem já entrou

  /* ---------------- utilidades ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function temporada(id) {
    return CFG.temporadas.filter(function (t) { return t.id === id; })[0] || null;
  }
  function ehAdmin() { return !!sessao && sessao.ator === 'criador'; }
  function atorAtual() {
    if (!sessao) return null;
    var id = ehAdmin() ? vendo : sessao.ator;
    return CFG.atores.filter(function (a) { return a.id === id; })[0] || null;
  }
  function atorDoPersonagem(persId) {
    return CFG.atores.filter(function (a) {
      return a.personagens.some(function (p) { return p.id === persId; });
    })[0] || null;
  }
  function quando(ts) {
    return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function personagem(id) {
    var a = atorAtual();
    return a ? a.personagens.filter(function (p) { return p.id === id; })[0] || null : null;
  }
  function pct(feito, total) { return total ? Math.round((feito / total) * 100) : 0; }
  function tamanho(bytes) {
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function cores(t) { return '--t:' + t.cor + ';--t2:' + (t.cor2 || t.cor) + ';'; }
  /** Cor do personagem (--p) e uma versão clareada só para texto/anel (--pt), para cores escuras lerem bem. */
  function corLegivel(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255];
    function lum(rgb) {
      return rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
        .reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
    }
    var k = 0;
    while (lum(c) < 0.3 && k < 20) {
      c = c.map(function (v) { return Math.round(v + (255 - v) * 0.12); });
      k++;
    }
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  function corP(p) { return '--p:' + p.cor + ';--pt:' + corLegivel(p.cor) + ';'; }
  function inicial(nome) { return String(nome).trim().charAt(0).toUpperCase(); }

  function salvarSessao() { try { localStorage.setItem(LS, JSON.stringify(sessao)); } catch (e) {} }
  function lerSessao() {
    try {
      var s = JSON.parse(localStorage.getItem(LS) || 'null');
      return s && s.ator && s.email && s.token ? s : null;
    } catch (e) { return null; }
  }
  function limparSessao() {
    try { localStorage.removeItem(LS); } catch (e) {}
    sessao = null; estado = { takes: [], enviados: [] }; estadoDe = ''; vendo = null; contas = [];
  }

  function tratar(res) {
    return res.json().catch(function () { return { ok: false, error: 'Resposta inesperada do servidor.' }; })
      .then(function (json) {
        if (res.status === 401 && sessao) { limparSessao(); setTimeout(rotear, 0); }
        if (!res.ok || json.ok === false) {
          var err = new Error(json.error || 'Algo deu errado. Tente de novo.');
          err.status = res.status; err.codigo = json.codigo;
          throw err;
        }
        return json;
      });
  }
  function enviarJson(rota, corpo) {
    return fetch(API + rota, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    }).then(tratar);
  }
  function post(rota, corpo) {
    return enviarJson(rota, Object.assign({ ator: sessao.ator, email: sessao.email, token: sessao.token }, corpo));
  }
  function semConexao(e) {
    return e && e.status ? e.message : 'Sem conexão com o servidor. Ele pode estar acordando: tente de novo em alguns segundos.';
  }

  /* ---------------- dados derivados ---------------- */
  function roteiro(temp, ep) {
    return (CFG.roteiros[temp] || []).filter(function (e) { return e.ep === ep; })[0] || null;
  }
  function blocosDoPersonagem(temp, ep, persId) {
    var r = roteiro(temp, ep);
    if (!r) return null;
    return r.blocos.map(function (b) {
      var minhas = b.falas.filter(function (f) { return f.p === persId; }).length;
      return minhas ? { bloco: b, minhas: minhas } : null;
    }).filter(Boolean);
  }
  function gravado(persId, ep, bloco) {
    return estado.takes.filter(function (t) { return t.personagem === persId && t.ep === ep && t.bloco === bloco; })[0] || null;
  }
  function foiEnviado(persId, ep) {
    return estado.enviados.filter(function (e) { return e.personagem === persId && e.ep === ep; })[0] || null;
  }
  function episodiosDoPersonagem(temp, pers) {
    var ator = atorAtual(), t = temporada(temp), lista = [];
    for (var ep = 1; ep <= (t.episodios || 8); ep++) {
      if (ator.eps.indexOf(ep) === -1) continue;
      var blocos = blocosDoPersonagem(temp, ep, pers.id);
      if (blocos === null) { lista.push({ ep: ep, pendente: true, blocos: [], falas: 0, feitasFalas: 0, feitos: 0 }); continue; }
      if (!blocos.length) continue;
      var feitos = 0, falas = 0, feitasFalas = 0;
      blocos.forEach(function (b) {
        falas += b.minhas;
        if (gravado(pers.id, ep, b.bloco.id)) { feitos++; feitasFalas += b.minhas; }
      });
      lista.push({ ep: ep, pendente: false, titulo: roteiro(temp, ep).titulo, blocos: blocos, falas: falas, feitasFalas: feitasFalas, feitos: feitos });
    }
    return lista;
  }
  function resumoPersonagem(temp, pers) {
    var eps = episodiosDoPersonagem(temp, pers);
    var r = { falas: 0, feitas: 0, dialogos: 0, dialogosFeitos: 0, pendentes: 0, eps: eps };
    eps.forEach(function (e) {
      if (e.pendente) { r.pendentes++; return; }
      r.falas += e.falas; r.feitas += e.feitasFalas;
      r.dialogos += e.blocos.length; r.dialogosFeitos += e.feitos;
    });
    return r;
  }

  /** Dica de interpretação: orientação do roteiro + o que a variação (V.O., comunicador…) pede. */
  var DICAS = {
    'V.O.': 'narração interna, como um pensamento',
    'O.S.': 'fora de cena, voz abafada',
    'COMUNICADOR': 'voz filtrada, de comunicador',
    'RÁDIO': 'filtro de rádio',
    'CRIANÇA': 'voz de criança'
  };
  function dicaDeTom(f) {
    var partes = [];
    if (f.tom) partes.push(f.tom);
    String(f.v || '').split(',').forEach(function (v) {
      var d = DICAS[v.trim().toUpperCase()];
      if (d && partes.indexOf(d) === -1) partes.push(d);
    });
    return partes.join(' • ');
  }

  /* ---------------- peças visuais ---------------- */
  function anel(valor, tamanhoPx, miolo) {
    var r = 26, c = 2 * Math.PI * r, off = c - (c * valor) / 100;
    return '<span class="grav-anel" style="width:' + tamanhoPx + 'px;height:' + tamanhoPx + 'px">' +
      '<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="grav-anel__fundo" cx="32" cy="32" r="' + r + '"/>' +
      '<circle class="grav-anel__valor" cx="32" cy="32" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>' +
      '<span class="grav-anel__miolo">' + miolo + '</span></span>';
  }
  function barra(valor) {
    return '<div class="grav-barra" role="progressbar" aria-valuenow="' + valor + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + valor + '%"></i></div>';
  }

  /* ---------------- entrada ---------------- */
  function telaLogin(msg, aba) {
    document.getElementById('gravConta').hidden = true;
    aba = aba || 'email';
    app.innerHTML =
      '<section class="grav-login">' +
        '<img class="grav-login__logo" src="/imagens/gravacoes/adc-t1-logo.svg" alt="Além dos Céus" />' +
        '<h1 class="grav-login__titulo">Gravações</h1>' +
        '<div class="grav-abas" role="tablist">' +
          '<button type="button" role="tab" class="grav-aba" data-aba="email" aria-selected="' + (aba === 'email') + '">Entrar com e-mail</button>' +
          '<button type="button" role="tab" class="grav-aba" data-aba="senha" aria-selected="' + (aba === 'senha') + '">Primeiro acesso</button>' +
        '</div>' +
        '<div id="gravLoginCorpo"></div>' +
      '</section>';

    var corpo = document.getElementById('gravLoginCorpo');
    Array.prototype.forEach.call(app.querySelectorAll('.grav-aba'), function (b) {
      b.addEventListener('click', function () { telaLogin('', b.getAttribute('data-aba')); });
    });
    if (aba === 'senha') loginSenha(corpo, msg); else loginEmail(corpo, msg);
  }

  function formulario(corpo, o) {
    corpo.innerHTML =
      '<p class="grav-login__dica">' + o.dica + '</p>' +
      '<form class="grav-form" novalidate>' +
        '<label class="grav-sr" for="gCampo">' + o.rotulo + '</label>' +
        '<input id="gCampo" class="grav-campo" type="' + o.tipo + '" placeholder="' + o.placeholder + '" autocomplete="' + o.auto + '" required />' +
        '<button class="grav-btn" type="submit">' + o.botao + '</button>' +
        '<p class="grav-msg" role="status">' + esc(o.msg || '') + '</p>' +
      '</form>';
    var form = corpo.querySelector('form'), campo = corpo.querySelector('#gCampo');
    var btn = corpo.querySelector('button.grav-btn'), out = corpo.querySelector('.grav-msg');
    campo.focus();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var valor = campo.value.trim();
      if (!valor) { out.textContent = o.vazio; return; }
      btn.disabled = true; btn.textContent = 'Aguarde…'; out.textContent = '';
      o.enviar(valor).catch(function (e) {
        out.textContent = semConexao(e);
        btn.disabled = false; btn.textContent = o.botao;
        if (o.aoErro) o.aoErro(e);
      });
    });
  }
  function iniciarSessao(r) {
    sessao = { ator: r.ator, email: r.email, token: r.token };
    salvarSessao();
    location.hash = '#/';
    rotear();
  }

  function loginEmail(corpo, msg) {
    var ultimo = '';
    formulario(corpo, {
      dica: 'Use o e-mail que você definiu no primeiro acesso.',
      rotulo: 'Seu e-mail', tipo: 'email', placeholder: 'voce@email.com', auto: 'email',
      botao: 'Entrar', vazio: 'Digite o seu e-mail.', msg: msg,
      enviar: function (email) {
        ultimo = email;
        return enviarJson('/gravacoes/entrar', { email: email }).then(iniciarSessao);
      },
      // o e-mail do criador pede a senha dele
      aoErro: function (e) { if (e.codigo === 'admin-senha') passoCriador(corpo, ultimo); },
    });
  }

  function passoCriador(corpo, email) {
    formulario(corpo, {
      dica: '<b>Acesso do criador.</b> Digite a sua senha para ver todas as vozes.',
      rotulo: 'Senha do criador', tipo: 'password', placeholder: 'Senha do criador', auto: 'current-password',
      botao: 'Entrar', vazio: 'Digite a senha.',
      enviar: function (senha) {
        return enviarJson('/gravacoes/entrar-criador', { email: email, senha: senha }).then(iniciarSessao);
      },
    });
  }

  function loginSenha(corpo, msg) {
    formulario(corpo, {
      dica: 'Digite a senha que o Pedro te enviou. Ela só vale uma vez: depois você entra com o seu e-mail.',
      rotulo: 'Senha', tipo: 'password', placeholder: 'Sua senha', auto: 'one-time-code',
      botao: 'Continuar', vazio: 'Digite a senha.', msg: msg,
      enviar: function (senha) {
        return enviarJson('/gravacoes/senha', { senha: senha }).then(function (r) { passoEmail(corpo, senha, r.ator); });
      },
      aoErro: function (e) {
        // senha já usada: leva direto para a entrada por e-mail
        if (e.codigo === 'ja-definido') telaLogin(e.message, 'email');
      },
    });
  }

  function passoEmail(corpo, senha, atorId) {
    var ator = CFG.atores.filter(function (a) { return a.id === atorId; })[0];
    formulario(corpo, {
      dica: '<b>Olá, ' + esc(ator ? ator.nome : '') + '!</b> Agora defina o seu e-mail. Ele será usado para entrar daqui em diante e guarda as suas gravações.',
      rotulo: 'Seu e-mail', tipo: 'email', placeholder: 'voce@email.com', auto: 'email',
      botao: 'Salvar e entrar', vazio: 'Digite o seu e-mail.',
      enviar: function (email) {
        return enviarJson('/gravacoes/definir-email', { senha: senha, email: email }).then(iniciarSessao);
      },
      aoErro: function (e) { if (e.codigo === 'ja-definido') telaLogin(e.message, 'email'); },
    });
  }

  function cabecalhoConta() {
    var a = atorAtual();
    document.getElementById('gravConta').hidden = false;
    document.getElementById('gravContaNome').textContent = ehAdmin() ? 'Criador' : (a ? a.nome : sessao.ator);
  }

  /* ---------------- obras ---------------- */
  function telaTemporadas() {
    cabecalhoConta();
    var a = atorAtual();
    var html =
      '<header class="grav-cab"><p class="grav-oi">Olá, ' + esc(a ? a.nome : '') + '</p><h1 class="grav-h1">Além dos Céus</h1></header>' +
      '<div class="grav-posters">';
    CFG.temporadas.forEach(function (t) {
      var fundo = t.capa
        ? '<img class="grav-poster__img" src="' + esc(t.capa) + '" alt="" loading="lazy" />'
        : '<div class="grav-poster__vazio"><img src="' + esc(t.simbolo) + '" alt="" /></div>';
      var inner = fundo +
        '<div class="grav-poster__veu"></div>' +
        (t.aberta ? '' : '<span class="grav-poster__tag">Em breve</span>') +
        '<div class="grav-poster__rodape"><span class="grav-poster__nome">' + esc(t.subtitulo) + '</span>' +
        (t.aberta ? '<span class="grav-poster__ir">Abrir <i>→</i></span>' : '') + '</div>';
      html += t.aberta
        ? '<a class="grav-poster" style="' + cores(t) + '" href="#/' + t.id + '">' + inner + '</a>'
        : '<div class="grav-poster grav-poster--off" style="' + cores(t) + '" aria-disabled="true">' + inner + '</div>';
    });
    app.innerHTML = html + '</div>';
  }

  function carregarEstado(temp) {
    if (estadoDe === temp) return Promise.resolve();
    var rota = ehAdmin() ? '/gravacoes/criador/resumo' : '/gravacoes/estado';
    return post(rota, { temporada: temp }).then(function (r) {
      estado = { takes: r.takes || [], enviados: r.enviados || [] };
      contas = r.contas || [];
      estadoDe = temp;
    });
  }

  /* ---------------- painel do criador ---------------- */
  function telaPainel(temp) {
    cabecalhoConta();
    var t = temporada(temp), tot = { falas: 0, feitas: 0, dialogos: 0, feitos: 0 }, cards = '';
    CFG.atores.forEach(function (a) {
      vendo = a.id;
      var falas = 0, feitas = 0, dial = 0, dialF = 0, nomes = [];
      a.personagens.forEach(function (p) {
        var r = resumoPersonagem(temp, p);
        falas += r.falas; feitas += r.feitas; dial += r.dialogos; dialF += r.dialogosFeitos;
        nomes.push(p.nome);
      });
      tot.falas += falas; tot.feitas += feitas; tot.dialogos += dial; tot.feitos += dialF;
      var conta = contas.filter(function (c) { return c.ator === a.id; })[0];
      var v = pct(feitas, falas);
      var cor = a.personagens[0] ? a.personagens[0].cor : t.cor;
      cards +=
        '<a class="grav-pers" style="' + corP({ cor: cor }) + '" href="#/' + temp + '/voz/' + a.id + '">' +
          anel(v, 64, '<b>' + esc(inicial(a.nome)) + '</b>') +
          '<span class="grav-pers__txt">' +
            '<span class="grav-pers__nome">' + esc(a.nome) + '</span>' +
            '<span class="grav-pers__linha">' + esc(nomes.join(', ')) + '</span>' +
            '<span class="grav-pers__linha">' + (falas ? dialF + ' de ' + dial + ' diálogos • ' + v + '%' : 'sem falas liberadas ainda') + '</span>' +
            '<span class="grav-pers__linha grav-pers__quem">' + (conta ? esc(conta.email) + ' • acesso ' + quando(conta.lastAt) : 'ainda não entrou') + '</span>' +
          '</span>' +
          '<span class="grav-pers__seta" aria-hidden="true">→</span>' +
        '</a>';
    });
    vendo = null;
    var geral = pct(tot.feitas, tot.falas);
    app.innerHTML =
      '<header class="grav-cab"><p class="grav-oi">Painel do criador</p><h1 class="grav-h1">Todas as vozes</h1>' +
        '<p class="grav-sub">' + esc(t.nome + ' — ' + t.subtitulo) + '</p></header>' +
      '<section class="grav-hero grav-hero--solo" style="' + cores(t) + '"><div class="grav-hero__txt">' +
        '<div class="grav-numeros">' +
          '<div><b>' + geral + '%</b><span>concluído</span></div>' +
          '<div><b>' + tot.feitos + '/' + tot.dialogos + '</b><span>diálogos</span></div>' +
          '<div><b>' + (tot.falas - tot.feitas) + '</b><span>falas faltam</span></div>' +
          '<div><b>' + contas.length + '/' + CFG.atores.length + '</b><span>já entraram</span></div>' +
        '</div>' + barra(geral) +
      '</div></section>' +
      '<h2 class="grav-h2">Vozes</h2>' +
      '<div class="grav-lista-pers" style="' + cores(t) + '">' + cards + '</div>';
  }

  /* ---------------- personagens ---------------- */
  function telaTemporada(temp) {
    var t = temporada(temp), a = atorAtual();
    cabecalhoConta();
    var totais = { falas: 0, feitas: 0 }, cards = '', admin = ehAdmin();

    a.personagens.forEach(function (p) {
      var r = resumoPersonagem(temp, p);
      totais.falas += r.falas; totais.feitas += r.feitas;
      var v = pct(r.feitas, r.falas);
      var linha;
      if (!r.eps.length) linha = 'Episódios a definir';
      else if (!r.falas) linha = 'Roteiro em preparação';
      else if (v === 100) linha = 'Tudo gravado ✓';
      else linha = plural(r.falas - r.feitas, 'fala para gravar', 'falas para gravar');
      cards +=
        '<a class="grav-pers" style="' + corP(p) + '" href="#/' + temp + '/' + p.id + '">' +
          anel(v, 64, '<b>' + esc(inicial(p.nome)) + '</b>') +
          '<span class="grav-pers__txt">' +
            '<span class="grav-pers__nome">' + esc(p.nome) + '</span>' +
            '<span class="grav-pers__linha">' + esc(p.detalhe ? p.detalhe + ' • ' : '') + linha + '</span>' +
          '</span>' +
          '<span class="grav-pers__seta" aria-hidden="true">→</span>' +
        '</a>';
    });

    var geral = pct(totais.feitas, totais.falas);
    app.innerHTML =
      '<a class="grav-voltar" href="#/">' + (admin ? '← Todas as vozes' : '← Obras') + '</a>' +
      '<section class="grav-hero" style="' + cores(t) + '">' +
        (t.capa ? '<img class="grav-hero__capa" src="' + esc(t.capa) + '" alt="" />' : '') +
        '<div class="grav-hero__txt">' +
          '<img class="grav-hero__logo" src="' + esc(t.logo) + '" alt="' + esc(t.nome) + '" />' +
          '<p class="grav-hero__sub">' + esc(t.subtitulo) + '</p>' +
          '<div class="grav-numeros">' +
            '<div><b>' + geral + '%</b><span>concluído</span></div>' +
            '<div><b>' + totais.feitas + '</b><span>gravadas</span></div>' +
            '<div><b>' + (totais.falas - totais.feitas) + '</b><span>faltam</span></div>' +
          '</div>' +
          barra(geral) +
        '</div>' +
      '</section>' +
      '<h2 class="grav-h2">' + (admin ? 'Personagens de ' + esc(a.nome) : 'Seus personagens') + '</h2>' +
      '<div class="grav-lista-pers" style="' + cores(t) + '">' + cards + '</div>';
  }

  function telaPersonagem(temp, persId) {
    var t = temporada(temp), p = personagem(persId);
    if (!p) return irPara(ehAdmin() ? '#/' : '#/' + temp);
    cabecalhoConta();
    var r = resumoPersonagem(temp, p), v = pct(r.feitas, r.falas), grade = '';

    r.eps.forEach(function (e) {
      if (e.pendente) {
        grade += '<div class="grav-ep grav-ep--off"><span class="grav-ep__n">' + e.ep + '</span><span class="grav-ep__t">Roteiro em breve</span></div>';
        return;
      }
      var ev = pct(e.feitasFalas, e.falas), enviado = foiEnviado(persId, e.ep);
      grade +=
        '<a class="grav-ep' + (ev === 100 ? ' grav-ep--ok' : '') + '" href="#/' + temp + '/' + persId + '/' + e.ep + '">' +
          '<span class="grav-ep__n">' + e.ep + '</span>' +
          '<span class="grav-ep__t">' + esc(e.titulo || 'Episódio ' + e.ep) + '</span>' +
          '<span class="grav-ep__s">' + (enviado ? 'Enviado ✓' : e.feitos + ' de ' + e.blocos.length + ' diálogos') + '</span>' +
          barra(ev) +
        '</a>';
    });
    if (!r.eps.length) grade = '<p class="grav-vazio">Nenhum episódio liberado para este personagem ainda.</p>';

    app.innerHTML =
      (ehAdmin()
        ? '<a class="grav-voltar" href="#/' + temp + '/voz/' + vendo + '">← ' + esc(atorAtual().nome) + '</a>'
        : '<a class="grav-voltar" href="#/' + temp + '">← ' + esc(t.curto) + '</a>') +
      '<header class="grav-pers-cab" style="' + cores(t) + ';' + corP(p) + '">' +
        anel(v, 84, '<b>' + esc(inicial(p.nome)) + '</b>') +
        '<div><h1 class="grav-h1 grav-nomecor">' + esc(p.nome) + '</h1>' +
        '<p class="grav-sub">' + esc(p.detalhe ? p.detalhe + ' • ' : '') + (r.falas ? v + '% gravado • faltam ' + (r.falas - r.feitas) + ' falas' : 'sem roteiro liberado') + '</p></div>' +
      '</header>' +
      '<h2 class="grav-h2">Episódios</h2>' +
      '<div class="grav-eps" style="' + cores(t) + '">' + grade + '</div>';
  }

  /* ---------------- roteiro ---------------- */
  function chaveArquivo(persId, ep, bloco) { return persId + '|' + ep + '|' + bloco; }

  function acaoCriador(take, id) {
    if (!take) return '<div class="grav-feito"><span class="grav-feito__pend">○ Pendente</span></div>';
    return '<div class="grav-feito"><span class="grav-feito__marca">✓ Concluído</span>' +
      '<span class="grav-feito__arq">' + esc(take.filename) + ' · ' + tamanho(take.size) + ' · ' + quando(take.at) + '</span>' +
      '<button type="button" class="grav-link" data-ouvir="' + id + '">▶ Ouvir</button>' +
      '<button type="button" class="grav-link grav-link--perigo" data-desconcluir="' + id + '">Desconcluir</button></div>' +
      '<div class="grav-player" data-player="' + id + '"></div>';
  }

  function cartaoDialogo(temp, p, ep, item) {
    var b = item.bloco, take = gravado(p.id, ep, b.id);
    var escolhido = arquivosEscolhidos[chaveArquivo(p.id, ep, b.id)];

    var falas = b.falas.map(function (f) {
      var minha = f.p === p.id;
      var dica = minha ? dicaDeTom(f) : '';
      return '<div class="grav-fala' + (minha ? ' grav-fala--minha' : '') + '">' +
        '<span class="grav-fala__quem">' + esc(f.nome.toLowerCase()) + (f.v ? ' <i>' + esc(f.v.toLowerCase()) + '</i>' : '') + '</span>' +
        '<p class="grav-fala__texto">' + esc(f.t) + '</p>' +
        (dica ? '<span class="grav-fala__tom"><b>Tom</b> ' + esc(dica) + '</span>' : '') +
      '</div>';
    }).join('');

    var cena = b.cena.replace(/^(INT\.\/EXT\.|EXT\.\/|INT\.|EXT\.)\s*/, '').replace(/\s+-\s+/g, ' · ').toLowerCase();

    var acao = take
      ? '<div class="grav-feito"><span class="grav-feito__marca">✓ Concluído</span>' +
        '<span class="grav-feito__arq">' + esc(take.filename) + ' · ' + tamanho(take.size) + '</span>' +
        '<button type="button" class="grav-link" data-refazer="' + b.id + '">Trocar</button></div>'
      : '<div class="grav-envio">' +
          '<label class="grav-arquivo"><input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac" data-arquivo="' + b.id + '" />' +
            '<span class="grav-arquivo__ico" aria-hidden="true">↑</span>' +
            '<span data-nome="' + b.id + '">' + (escolhido ? esc(escolhido.name) : 'Anexar gravação') + '</span></label>' +
          '<button type="button" class="grav-btn grav-btn--mini" data-concluir="' + b.id + '"' + (escolhido ? '' : ' disabled') + '>Concluir</button>' +
        '</div>';

    if (ehAdmin()) acao = acaoCriador(take, b.id);

    return '<article class="grav-dialogo' + (take ? ' grav-dialogo--ok' : '') + '" id="dlg-' + b.id + '">' +
      '<header class="grav-dialogo__topo"><span class="grav-dialogo__n">' + (take ? '✓' : b.id) + '</span>' +
        '<div><h3>Diálogo ' + b.id + '</h3><span class="grav-dialogo__cena">' + esc((b.parte ? b.parte.toLowerCase() + ' · ' : '') + cena) + '</span></div></header>' +
      '<div class="grav-falas">' + falas + '</div>' +
      '<p class="grav-msg" data-msg="' + b.id + '" role="status"></p>' + acao +
    '</article>';
  }

  function telaEpisodio(temp, persId, ep) {
    var t = temporada(temp), p = personagem(persId);
    var blocos = p ? blocosDoPersonagem(temp, ep, persId) : null;
    if (!p || !blocos || !blocos.length) return irPara('#/' + temp + '/' + persId);
    cabecalhoConta();
    var r = roteiro(temp, ep), admin = ehAdmin();

    var intro = admin
      ? '<p class="grav-ajuda">Gravações de <b>' + esc(atorAtual().nome) + '</b> para <b class="grav-nomecor">' + esc(p.nome) + '</b>. Você pode ouvir cada diálogo e desconcluir se precisar.</p>' +
        '<div class="grav-chips" role="group" aria-label="Filtrar diálogos">' +
          '<button type="button" class="grav-chip" data-filtro="todos" aria-pressed="true">Todos</button>' +
          '<button type="button" class="grav-chip" data-filtro="feitos" aria-pressed="false">Concluídos</button>' +
          '<button type="button" class="grav-chip" data-filtro="pendentes" aria-pressed="false">Pendentes</button>' +
        '</div>'
      : '<p class="grav-ajuda">As falas de <b class="grav-nomecor">' + esc(p.nome) + '</b> estão em destaque. As outras são só para você se situar.</p>' +
        '<aside class="grav-dica"><span class="grav-dica__ico" aria-hidden="true">🎙</span>' +
          '<p>Grave em um lugar silencioso, sem ruídos e próximo do microfone. Recomendamos usar o aplicativo de gravação de áudio do próprio celular caso você não tenha equipamento profissional.</p></aside>';

    app.innerHTML =
      '<a class="grav-voltar" href="#/' + temp + '/' + persId + '">← ' + esc(p.nome) + '</a>' +
      '<header class="grav-ep-cab" style="' + cores(t) + ';' + corP(p) + '">' +
        '<p class="grav-oi">' + esc(t.subtitulo) + '</p>' +
        '<h1 class="grav-h1">Episódio ' + ep + (r.titulo ? ' <span>' + esc(r.titulo.toLowerCase()) + '</span>' : '') + '</h1>' +
        intro +
        '<div id="gravEpProg"></div>' +
      '</header>' +
      '<div class="grav-dialogos" style="' + cores(t) + ';' + corP(p) + '">' +
        blocos.map(function (item) { return cartaoDialogo(temp, p, ep, item); }).join('') +
      '</div>' +
      '<section class="grav-final" id="gravFinal" style="' + cores(t) + '"></section>';

    atualizarProgressoEp(temp, persId, ep, blocos);
    ligarDialogos(temp, p, ep, blocos);
    ajudaVisivel(!admin);
    if (admin) {
      var lista = document.querySelector('.grav-dialogos');
      Array.prototype.forEach.call(app.querySelectorAll('.grav-chip'), function (chip) {
        chip.addEventListener('click', function () {
          var modo = chip.getAttribute('data-filtro');
          lista.classList.remove('filtro-feitos', 'filtro-pendentes');
          if (modo === 'feitos') lista.classList.add('filtro-feitos');
          if (modo === 'pendentes') lista.classList.add('filtro-pendentes');
          Array.prototype.forEach.call(app.querySelectorAll('.grav-chip'), function (c) {
            c.setAttribute('aria-pressed', String(c === chip));
          });
        });
      });
    }
  }

  function atualizarProgressoEp(temp, persId, ep, blocos) {
    var feitos = blocos.filter(function (b) { return gravado(persId, ep, b.bloco.id); }).length;
    var total = blocos.length, v = pct(feitos, total);
    document.getElementById('gravEpProg').innerHTML =
      barra(v) + '<p class="grav-sub">' + feitos + ' de ' + total + ' diálogos concluídos</p>';

    var completo = feitos === total, enviado = foiEnviado(persId, ep);
    var box = document.getElementById('gravFinal');
    if (ehAdmin()) {
      box.innerHTML = '<h2 class="grav-h2">Envio do episódio</h2><p class="grav-sub">' +
        (enviado ? 'Enviado ao seu e-mail em ' + new Date(enviado.at).toLocaleString('pt-BR') + '.' : (completo ? 'Todos os diálogos concluídos, mas ainda não enviado.' : 'Ainda não enviado.')) + '</p>';
      return;
    }
    box.innerHTML =
      '<h2 class="grav-h2">Enviar episódio</h2>' +
      '<p class="grav-sub">' + (completo
        ? 'Tudo gravado! Ao enviar, o Pedro recebe os arquivos por e-mail.' + (enviado ? ' Último envio: ' + new Date(enviado.at).toLocaleString('pt-BR') + '.' : '')
        : 'Conclua os diálogos para liberar o envio. Faltam ' + (total - feitos) + '.') + '</p>' +
      '<button id="gravEnviar" type="button" class="grav-btn"' + (completo ? '' : ' disabled') + '>' + (enviado ? 'Enviar de novo' : 'Enviar gravações') + '</button>' +
      '<p id="gravEnviarMsg" class="grav-msg grav-msg--ok" role="status"></p>';

    var btn = document.getElementById('gravEnviar');
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Enviando…';
      var t = temporada(temp), a = atorAtual(), p = personagem(persId);
      post('/gravacoes/enviar', {
        temporada: temp, personagem: persId, ep: ep, total: total,
        nomes: { ator: a.nome, personagem: p.nome, temporada: t.nome + ' — ' + t.subtitulo },
      }).then(function (r) {
        estado.enviados = estado.enviados.filter(function (e) { return !(e.personagem === persId && e.ep === ep); });
        estado.enviados.push({ personagem: persId, ep: ep, at: Date.now() });
        atualizarProgressoEp(temp, persId, ep, blocos);
        document.getElementById('gravEnviarMsg').textContent = '✓ Enviado! ' + plural(r.arquivos, 'arquivo chegou', 'arquivos chegaram') + ' ao Pedro. Obrigado!';
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = 'Enviar gravações';
        var m = document.getElementById('gravEnviarMsg');
        m.classList.remove('grav-msg--ok'); m.textContent = semConexao(e);
      });
    });
  }

  function ligarDialogos(temp, p, ep, blocos) {
    var raiz = document.querySelector('.grav-dialogos');
    function msg(id, texto) { var el = raiz.querySelector('[data-msg="' + id + '"]'); if (el) el.textContent = texto || ''; }
    function repintar(id) {
      var item = blocos.filter(function (b) { return b.bloco.id === id; })[0];
      var tmp = document.createElement('div');
      tmp.innerHTML = cartaoDialogo(temp, p, ep, item);
      document.getElementById('dlg-' + id).replaceWith(tmp.firstChild);
      atualizarProgressoEp(temp, p.id, ep, blocos);
    }

    raiz.addEventListener('change', function (ev) {
      var id = ev.target.getAttribute && ev.target.getAttribute('data-arquivo');
      if (!id) return;
      id = Number(id);
      var f = ev.target.files && ev.target.files[0], chave = chaveArquivo(p.id, ep, id);
      var rotulo = raiz.querySelector('[data-nome="' + id + '"]'), btn = raiz.querySelector('[data-concluir="' + id + '"]');
      if (!f) { delete arquivosEscolhidos[chave]; rotulo.textContent = 'Anexar gravação'; btn.disabled = true; return; }
      if (f.size > 25 * 1024 * 1024) {
        ev.target.value = ''; delete arquivosEscolhidos[chave]; btn.disabled = true;
        return msg(id, 'Arquivo grande demais (máximo 25 MB). Exporte em MP3 ou M4A.');
      }
      arquivosEscolhidos[chave] = f;
      rotulo.textContent = f.name + ' · ' + tamanho(f.size);
      btn.disabled = false; msg(id, '');
    });

    raiz.addEventListener('click', function (ev) {
      var alvo = ev.target.closest && ev.target.closest('button');
      if (!alvo) return;

      var idO = alvo.getAttribute('data-ouvir');
      if (idO) {
        var oid = Number(idO), takeO = gravado(p.id, ep, oid);
        if (!takeO) return;
        alvo.disabled = true; alvo.textContent = 'Carregando…';
        fetch(API + '/gravacoes/criador/audio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ator: sessao.ator, email: sessao.email, token: sessao.token,
            emailAlvo: takeO.email, temporada: temp, personagem: p.id, ep: ep, bloco: oid,
          }),
        }).then(function (res) {
          if (!res.ok) throw new Error('Não foi possível carregar o áudio.');
          return res.blob();
        }).then(function (blob) {
          var caixa = raiz.querySelector('[data-player="' + oid + '"]');
          caixa.innerHTML = '<audio controls autoplay></audio>';
          caixa.firstChild.src = URL.createObjectURL(blob);
          alvo.disabled = false; alvo.textContent = '▶ Ouvir';
        }).catch(function (e) { alvo.disabled = false; alvo.textContent = '▶ Ouvir'; msg(oid, e.message); });
        return;
      }

      var idD = alvo.getAttribute('data-desconcluir');
      if (idD) {
        var did = Number(idD), takeD = gravado(p.id, ep, did);
        if (!takeD) return;
        if (!window.confirm('Desconcluir este diálogo? A gravação será apagada e a pessoa precisará gravar de novo.')) return;
        alvo.disabled = true;
        post('/gravacoes/criador/remover', {
          emailAlvo: takeD.email, temporada: temp, personagem: p.id, ep: ep, bloco: did,
        }).then(function () {
          estado.takes = estado.takes.filter(function (t) { return !(t.personagem === p.id && t.ep === ep && t.bloco === did); });
          estado.enviados = estado.enviados.filter(function (e) { return !(e.personagem === p.id && e.ep === ep); });
          repintar(did);
        }).catch(function (e) { alvo.disabled = false; msg(did, semConexao(e)); });
        return;
      }

      var idC = alvo.getAttribute('data-concluir');
      if (idC) {
        var id = Number(idC), chave = chaveArquivo(p.id, ep, id), f = arquivosEscolhidos[chave];
        if (!f) return;
        alvo.disabled = true; alvo.textContent = 'Enviando…'; msg(id, '');
        var fd = new FormData();
        fd.append('ator', sessao.ator); fd.append('email', sessao.email); fd.append('token', sessao.token);
        fd.append('temporada', temp); fd.append('personagem', p.id);
        fd.append('ep', String(ep)); fd.append('bloco', String(id));
        fd.append('arquivo', f, f.name);
        fetch(API + '/gravacoes/take', { method: 'POST', body: fd }).then(tratar).then(function (r) {
          estado.takes = estado.takes.filter(function (t) { return !(t.personagem === p.id && t.ep === ep && t.bloco === id); });
          estado.takes.push({ personagem: p.id, ep: ep, bloco: id, filename: r.filename || f.name, size: r.size || f.size, at: Date.now() });
          estado.enviados = estado.enviados.filter(function (e) { return !(e.personagem === p.id && e.ep === ep); });
          delete arquivosEscolhidos[chave];
          repintar(id);
        }).catch(function (e) { alvo.disabled = false; alvo.textContent = 'Concluir'; msg(id, semConexao(e)); });
        return;
      }

      var idR = alvo.getAttribute('data-refazer');
      if (idR) {
        var rid = Number(idR);
        alvo.disabled = true;
        post('/gravacoes/remover', { temporada: temp, personagem: p.id, ep: ep, bloco: rid }).then(function () {
          estado.takes = estado.takes.filter(function (t) { return !(t.personagem === p.id && t.ep === ep && t.bloco === rid); });
          repintar(rid);
        }).catch(function (e) { alvo.disabled = false; msg(rid, semConexao(e)); });
      }
    });
  }

  /* ---------------- rotas ---------------- */
  function irPara(hash) { location.hash = hash; }

  function ajudaVisivel(sim) {
    var b = document.getElementById('gravAjudaBtn');
    if (b) b.hidden = !sim;
  }

  function telaErro(e) {
    app.innerHTML = '<section class="grav-login"><p class="grav-msg">' + esc(semConexao(e)) + '</p>' +
      '<button type="button" class="grav-btn" id="gravTentar">Tentar de novo</button></section>';
    document.getElementById('gravTentar').addEventListener('click', rotear);
  }

  function roteiarCriador(partes) {
    var abertas = CFG.temporadas.filter(function (t) { return t.aberta; });
    var temp = partes[0] && temporada(partes[0]) && temporada(partes[0]).aberta ? partes[0] : abertas[0].id;
    vendo = null;
    if (partes[1] === 'voz') vendo = partes[2] || null;
    else if (partes[1]) { var dono = atorDoPersonagem(partes[1]); vendo = dono ? dono.id : null; }
    // o painel sempre busca dados novos (as vozes gravam o tempo todo)
    if (partes.length <= 1) estadoDe = '';

    app.innerHTML = '<p class="grav-carregando">Carregando…</p>';
    carregarEstado(temp).then(function () {
      if (!sessao) return;
      if (partes[1] === 'voz') return atorAtual() ? telaTemporada(temp) : telaPainel(temp);
      if (partes.length === 2) return atorAtual() ? telaPersonagem(temp, partes[1]) : telaPainel(temp);
      if (partes.length >= 3) return atorAtual() ? telaEpisodio(temp, partes[1], Number(partes[2])) : telaPainel(temp);
      return telaPainel(temp);
    }).catch(function (e) { if (sessao) telaErro(e); });
  }

  function rotear() {
    window.scrollTo(0, 0);
    ajudaVisivel(false);
    if (!sessao) return telaLogin();
    var partes = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (ehAdmin()) return roteiarCriador(partes);

    if (!atorAtual()) { limparSessao(); return telaLogin('Este acesso não está mais disponível.'); }
    var temp = partes[0];
    if (!temp) return telaTemporadas();
    var t = temporada(temp);
    if (!t || !t.aberta) return irPara('#/');

    app.innerHTML = '<p class="grav-carregando">Carregando…</p>';
    carregarEstado(temp).then(function () {
      if (!sessao) return;
      if (partes.length === 1) return telaTemporada(temp);
      if (partes.length === 2) return telaPersonagem(temp, partes[1]);
      return telaEpisodio(temp, partes[1], Number(partes[2]));
    }).catch(function (e) { if (sessao) telaErro(e); });
  }

  /* ---------------- ajuda (janela) ---------------- */
  (function () {
    var btn = document.getElementById('gravAjudaBtn'), dlg = document.getElementById('gravAjuda');
    if (!btn || !dlg) return;
    function abrir() { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    function fechar() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    btn.addEventListener('click', abrir);
    Array.prototype.forEach.call(dlg.querySelectorAll('[data-fechar]'), function (b) { b.addEventListener('click', fechar); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) fechar(); });
  })();

  document.getElementById('gravSair').addEventListener('click', function () {
    limparSessao(); location.hash = '#/'; rotear();
  });
  window.addEventListener('hashchange', rotear);

  sessao = lerSessao();
  rotear();
})();
