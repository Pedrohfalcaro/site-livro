/**
 * Widget de comentários reutilizável (Sangue Divino, ADC T1, ADC Echos).
 * Uso: CommentsWidget.init({ container, obra, cap, apiBase })
 */
(function () {
  'use strict';

  function escapeHTML(s) {
    return String(s)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function starBar(nota) {
    const full  = Math.floor(nota);
    const half  = nota % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  function renderList(container, comentarios) {
    const list = container.querySelector('.cw-list');
    const empty = container.querySelector('.cw-empty');
    if (!list) return;
    if (!comentarios || comentarios.length === 0) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    list.innerHTML = comentarios.map(c => `
      <li class="cw-item">
        <div class="cw-item__header">
          <span class="cw-item__name">${escapeHTML(c.nome)}</span>
          ${c.nota != null ? `<span class="cw-item__stars" title="Nota ${c.nota}">${starBar(c.nota)}</span>` : ''}
        </div>
        <p class="cw-item__text">${escapeHTML(c.texto)}</p>
      </li>
    `).join('');
  }

  async function loadComments(container, obra, cap, apiBase) {
    const status = container.querySelector('.cw-status');
    if (status) { status.textContent = 'Carregando comentários…'; status.hidden = false; }
    try {
      const res = await fetch(`${apiBase}/comments/${encodeURIComponent(obra)}/${encodeURIComponent(cap)}`, { mode: 'cors' });
      const json = await res.json();
      if (status) status.hidden = true;
      renderList(container, json.comentarios || []);
    } catch {
      if (status) { status.textContent = 'Não foi possível carregar comentários.'; }
    }
  }

  function buildForm(container, obra, cap, apiBase) {
    const form = container.querySelector('.cw-form');
    if (!form) return;

    const feedback = form.querySelector('.cw-feedback');
    let submitting = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      submitting = true;

      const btn = form.querySelector('button[type=submit]');
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
      if (feedback) { feedback.textContent = ''; feedback.className = 'cw-feedback'; }

      const data = {
        obra,
        cap,
        nome: form.querySelector('[name=nome]')?.value?.trim() || '',
        email: form.querySelector('[name=email]')?.value?.trim() || '',
        texto: form.querySelector('[name=texto]')?.value?.trim() || '',
        nota: Number(form.querySelector('[name=nota]')?.value || 5),
        website: form.querySelector('[name=website]')?.value || '',
      };

      try {
        const res = await fetch(`${apiBase}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.ok) {
          if (feedback) { feedback.textContent = 'Comentário enviado! Aguardando aprovação.'; feedback.className = 'cw-feedback cw-feedback--ok'; }
          form.reset();
        } else {
          if (feedback) { feedback.textContent = json.error || 'Erro ao enviar. Tente novamente.'; feedback.className = 'cw-feedback cw-feedback--err'; }
        }
      } catch {
        if (feedback) { feedback.textContent = 'Falha de conexão. Tente novamente.'; feedback.className = 'cw-feedback cw-feedback--err'; }
      } finally {
        submitting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar comentário'; }
      }
    });
  }

  function init({ container, obra, cap, apiBase }) {
    if (!container || !obra || cap == null || !apiBase) return;
    loadComments(container, obra, cap, apiBase);
    buildForm(container, obra, cap, apiBase);
  }

  function buildHTML(sectionTitle) {
    return `
<div class="surface p-5 sm:p-6 mt-6">
  <h3 class="text-lg font-extrabold">${escapeHTML(sectionTitle || 'Comentários')}</h3>
  <p class="text-sm muted mt-1">Deixe sua opinião. Comentários são aprovados antes de aparecer.</p>

  <span class="cw-status text-sm muted mt-3 block" hidden></span>
  <p class="cw-empty text-sm muted mt-3" hidden>Ainda não há comentários. Seja o primeiro!</p>
  <ul class="cw-list mt-4 space-y-4 list-none p-0"></ul>

  <form class="cw-form mt-6 flex flex-col gap-3" novalidate>
    <input name="website" type="text" autocomplete="off" style="display:none" tabindex="-1" />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="text-xs font-extrabold muted2 block mb-1" for="cwNome">Nome *</label>
        <input id="cwNome" name="nome" type="text" maxlength="80" required
               class="cw-input w-full" placeholder="Seu nome" />
      </div>
      <div>
        <label class="text-xs font-extrabold muted2 block mb-1" for="cwEmail">E-mail * <span style="font-weight:400;opacity:.6">(não aparece)</span></label>
        <input id="cwEmail" name="email" type="email" maxlength="160" required
               class="cw-input w-full" placeholder="seu@email.com" />
      </div>
    </div>

    <div>
      <label class="text-xs font-extrabold muted2 block mb-1" for="cwNota">Nota *</label>
      <select id="cwNota" name="nota" class="cw-input w-full sm:w-auto" required>
        <option value="5">★★★★★ — 5,0</option>
        <option value="4.5">★★★★½ — 4,5</option>
        <option value="4">★★★★☆ — 4,0</option>
        <option value="3.5">★★★½☆ — 3,5</option>
        <option value="3">★★★☆☆ — 3,0</option>
        <option value="2.5">★★½☆☆ — 2,5</option>
        <option value="2">★★☆☆☆ — 2,0</option>
        <option value="1.5">★½☆☆☆ — 1,5</option>
        <option value="1">★☆☆☆☆ — 1,0</option>
        <option value="0.5">½☆☆☆☆ — 0,5</option>
      </select>
    </div>

    <div>
      <label class="text-xs font-extrabold muted2 block mb-1" for="cwTexto">Comentário *</label>
      <textarea id="cwTexto" name="texto" rows="4" maxlength="1200" required
                class="cw-input w-full resize-y" placeholder="O que você achou?"></textarea>
    </div>

    <div class="flex items-center gap-3">
      <button type="submit" class="btn btn-primary">Enviar comentário</button>
      <span class="cw-feedback text-sm"></span>
    </div>
  </form>
</div>`;
  }

  global.CommentsWidget = { init, buildHTML };
})();
