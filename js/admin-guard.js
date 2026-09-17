// Guarda de sessão do painel: evita exibir a tela para quem não está logado.
// IMPORTANTE: isto é apenas conveniência de interface. A autorização real
// acontece no servidor — cada requisição é validada contra o JWT e o vínculo
// do usuário com a organização. Forjar este objeto no navegador não dá
// acesso a nenhum dado da API.
(function () {
  var session = null;
  var auth = null;
  try { session = JSON.parse(localStorage.getItem('evo_session')); } catch (e) { }
  try { auth = JSON.parse(localStorage.getItem('evo_auth')); } catch (e) { }

  if (!auth || !auth.accessToken || !session || session.role !== 'admin') {
    window.location.replace('index.html');
  }
})();
