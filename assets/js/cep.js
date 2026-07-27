/**
 * Busca de endereço por CEP (ViaCEP) + máscara simples.
 */
(function (global) {
  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatCep(value) {
    const digits = onlyDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return digits.slice(0, 5) + '-' + digits.slice(5);
  }

  /**
   * @param {string} cep
   * @returns {Promise<{ ok: true, rua: string, bairro: string, cidade: string, estado: string, cep: string } | { ok: false, error: string }>}
   */
  async function lookupCep(cep) {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      return { ok: false, error: 'CEP deve ter 8 dígitos.' };
    }

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) {
        return { ok: false, error: 'Não foi possível consultar o CEP.' };
      }

      const data = await res.json();
      if (data.erro) {
        return { ok: false, error: 'CEP não encontrado.' };
      }

      return {
        ok: true,
        rua: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        cep: formatCep(digits),
      };
    } catch {
      return { ok: false, error: 'Falha na consulta do CEP. Preencha o endereço manualmente.' };
    }
  }

  /**
   * Liga máscara + autofill em um formulário de checkout.
   * Expõe `CepLookup.ensureAddressReady()` para o botão Pagar aguardar a busca.
   */
  function bindCheckoutCep(options) {
    const cepInput = document.getElementById(options.cepId);
    const section = document.getElementById(options.addressSectionId);
    const statusEl = options.statusId ? document.getElementById(options.statusId) : null;
    const fields = options.fields || {};

    if (!cepInput) return;

    let lastLookup = '';
    let looking = false;
    /** @type {Promise<void> | null} */
    let inflight = null;
    let debounceTimer = null;

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.style.color = isError ? '#b91c1c' : '';
      if (document.body.classList.contains('dark-mode') && isError) {
        statusEl.style.color = '#fecaca';
      }
    }

    function revealAddress() {
      if (section) section.hidden = false;
    }

    function fillFromResult(result) {
      const map = {
        rua: result.rua,
        bairro: result.bairro,
        cidade: result.cidade,
        estado: result.estado,
      };

      for (const [key, value] of Object.entries(map)) {
        const el = document.getElementById(fields[key]);
        if (el && value) el.value = value;
      }

      if (result.cep) cepInput.value = result.cep;
    }

    function focusFirstEmptyAddressField() {
      const order = ['numero', 'rua', 'bairro', 'cidade', 'estado', 'complemento'];
      for (const key of order) {
        const el = document.getElementById(fields[key] || key);
        if (el && !(el.value || '').trim() && key !== 'complemento') {
          el.focus();
          return;
        }
      }
      document.getElementById(fields.numero || 'numero')?.focus();
    }

    /**
     * @param {{ focusNumero?: boolean }} [opts]
     */
    function runLookup(opts = {}) {
      const digits = onlyDigits(cepInput.value);
      cepInput.value = formatCep(digits);

      if (digits.length !== 8) {
        if (digits.length > 0) setStatus('Digite o CEP completo (8 dígitos).', true);
        return Promise.resolve({ ok: false, reason: 'incomplete' });
      }

      if (digits === lastLookup && section && !section.hidden) {
        return Promise.resolve({ ok: true, cached: true });
      }

      if (inflight) return inflight;

      looking = true;
      setStatus('Buscando endereço…', false);

      inflight = lookupCep(digits)
        .then((result) => {
          looking = false;
          inflight = null;

          if (!result.ok) {
            lastLookup = '';
            revealAddress();
            setStatus(result.error + ' Você pode preencher manualmente.', true);
            return { ok: false, reason: 'not_found' };
          }

          lastLookup = digits;
          fillFromResult(result);
          revealAddress();
          setStatus(
            'Endereço encontrado. Confira e informe o número (complemento é opcional).',
            false,
          );

          if (opts.focusNumero !== false) {
            focusFirstEmptyAddressField();
          }

          return { ok: true };
        })
        .catch(() => {
          looking = false;
          inflight = null;
          lastLookup = '';
          revealAddress();
          setStatus('Falha na consulta. Preencha o endereço manualmente.', true);
          return { ok: false, reason: 'error' };
        });

      return inflight;
    }

    function scheduleLookup() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runLookup({ focusNumero: true });
      }, 280);
    }

    /**
     * Garante que o CEP foi consultado e a seção de endereço está aberta.
     * Usado antes de pagar.
     */
    async function ensureAddressReady() {
      clearTimeout(debounceTimer);
      const digits = onlyDigits(cepInput.value);

      if (digits.length !== 8) {
        setStatus('Informe um CEP válido (8 dígitos).', true);
        cepInput.focus();
        return { ok: false, reason: 'incomplete_cep' };
      }

      const result = await runLookup({ focusNumero: false });
      revealAddress();
      return result;
    }

    cepInput.addEventListener('input', () => {
      const raw = cepInput.value;
      const formatted = formatCep(raw);
      if (raw !== formatted) {
        cepInput.value = formatted;
        try {
          cepInput.setSelectionRange(formatted.length, formatted.length);
        } catch (_) {}
      }

      const digits = onlyDigits(formatted);
      if (digits.length < 8) {
        lastLookup = '';
        setStatus('', false);
        clearTimeout(debounceTimer);
        return;
      }

      scheduleLookup();
    });

    cepInput.addEventListener('blur', () => {
      clearTimeout(debounceTimer);
      if (onlyDigits(cepInput.value).length === 8) {
        runLookup({ focusNumero: true });
      }
    });

    cepInput.addEventListener('paste', () => {
      setTimeout(() => {
        cepInput.value = formatCep(cepInput.value);
        if (onlyDigits(cepInput.value).length === 8) scheduleLookup();
      }, 0);
    });

    cepInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        runLookup({ focusNumero: true });
      }
    });

    global.CepLookup.ensureAddressReady = ensureAddressReady;
    global.CepLookup.revealAddress = revealAddress;
    global.CepLookup.focusFirstEmptyAddressField = focusFirstEmptyAddressField;
  }

  global.CepLookup = {
    onlyDigits,
    formatCep,
    lookupCep,
    bindCheckoutCep,
    ensureAddressReady: async () => ({ ok: false, reason: 'not_bound' }),
    revealAddress: () => {},
    focusFirstEmptyAddressField: () => {},
  };
})(window);
