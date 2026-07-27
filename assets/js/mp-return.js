/**
 * Lê query params de retorno do Mercado Pago e preenche um bloco na página.
 *
 * Params típicos do MP (back_urls):
 * payment_id, status, collection_id, collection_status,
 * preference_id, merchant_order_id, payment_type, external_reference
 */
(function (global) {
  const STATUS_LABELS = {
    approved: 'Aprovado',
    pending: 'Pendente',
    in_process: 'Em análise',
    in_mediation: 'Em mediação',
    rejected: 'Recusado',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
    refunded: 'Estornado',
    charged_back: 'Chargeback',
    null: 'Indefinido',
  };

  function readMpReturnParams() {
    const q = new URLSearchParams(global.location.search);
    const paymentId = q.get('payment_id') || q.get('collection_id') || '';
    const status = q.get('status') || q.get('collection_status') || '';
    const externalReference = q.get('external_reference') || '';

    return {
      paymentId: paymentId && paymentId !== 'null' ? paymentId : '',
      status: status && status !== 'null' ? status : '',
      preferenceId: q.get('preference_id') || '',
      merchantOrderId: q.get('merchant_order_id') || '',
      paymentType: q.get('payment_type') || '',
      externalReference:
        externalReference && externalReference !== 'null' ? externalReference : '',
    };
  }

  function statusLabel(status) {
    if (!status) return '';
    const key = String(status).toLowerCase();
    return STATUS_LABELS[key] || status;
  }

  function row(label, value) {
    if (!value) return '';
    return (
      '<div class="flex flex-wrap gap-x-2 gap-y-1 text-sm">' +
      '<span class="muted2">' +
      label +
      ':</span>' +
      '<code style="user-select:all;">' +
      String(value) +
      '</code>' +
      '</div>'
    );
  }

  /**
   * @param {string} containerId
   * @param {{ emptyMessage?: string }} [options]
   */
  function renderMpReturnDetails(containerId, options = {}) {
    const el = document.getElementById(containerId);
    if (!el) return null;

    const data = readMpReturnParams();
    const hasAny =
      data.paymentId ||
      data.status ||
      data.preferenceId ||
      data.merchantOrderId ||
      data.paymentType ||
      data.externalReference;

    if (!hasAny) {
      if (options.emptyMessage) {
        el.innerHTML = '<p class="text-sm muted2">' + options.emptyMessage + '</p>';
        el.hidden = false;
      }
      return data;
    }

    const label = statusLabel(data.status);
    el.innerHTML =
      '<p class="font-extrabold mb-2">Detalhes do Mercado Pago</p>' +
      (label
        ? '<p class="text-sm mb-3"><strong>Status:</strong> ' + label + '</p>'
        : '') +
      row('ID do pagamento', data.paymentId) +
      row('Tipo', data.paymentType) +
      row('Pedido MP', data.merchantOrderId) +
      row('Preferência', data.preferenceId) +
      row('Referência', data.externalReference) +
      '<p class="text-xs muted2 mt-3">Guarde o ID do pagamento se precisar de suporte.</p>';

    el.hidden = false;
    return data;
  }

  /**
   * Consulta o backend até o pagamento ser approved (Pix costuma confirmar depois do redirect).
   */
  function pollPaymentUntilApproved(options = {}) {
    const {
      intervalMs = 4000,
      maxAttempts = 45,
      onUpdate,
      onApproved,
      onGiveUp,
    } = options;

    const data = readMpReturnParams();
    if (!data.paymentId) return null;

    const apiBase =
      global.ApiBase?.resolveApiBase?.() || 'https://site-livro-backend.onrender.com';
    let attempts = 0;
    let timer = null;

    async function tick() {
      attempts += 1;
      try {
        const res = await fetch(
          `${apiBase}/mp/payment-status?payment_id=${encodeURIComponent(data.paymentId)}`,
          { mode: 'cors' },
        );
        const json = await res.json();
        onUpdate?.(json);

        if (json?.ok && json.status === 'approved') {
          if (timer) clearInterval(timer);
          onApproved?.(json);
          return;
        }
      } catch (error) {
        console.warn('poll payment-status:', error);
      }

      if (attempts >= maxAttempts) {
        if (timer) clearInterval(timer);
        onGiveUp?.();
      }
    }

    tick();
    timer = setInterval(tick, intervalMs);
    return () => {
      if (timer) clearInterval(timer);
    };
  }

  global.MpReturn = {
    readMpReturnParams,
    statusLabel,
    renderMpReturnDetails,
    pollPaymentUntilApproved,
  };
})(window);
