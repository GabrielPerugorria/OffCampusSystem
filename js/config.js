'use strict';
/* ============================================================
   EvoTech Events — configuração do frontend
   Único arquivo que muda entre ambientes. NUNCA coloque
   segredos aqui: tudo neste arquivo é público.
   ============================================================ */
(function () {
  const host = window.location.hostname;

  // Desenvolvimento local (Live Server, http.server, npx serve...)
  const isLocal = ['localhost', '127.0.0.1', '', '0.0.0.0'].includes(host);

  window.EVO_CONFIG = {
    // O ambiente local usa a API local; o frontend publicado usa a API da Deplexo.
    API_BASE_URL: isLocal
      ? 'http://localhost:3333/api'
      : 'https://offcampussystem-api.de.deplexo.com/api',

    // Chaves usadas no armazenamento local do navegador.
    // Guardam apenas tokens de sessão — nenhum dado de negócio.
    STORAGE_KEYS: {
      auth: 'evo_auth',        // access token + refresh token
      session: 'evo_session',  // snapshot do usuário (usado pelo admin-guard)
    },
  };
})();
