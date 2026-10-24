/**
 * Temas sazonais do site (ex.: Halloween).
 *
 * Carregar SÍNCRONO no <head>, antes do CSS pintar a página, para evitar flash de tema.
 * Quando há evento ativo, marca <html data-evento="<id>"> e o CSS de
 * /assets/css/eventos/<id>.css faz o resto. Fora da janela, nada muda.
 *
 * Para criar/alterar um evento, edite EVENTOS abaixo (datas no fuso de Brasília, -03:00;
 * `fim` é exclusivo, ou seja, o primeiro instante JÁ FORA do evento).
 *
 * Pré-visualização (útil fora da janela):
 *   ?evento=halloween  → liga o tema (e lembra durante a sessão da aba)
 *   ?evento=off        → desliga e esquece
 */
(function (global) {
  const EVENTOS = [
    {
      id: 'halloween',
      inicio: '2026-10-25T00:00:00-03:00',
      fim: '2026-11-08T00:00:00-03:00', // vale até o fim do dia 07/11
    },
  ];

  const PREVIEW_KEY = 'evento-preview';

  function lerPreview() {
    try {
      const param = new URLSearchParams(global.location.search).get('evento');
      if (param === 'off') {
        sessionStorage.removeItem(PREVIEW_KEY);
        return 'off';
      }
      if (param && EVENTOS.some((e) => e.id === param)) {
        sessionStorage.setItem(PREVIEW_KEY, param);
        return param;
      }
      return sessionStorage.getItem(PREVIEW_KEY);
    } catch (_) {
      return null;
    }
  }

  function eventoAtivo(agora) {
    const preview = lerPreview();
    if (preview === 'off') return null;
    if (preview) return EVENTOS.find((e) => e.id === preview) || null;
    const t = agora.getTime();
    return EVENTOS.find((e) => t >= Date.parse(e.inicio) && t < Date.parse(e.fim)) || null;
  }

  const ativo = eventoAtivo(new Date());
  if (ativo) document.documentElement.setAttribute('data-evento', ativo.id);

  global.Evento = { ativo: ativo ? ativo.id : null, eventos: EVENTOS };
})(window);
