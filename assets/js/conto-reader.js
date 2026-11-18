/**
 * Leitor de contos: partes, progresso, gate e BGM opcional.
 */
(function () {
  const configEl = document.getElementById('conto-config');
  if (!configEl) return;

  const config = JSON.parse(configEl.textContent || '{}');
  const panels = [...document.querySelectorAll('.conto-chapter-panel')];
  const partsWrap = document.getElementById('contoParts');
  const progressBar = document.getElementById('contoProgressBar');

  function unlockConto() {
    document.body.classList.remove('conto-locked');
    document.documentElement.style.overflow = '';
  }

  if (globalThis.AccessGate) {
    AccessGate.setupGate({
      config,
      unlock: unlockConto,
      inputId: 'contoGateInput',
      emailId: 'contoGateEmail',
      confirmId: 'contoGateConfirm',
      cancelId: 'contoGateCancel',
      msgId: 'contoGateMsg',
    });
  } else if (!config.gated) {
    unlockConto();
  }

  // ===== Progresso de scroll =====
  function updateProgress() {
    if (!progressBar) return;
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    const pct = total > 0 ? (doc.scrollTop / total) * 100 : 0;
    progressBar.style.width = pct + '%';
  }

  document.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  // ===== Navegação de partes =====
  const partBtns = [];

  if (partsWrap && panels.length) {
    panels.forEach((panel, i) => {
      const label = panel.dataset.label || `Parte ${i + 1}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'conto-part-btn' + (i === 0 ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => setPart(i));
      partsWrap.appendChild(btn);
      partBtns.push(btn);
    });
  }

  function setPart(index) {
    if (typeof index !== 'number' || index < 0 || index >= panels.length) return;

    partBtns.forEach((b, i) => b.classList.toggle('active', i === index));
    panels.forEach((p, i) => {
      p.classList.toggle('active', i === index);
      p.hidden = false;
    });

    if (config.temaParte2 && index === 1) {
      document.body.classList.add('conto-alt-theme');
    } else {
      document.body.classList.remove('conto-alt-theme');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateProgress();
  }

  // ===== Comentários (igual ao leitor de Sangue Divino, mas um único mural pro conto inteiro) =====
  // Definido antes do primeiro setPart(0) para que o painel já exista.
  if (config.comments && config.slug) {
    const CAP_CONTO = 1; // comentários do conto inteiro, não por parte
    const COMMENTS_API_PROD = 'https://site-livro-backend.onrender.com';
    const COMMENTS_API_DEV = 'http://localhost:3000';

    var commentsApiBase = function () {
      const host = location.hostname || '';
      return host === 'localhost' || host === '127.0.0.1' ? COMMENTS_API_DEV : COMMENTS_API_PROD;
    };

    var escapeHtml = function (str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    };

    var listaEl = document.getElementById('contoComentariosLista');
    var starsEl = document.getElementById('contoComentarioStars');
    var msgEl = document.getElementById('contoComentarioMsg');
    var btnEl = document.getElementById('contoComentarioBtn');
    var rating = 0;

    function renderComentarios(comentarios) {
      if (!listaEl) return;
      if (!comentarios.length) {
        listaEl.textContent = 'Nenhum comentário ainda.';
        return;
      }
      listaEl.innerHTML = comentarios
        .map(
          (c) => `
          <div class="conto-comment-item">
            <div class="conto-comment-head">
              <strong>${escapeHtml(c.nome)}</strong>
              <span class="conto-comment-nota">⭐ ${escapeHtml(String(c.nota))}</span>
            </div>
            <p class="conto-comment-texto">${escapeHtml(c.texto)}</p>
          </div>`
        )
        .join('');
    }

    async function carregarComentarios() {
      if (!listaEl) return;
      listaEl.textContent = 'Carregando comentários...';
      try {
        const res = await fetch(`${commentsApiBase()}/comments/${config.slug}/${CAP_CONTO}`);
        const data = await res.json().catch(() => ({}));
        renderComentarios(Array.isArray(data.comentarios) ? data.comentarios : []);
      } catch {
        listaEl.textContent = 'Erro ao carregar comentários.';
      }
    }

    function updateStars(value) {
      const stars = starsEl ? [...starsEl.querySelectorAll('.conto-comment-star')] : [];
      stars.forEach((star, i) => {
        const index = i + 1;
        star.classList.remove('full', 'half');
        if (value >= index) star.classList.add('full');
        else if (value >= index - 0.5) star.classList.add('half');
      });
    }

    if (starsEl) {
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'conto-comment-star';
        star.textContent = '★';
        star.addEventListener('mousemove', (e) => {
          const rect = star.getBoundingClientRect();
          const half = e.clientX < rect.left + rect.width / 2;
          updateStars(i - (half ? 0.5 : 0));
        });
        star.addEventListener('click', (e) => {
          const rect = star.getBoundingClientRect();
          const half = e.clientX < rect.left + rect.width / 2;
          rating = i - (half ? 0.5 : 0);
          updateStars(rating);
        });
        starsEl.appendChild(star);
      }
    }

    if (btnEl) {
      btnEl.addEventListener('click', async () => {
        const nome = document.getElementById('contoComentarioNome')?.value.trim() || '';
        const email = document.getElementById('contoComentarioEmail')?.value.trim() || '';
        const texto = document.getElementById('contoComentarioTexto')?.value.trim() || '';
        const website = document.getElementById('contoComentarioWebsite')?.value || '';

        if (!nome || !email || !texto) {
          if (msgEl) msgEl.textContent = 'Preencha todos os campos.';
          return;
        }
        if (!rating) {
          if (msgEl) msgEl.textContent = 'Escolha uma nota nas estrelas.';
          return;
        }

        btnEl.disabled = true;
        if (msgEl) msgEl.textContent = 'Enviando…';

        try {
          const res = await fetch(`${commentsApiBase()}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              obra: config.slug,
              cap: CAP_CONTO,
              nome,
              email,
              texto,
              nota: rating,
              website,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (msgEl) msgEl.textContent = data.error || 'Erro ao enviar comentário.';
            return;
          }
          if (msgEl) msgEl.textContent = data.message || 'Comentário enviado! (aguardando aprovação)';
          document.getElementById('contoComentarioNome').value = '';
          document.getElementById('contoComentarioEmail').value = '';
          document.getElementById('contoComentarioTexto').value = '';
          rating = 0;
          updateStars(0);
        } catch {
          if (msgEl) msgEl.textContent = 'Erro ao enviar comentário.';
        } finally {
          btnEl.disabled = false;
        }
      });
    }

    carregarComentarios();
  }

  if (panels.length) setPart(0);

  // ===== BGM =====
  const audio = document.getElementById('contoBgm');
  const toggle = document.getElementById('contoBgmToggle');
  const vol = document.getElementById('contoBgmVol');

  if (audio && toggle && vol) {
    const savedVol = parseFloat(localStorage.getItem('bgmVol') || '0.15');
    const savedPlay = localStorage.getItem('bgmPlay') === '1';

    audio.volume = Number.isNaN(savedVol) ? 0.15 : savedVol;
    vol.value = String(audio.volume);

    const updateLabel = () => {
      toggle.textContent = audio.paused ? 'Música: Off' : 'Música: On';
    };

    toggle.addEventListener('click', async () => {
      try {
        if (audio.paused) {
          await audio.play();
          localStorage.setItem('bgmPlay', '1');
        } else {
          audio.pause();
          localStorage.setItem('bgmPlay', '0');
        }
        updateLabel();
      } catch (e) {
        console.warn('Playback bloqueado:', e);
      }
    });

    vol.addEventListener('input', () => {
      audio.volume = parseFloat(vol.value);
      localStorage.setItem('bgmVol', String(audio.volume));
    });

    if (savedPlay) {
      audio.play().then(updateLabel).catch(() => updateLabel());
    } else {
      updateLabel();
    }

    document.addEventListener(
      'pointerdown',
      () => {
        if (audio.paused && savedPlay) audio.play().catch(() => {});
      },
      { once: true }
    );
  }
})();
