/**
 * Player áudio-série (episódios) — gerado por scripts/build-audio-players.mjs
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
    let selectedEp = null;     // índice em SERIE.eps
    let selectedPart = 0;      // índice em parts

    /* ===== Elementos ===== */
    const epGrid = document.getElementById("epGrid");
    const tituloEp = document.getElementById("tituloEp");
    const subTituloEp = document.getElementById("subTituloEp");
    const partsArea = document.getElementById("partsArea");
    const partsPills = document.getElementById("partsPills");

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

    const epSinopseText = document.getElementById("epSinopseText");

    /* ===== Render Episódios ===== */
    function pad2(n){ return String(n).padStart(2,'0'); }

    function renderEpGrid(){
      epGrid.innerHTML = SERIE.eps.map((e, idx)=>`
        <button class="ep-btn ${selectedEp===idx ? 'active':''}"
                onclick="selecionarEp(${idx})"
                aria-label="Selecionar episódio ${pad2(e.ep)}">
          ${pad2(e.ep)}
        </button>
      `).join("");
    }

    function tituloCompleto(epObj, partObj){
      const base = `EP ${pad2(epObj.ep)} — ${epObj.titulo}`;
      if (epObj.parts.length > 1){
        // se tiver parte com título, usa; senão: "Parte X"
        const t = partObj.tituloParte ? partObj.tituloParte : `Parte ${partObj.parte}`;
        return `${base} • ${t}`;
      }
      return base;
    }

    function selecionarEp(idx){
      selectedEp = idx;
      selectedPart = 0;
      renderEpGrid();
      renderPartes();
      atualizarSelecao();
      // carrega o vídeo imediatamente (pra ficar fluido)
      carregarVideo();
      // atualiza hash (opcional, mas ajuda a “lembrar” em refresh)
      const epNumber = SERIE.eps[idx].ep;
      location.hash = `ep${pad2(epNumber)}p${String(selectedPart+1)}`;
    }

    function renderPartes(){
      if (selectedEp === null){
        partsArea.classList.add("hidden");
        partsPills.innerHTML = "";
        return;
      }

      const epObj = SERIE.eps[selectedEp];
      if (epObj.parts.length <= 1){
        partsArea.classList.add("hidden");
        partsPills.innerHTML = "";
        return;
      }

      partsArea.classList.remove("hidden");

      partsPills.innerHTML = epObj.parts.map((p, pIdx)=>{
        const label = p.tituloParte ? `P${p.parte}` : `Parte ${p.parte}`;
        return `
          <button class="part-pill ${selectedPart===pIdx ? 'active':''}"
                  onclick="selecionarParte(${pIdx})"
                  title="${escapeHTML(p.tituloParte || ('Parte ' + p.parte))}">
            ${label}
          </button>
        `;
      }).join("");
    }

    function selecionarParte(pIdx){
      selectedPart = pIdx;
      renderPartes();
      atualizarSelecao();
      carregarVideo();
      const epNumber = SERIE.eps[selectedEp].ep;
      location.hash = `ep${pad2(epNumber)}p${String(selectedPart+1)}`;
    }

    function atualizarSelecao(){
      if (selectedEp === null){
        tituloEp.textContent = "—";
        subTituloEp.textContent = "Escolha um episódio acima.";
        btnAssistir.disabled = true; btnAssistir.style.opacity = ".6";
        btnYoutube.disabled = true; btnYoutube.style.opacity = ".6";
        setNavDisabled(true);
        statusLine.textContent = "Selecione um episódio para começar.";
        return;
      }

      const epObj = SERIE.eps[selectedEp];
      const partObj = epObj.parts[selectedPart];

      tituloEp.textContent = `EP ${pad2(epObj.ep)} — ${epObj.titulo}`;
      subTituloEp.textContent = (epObj.parts.length > 1)
        ? (partObj.tituloParte || `Parte ${partObj.parte}`)
        : "Episódio único (sem partes).";

      btnAssistir.disabled = false; btnAssistir.style.opacity = "1";
      btnYoutube.disabled = false; btnYoutube.style.opacity = "1";

      epSinopseText.textContent = epObj.sinopse || "TEMPLATE: sinopse (você troca depois).";

      // navegação
      const hasParts = epObj.parts.length > 1;
      if (!hasParts){
        setNavDisabled(true);
      }else{
        const isFirst = (selectedPart === 0);
        const isLast  = (selectedPart === epObj.parts.length - 1);
        btnPrev.disabled = isFirst; btnPrev.style.opacity = isFirst ? ".6" : "1";
        btnNext.disabled = isLast;  btnNext.style.opacity = isLast ? ".6" : "1";
        btnPrev2.disabled = isFirst; btnPrev2.style.opacity = isFirst ? ".6" : "1";
        btnNext2.disabled = isLast;  btnNext2.style.opacity = isLast ? ".6" : "1";
      }

      statusLine.textContent = `Pronto: ${tituloCompleto(epObj, partObj)}.`;
    }

    function setNavDisabled(disabled){
      btnPrev.disabled = disabled; btnPrev.style.opacity = disabled ? ".6" : "1";
      btnNext.disabled = disabled; btnNext.style.opacity = disabled ? ".6" : "1";
      btnPrev2.disabled = disabled; btnPrev2.style.opacity = disabled ? ".6" : "1";
      btnNext2.disabled = disabled; btnNext2.style.opacity = disabled ? ".6" : "1";
    }

    function carregarVideo(){
  if (selectedEp === null) return;
  const epObj = SERIE.eps[selectedEp];
  const partObj = epObj.parts[selectedPart];

  const origin = encodeURIComponent(window.location.origin);
const embed = `https://www.youtube.com/embed/${partObj.videoId}?rel=0`;
ytFrame.src = embed;


  const t = tituloCompleto(epObj, partObj);
  nowTitle.textContent = t;
  playerHint.textContent = "Se não carregar, pode ser restrição de incorporação do vídeo.";
}


    function abrirNoYoutube(){
      if (selectedEp === null) return;
      const epObj = SERIE.eps[selectedEp];
      const partObj = epObj.parts[selectedPart];

      // template (link normal)
      const url = `https://www.youtube.com/watch?v=${partObj.videoId}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function irParaParte(dir){
      if (selectedEp === null) return;
      const epObj = SERIE.eps[selectedEp];
      if (epObj.parts.length <= 1) return;

      const next = selectedPart + dir;
      if (next < 0 || next >= epObj.parts.length) return;
      selecionarParte(next);
      scrollToSection("assistir");
    }

    function resetarSelecao(){
      selectedEp = null;
      selectedPart = 0;
      renderEpGrid();
      renderPartes();
      atualizarSelecao();

      ytFrame.src = "about:blank";
      nowTitle.textContent = "—";
      epSinopseText.textContent = "Selecione um episódio para ver a sinopse.";
      playerHint.textContent = "Selecione um episódio para carregar o vídeo.";
      location.hash = "";
    }

    function escapeHTML(str){
      return String(str)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    /* ===== Olhinho (sinopse geral) ===== */
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

      // sinopse EP
      const btn2 = document.getElementById("toggleEpSinopse");
      const box2 = document.getElementById("epSinopseBox");
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
      renderEpGrid();
      atualizarSelecao();

      // Se vier hash tipo #ep02p2, tenta abrir
      const h = (location.hash || "").replace("#","").toLowerCase().trim();
      const m = h.match(/^ep(\d{2})p(\d+)$/);
      if (m){
        const epNum = parseInt(m[1], 10);
        const partNum = parseInt(m[2], 10); // 1-based
        const idx = SERIE.eps.findIndex(e => e.ep === epNum);
        if (idx >= 0){
          selectedEp = idx;
          const epObj = SERIE.eps[idx];
          selectedPart = Math.max(0, Math.min(epObj.parts.length-1, partNum-1));
          renderEpGrid();
          renderPartes();
          atualizarSelecao();
          carregarVideo();
        }
      }
    });
  
  window.selecionarEp = selecionarEp;
  window.selecionarParte = selecionarParte;
  window.abrirNoYoutube = abrirNoYoutube;
  window.irParaParte = irParaParte;
  window.resetarSelecao = resetarSelecao;

})();
