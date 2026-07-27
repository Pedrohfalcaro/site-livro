/**
 * Base URL da API — localhost em dev, Render em produção.
 */
(function (global) {
  const PROD_API = 'https://site-livro-backend.onrender.com';
  const DEV_API = 'http://localhost:3000';

  function isLocalhost() {
    const host = global.location?.hostname || '';
    return host === 'localhost' || host === '127.0.0.1';
  }

  function resolveApiBase(explicit) {
    if (explicit) return explicit.replace(/\/$/, '');
    return isLocalhost() ? DEV_API : PROD_API;
  }

  global.ApiBase = {
    PROD_API,
    DEV_API,
    resolveApiBase,
    isLocalhost,
  };
})(window);
