    // Guarda de sessão: só administradores autenticados acessam este painel.
    (function () {
      var session = null;
      try { session = JSON.parse(localStorage.getItem('evo_session')); } catch (e) {}
      if (!session || session.role !== 'admin') {
        window.location.replace('index.html');
      }
    })();
