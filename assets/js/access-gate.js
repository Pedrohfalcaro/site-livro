/**
 * Gate de acesso — validação de chave + e-mail via backend.
 */
(function (global) {
  const PROD_API = 'https://site-livro-backend.onrender.com';
  const DEV_API = 'http://localhost:3000';
  const SESSION_PREFIX = 'access-v2';

  function isLocalhost() {
    const host = global.location?.hostname || '';
    return host === 'localhost' || host === '127.0.0.1';
  }

  function resolveApiBase(explicit) {
    if (explicit) return explicit.replace(/\/$/, '');
    return isLocalhost() ? DEV_API : PROD_API;
  }

  function sessionKey(resourceType, slug) {
    return `${SESSION_PREFIX}-${resourceType}-${slug}`;
  }

  function isSessionUnlocked(resourceType, slug) {
    try {
      return sessionStorage.getItem(sessionKey(resourceType, slug)) === '1';
    } catch {
      return false;
    }
  }

  function persistUnlock(resourceType, slug, token) {
    try {
      sessionStorage.setItem(sessionKey(resourceType, slug), '1');
      if (token) {
        sessionStorage.setItem(`${sessionKey(resourceType, slug)}-token`, token);
      }
    } catch (_) {}
  }

  async function validateKey({ apiBase, resourceType, slug, key, email }) {
    const base = resolveApiBase(apiBase);

    try {
      const res = await fetch(`${base}/access/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: resourceType,
          slug,
          key: key.trim(),
          email: (email || '').trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        return {
          ok: false,
          error:
            data.error ||
            'Chave ou e-mail inválidos. Use o e-mail da compra e a chave do e-mail de confirmação.',
        };
      }

      return { ok: true, token: data.token };
    } catch {
      return {
        ok: false,
        error: isLocalhost()
          ? 'Não foi possível contactar a API local (porta 3000). Rode: cd site-livro-backend.refatorado && npm start'
          : 'Serviço de validação indisponível. Tente novamente em instantes.',
      };
    }
  }

  /**
   * @param {object} options
   * @param {object} options.config - { gated, slug, resourceType, landingLink, apiBase?, requireEmail? }
   * @param {() => void} options.unlock
   * @param {string} [options.inputId='gateInput']
   * @param {string} [options.emailId='gateEmail']
   * @param {string} [options.confirmId='gateConfirm']
   * @param {string} [options.cancelId='gateCancel']
   * @param {string} [options.msgId='gateMsg']
   */
  function setupGate(options) {
    const {
      config,
      unlock,
      inputId = 'gateInput',
      emailId = 'gateEmail',
      confirmId = 'gateConfirm',
      cancelId = 'gateCancel',
      msgId = 'gateMsg',
    } = options;

    if (!config?.gated) {
      unlock();
      return;
    }

    const { slug, resourceType, landingLink, apiBase } = config;
    const requireEmail = config.requireEmail !== false;

    if (isSessionUnlocked(resourceType, slug)) {
      unlock();
      return;
    }

    document.documentElement.style.overflow = 'hidden';

    const input = document.getElementById(inputId);
    const emailInput = document.getElementById(emailId);
    const btnOk = document.getElementById(confirmId);
    const btnNo = document.getElementById(cancelId);
    const msg = document.getElementById(msgId);

    if (!requireEmail && emailInput) {
      const emailWrap = emailInput.closest('[data-gate-email-wrap]') || emailInput.parentElement;
      emailWrap?.classList.add('hidden');
      emailInput.required = false;
    }

    async function tryUnlock() {
      const key = (input?.value || '').trim();
      const email = (emailInput?.value || '').trim();

      if (requireEmail && !email) {
        if (msg) msg.textContent = 'Digite o e-mail usado na compra.';
        emailInput?.focus();
        return;
      }

      if (!key) {
        if (msg) msg.textContent = 'Digite a chave de leitura.';
        input?.focus();
        return;
      }

      if (btnOk) btnOk.disabled = true;
      if (msg) msg.textContent = 'Validando…';

      const result = await validateKey({ apiBase, resourceType, slug, key, email });

      if (btnOk) btnOk.disabled = false;

      if (result.ok) {
        persistUnlock(resourceType, slug, result.token);
        unlock();
        return;
      }

      if (msg) {
        msg.textContent = requireEmail
          ? result.error
          : result.error?.includes('e-mail')
            ? 'Chave inválida.'
            : result.error;
      }
      input?.focus();
    }

    function onEnter(e) {
      if (e.key === 'Enter') tryUnlock();
    }

    btnOk?.addEventListener('click', tryUnlock);
    input?.addEventListener('keydown', onEnter);
    if (requireEmail) emailInput?.addEventListener('keydown', onEnter);
    btnNo?.addEventListener('click', () => {
      global.location.href = landingLink || '/loja.html';
    });

    if (requireEmail) emailInput?.focus();
    else input?.focus();
  }

  global.AccessGate = {
    PROD_API,
    DEV_API,
    resolveApiBase,
    validateKey,
    isSessionUnlocked,
    persistUnlock,
    setupGate,
  };
})(window);
