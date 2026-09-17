'use strict';
/* ============================================================
   EvoTech Events — cliente HTTP da API
   Centraliza fetch, token, renovação de sessão e erros.
   Nenhuma tela fala com o backend sem passar por aqui.
   ============================================================ */
(function () {
  const CFG = window.EVO_CONFIG;
  const KEYS = CFG.STORAGE_KEYS;

  /* ---------- Armazenamento dos tokens ---------- */
  const store = {
    getAuth() {
      try { return JSON.parse(localStorage.getItem(KEYS.auth)); } catch { return null; }
    },
    setAuth(auth) {
      try { localStorage.setItem(KEYS.auth, JSON.stringify(auth)); } catch { }
    },
    clearAuth() {
      try {
        localStorage.removeItem(KEYS.auth);
        localStorage.removeItem(KEYS.session);
      } catch { }
    },
    getSession() {
      try { return JSON.parse(localStorage.getItem(KEYS.session)); } catch { return null; }
    },
    setSession(user) {
      try { localStorage.setItem(KEYS.session, JSON.stringify(user)); } catch { }
    },
  };

  /* ---------- Erro de API ---------- */
  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details || [];
    }
    // Mensagem do primeiro campo inválido, para exibir junto ao input.
    fieldError(field) {
      const found = this.details.find(d => d.field === field);
      return found ? found.message : null;
    }
  }

  let refreshing = null;   // evita várias renovações simultâneas

  async function refreshSession() {
    const auth = store.getAuth();
    if (!auth?.refreshToken) throw new ApiError('Sessão expirada.', 401, 'UNAUTHORIZED');
    if (!refreshing) {
      refreshing = request('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: auth.refreshToken },
        skipAuth: true,
        skipRefresh: true,
      }).then(data => {
        store.setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        store.setSession(data.user);
        return data;
      }).catch(err => {
        store.clearAuth();
        throw err;
      }).finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request(path, options = {}) {
    const { method = 'GET', body, query, skipAuth = false, skipRefresh = false, raw = false } = options;

    let url = `${CFG.API_BASE_URL}${path}`;
    if (query) {
      const params = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!skipAuth) {
      const auth = store.getAuth();
      if (auth?.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiError(
        'Não foi possível falar com o servidor. Verifique sua conexão ou se a API está no ar.',
        0, 'NETWORK_ERROR'
      );
    }

    // Token expirado: renova uma vez e repete a requisição original.
    if (response.status === 401 && !skipAuth && !skipRefresh && store.getAuth()?.refreshToken) {
      await refreshSession();
      return request(path, { ...options, skipRefresh: true });
    }

    if (raw) {
      if (!response.ok) throw new ApiError('Falha ao gerar o arquivo.', response.status, 'DOWNLOAD_ERROR');
      return response.blob();
    }

    if (response.status === 204) return null;

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('Resposta inválida do servidor.', response.status, 'INVALID_RESPONSE');
    }

    if (!response.ok || payload.success === false) {
      const error = payload.error || {};
      throw new ApiError(
        error.message || 'Erro inesperado.',
        response.status,
        error.code || 'UNKNOWN',
        error.details
      );
    }

    return payload.data;
  }

  /* ---------- API pública ---------- */
  const api = {
    ApiError,
    store,
    request,
    get:   (path, query)  => request(path, { method: 'GET', query }),
    post:  (path, body)   => request(path, { method: 'POST', body }),
    put:   (path, body)   => request(path, { method: 'PUT', body }),
    patch: (path, body)   => request(path, { method: 'PATCH', body }),
    del:   (path)         => request(path, { method: 'DELETE' }),

    isLogged: () => Boolean(store.getAuth()?.accessToken),
    session: () => store.getSession(),

    async login(email, password) {
      const data = await request('/auth/login', {
        method: 'POST', body: { email, password }, skipAuth: true,
      });
      store.setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      store.setSession(data.user);
      return data.user;
    },

    async register(payload) {
      const data = await request('/auth/register', {
        method: 'POST', body: payload, skipAuth: true,
      });
      store.setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      store.setSession(data.user);
      return data.user;
    },

    async logout() {
      const auth = store.getAuth();
      try {
        if (auth?.refreshToken) {
          await request('/auth/logout', {
            method: 'POST', body: { refreshToken: auth.refreshToken }, skipRefresh: true,
          });
        }
      } catch { /* encerrar a sessão local é o que importa */ }
      store.clearAuth();
    },

    // Downloads (CSV / relatório) preservando o header Authorization.
    async download(path, fallbackName) {
      const blob = await request(path, { raw: true });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    },
  };

  window.EvoAPI = api;
})();
