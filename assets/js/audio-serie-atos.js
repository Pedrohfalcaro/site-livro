/**
 * Player áudio-série (atos) — gerado por scripts/build-audio-players.mjs
 */
(function () {
  function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.scrollToSection = scrollToSection;

  const cfg = document.getElementById('serie-config');
  if (!cfg) return;
  const SERIE = JSON.parse(cfg.textContent);

/* ===== Estado ===== */
    let selectedIdx = null;

    /* ===== Elementos ===== */
    const atoGrid = document.getElementById("atoGrid");
    const tituloAto = document.getElementById("tituloAto");
    const subTituloAto = document.getElementById("subTituloAto");

    const btnAssistir = document.getElementById("btnAssistir");
    const btnYoutube = document.getElementById("btnYoutube");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const btnPrev2 = document.getElementById("btnPrev2");
    const btnNext2 = document.getElementById("btnNext2");

    const ytFrame = document.getElementById("ytFrame");
    const playerHint = document.getElementById("playerHint");
    const nowTitle = document.getElementById("nowTitle");
    const statusLine = document.getElementById("statusLine");
    const atoSinopseText = document.getElementById("atoSinopseText");

    function labelBotao(item){
      if (item.tipo === "Trailer") return "Trailer";
      return `Ato ${String(item.numero).padStart(2,'0')}`;
    }

    function tituloCompleto(item){
      if (item.tipo === "Trailer") return `TRAILER — ${SERIE.nome}`;
      return `ATO ${String(item.numero).padStart(2,'0')} — ${item.titulo}`;
    }

    function renderGrid(){
      atoGrid.innerHTML = SERIE.itens.map((item, idx)=>`
        <button class="ato-btn ${selectedIdx===idx ? 'active':''}"
                onclick="selecionar(${idx})"
                aria-label="Selecionar ${labelBotao(item)}">
          ${labelBotao(item)}
        </button>
      `).join("");
    }

    function selecionar(idx){
      selectedIdx = idx;
      renderGrid();
      atualizarSelecao();
      carregarVideo();

      // hash opcional: #trailer / #ato01...
      const item = SERIE.itens[idx];
      const h = (item.tipo === "Trailer") ? "trailer" : `ato${String(item.numero).padStart(2,'0')}`;
      location.hash = h;
    }

    function atualizarSelecao(){
      if (selectedIdx === null){
        tituloAto.textContent = "—";
        subTituloAto.textContent = "Escolha um item acima.";
        btnAssistir.disabled = true; btnAssistir.style.opacity = ".6";
        btnYoutube.disabled = true; btnYoutube.style.opacity = ".6";
        setNavDisabled(true);
        statusLine.textContent = "Selecione o Trailer ou um Ato para começar.";
        return;
      }

      const item = SERIE.itens[selectedIdx];
      tituloAto.textContent = tituloCompleto(item);
      subTituloAto.textContent = item.subtitulo || "";

      btnAssistir.disabled = false; btnAssistir.style.opacity = "1";
      btnYoutube.disabled = false; btnYoutube.style.opacity = "1";

      atoSinopseText.textContent = item.sinopse || "—";

      // navegação
      const isFirst = (selectedIdx === 0);
      const isLast  = (selectedIdx === SERIE.itens.length - 1);

      btnPrev.disabled = isFirst; btnPrev.style.opacity = isFirst ? ".6" : "1";
      btnNext.disabled = isLast;  btnNext.style.opacity = isLast ? ".6" : "1";
      btnPrev2.disabled = isFirst; btnPrev2.style.opacity = isFirst ? ".6" : "1";
      btnNext2.disabled = isLast;  btnNext2.style.opacity = isLast ? ".6" : "1";

      statusLine.textContent = `Pronto: ${tituloCompleto(item)}.`;
    }

    function setNavDisabled(disabled){
      btnPrev.disabled = disabled; btnPrev.style.opacity = disabled ? ".6" : "1";
      btnNext.disabled = disabled; btnNext.style.opacity = disabled ? ".6" : "1";
      btnPrev2.disabled = disabled; btnPrev2.style.opacity = disabled ? ".6" : "1";
      btnNext2.disabled = disabled; btnNext2.style.opacity = disabled ? ".6" : "1";
    }

    function carregarVideo(){
      if (selectedIdx === null) return;
      const item = SERIE.itens[selectedIdx];

      // ✅ youtube-nocookie (pra evitar o erro que você pegou)
      const embed = `https://www.youtube-nocookie.com/embed/${item.videoId}?rel=0&modestbranding=1&playsinline=1`;
      ytFrame.src = embed;

      nowTitle.textContent = tituloCompleto(item);
    }

    function abrirNoYoutube(){
      if (selectedIdx === null) return;
      const item = SERIE.itens[selectedIdx];
      const url = `https://www.youtube.com/watch?v=${item.videoId}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function irParaAto(dir){
      if (selectedIdx === null) return;
      const next = selectedIdx + dir;
      if (next < 0 || next >= SERIE.itens.length) return;
      selecionar(next);
      scrollToSection("assistir");
    }

    function resetarSelecao(){
      selectedIdx = null;
      renderGrid();
      atualizarSelecao();

      ytFrame.src = "about:blank";
      nowTitle.textContent = "—";
      atoSinopseText.textContent = "Selecione um item para ver a sinopse.";
      playerHint.textContent = "Selecione o Trailer ou um Ato para carregar o vídeo.";
      location.hash = "";
    }

    /* ===== Olhinho (sinopse geral + sinopse item) ===== */
    (function(){
      const btn = document.getElementById("toggleSinopse");
      const box = document.getElementById("sinopseBox");
      const eyeOpen = document.getElementById("eyeOpen");
      const eyeClosed = document.getElementById("eyeClosed");

      let open = true;
      btn?.addEventListener("click", ()=>{
        open = !open;
        box.classList.toggle("hidden", !open);
        eyeOpen.classList.toggle("hidden", !open);
        eyeClosed.classList.toggle("hidden", open);
      });

      const btn2 = document.getElementById("toggleAtoSinopse");
      const box2 = document.getElementById("atoSinopseBox");
      const eyeOpen2 = document.getElementById("eyeOpen2");
      const eyeClosed2 = document.getElementById("eyeClosed2");

      let open2 = true;
      btn2?.addEventListener("click", ()=>{
        open2 = !open2;
        box2.classList.toggle("hidden", !open2);
        eyeOpen2.classList.toggle("hidden", !open2);
        eyeClosed2.classList.toggle("hidden", open2);
      });
    })();

    /* ===== init (hash opcional) ===== */
    document.addEventListener("DOMContentLoaded", ()=>{
      renderGrid();
      atualizarSelecao();

      // hashes aceitos: #trailer, #ato01, #ato02...
      const h = (location.hash || "").replace("#","").toLowerCase().trim();
      if (!h) return;

      let idx = -1;
      if (h === "trailer") idx = 0;
      else {
        const m = h.match(/^ato(\d{2})$/);
        if (m){
          const n = parseInt(m[1], 10);
          idx = SERIE.itens.findIndex(it => it.tipo === "Ato" && it.numero === n);
        }
      }

      if (idx >= 0){
        selectedIdx = idx;
        renderGrid();
        atualizarSelecao();
        carregarVideo();
      }
    });
  
  window.selecionar = selecionar;
  window.abrirNoYoutube = abrirNoYoutube;
  window.irParaAto = irParaAto;
  window.resetarSelecao = resetarSelecao;

})();
