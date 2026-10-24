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

  var hasTokens = !!(auth && (auth.accessToken || auth.refreshToken));

  // Snapshot sem tokens é lixo (dado legado / storage parcial): descarta, senão a
  // home continuaria mostrando o avatar e o usuário ficaria preso num ciclo
  // avatar -> painel -> home, sem conseguir sair da conta.
  if (!hasTokens) {
    try { localStorage.removeItem('evo_session'); localStorage.removeItem('evo_auth'); } catch (e) { }
  }

  if (!hasTokens || !session || session.role !== 'admin') {
    window.location.replace('index.html');
  }
})();
