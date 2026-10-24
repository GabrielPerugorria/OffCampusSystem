# Teste E2E de sessão (login, avatar, painel, logout) com API simulada.
# Uso: sirva a pasta (python3 -m http.server 8080) e rode: python3 tests/e2e_sessao.py [http://localhost:8080]
# Requer: pip install playwright && playwright install chromium
import json, sys, itertools
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
USERS = {
  "part":  {"id":2,"nome":"João Cardoso","email":"demo@evotech.com","role":"participante","orgRole":None},
  "owner": {"id":1,"nome":"Admin Evo","email":"admin@evotech.com","role":"admin","orgRole":"owner"},
  "gate":  {"id":3,"nome":"Diego Portaria","email":"diego@evotech.com","role":"admin","orgRole":"gate"},
}
PASS = {"demo@evotech.com":("demo123","part"),"admin@evotech.com":("admin123","owner"),"diego@evotech.com":("diego123","gate")}
results=[]
def check(name, cond, extra=""):
    results.append((name, bool(cond))); print(("  ✔ " if cond else "  ✘ ")+name+(f"  [{extra}]" if (extra and not cond) else ""))

class Server:
    """Imita o backend: access tokens que expiram, refresh com rotação e revogação."""
    def __init__(s): s.n=itertools.count(1); s.access={}; s.refresh={}; s.calls=[]; s.logouts=0
    def issue(s,key):
        a=f"acc{next(s.n)}"; r=f"ref{next(s.n)}"; s.access[a]=key; s.refresh[r]=key; return a,r
    def handle(s, route):
        req=route.request; path=req.url.split("/api",1)[1].split("?")[0]; s.calls.append((req.method,path))
        def ok(d,st=200): route.fulfill(status=st,content_type="application/json",body=json.dumps({"success":True,"data":d}))
        def err(st,code,msg): route.fulfill(status=st,content_type="application/json",body=json.dumps({"success":False,"error":{"code":code,"message":msg}}))
        body = json.loads(req.post_data) if req.post_data else {}
        if path=="/auth/login":
            pw,key=PASS.get(body.get("email"),(None,None))
            if body.get("password")!=pw: return err(401,"UNAUTHORIZED","E-mail ou senha incorretos.")
            a,r=s.issue(key); return ok({"accessToken":a,"refreshToken":r,"user":USERS[key]})
        if path=="/auth/refresh":
            key=s.refresh.pop(body.get("refreshToken"),None)   # rotação: token usado é revogado
            if not key: return err(401,"UNAUTHORIZED","Sessão expirada. Faça login novamente.")
            a,r=s.issue(key); return ok({"accessToken":a,"refreshToken":r,"user":USERS[key]})
        if path=="/auth/logout":
            s.logouts+=1; s.refresh.pop(body.get("refreshToken"),None); return ok({"message":"ok"})
        if path.startswith("/public"): return ok([])
        tok=(req.headers.get("authorization") or "").replace("Bearer ","")
        key=s.access.get(tok)
        if not key: return err(401,"UNAUTHORIZED","Sessão expirada.")
        if path=="/expenses" and USERS[key]["orgRole"] not in("owner","admin","finance"): return err(403,"FORBIDDEN","Seu perfil não permite esta ação.")
        if path=="/checkins": return ok({"rows":[]})
        return ok([])

def new_page(b, srv, mobile=False):
    ctx=b.new_context(viewport={"width":390,"height":800} if mobile else {"width":1280,"height":800})
    pg=ctx.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.route("**/localhost:3333/api/**",srv.handle)
    pg.route(lambda u:"localhost" not in u and "127.0.0.1" not in u,lambda r:r.abort())
    pg.errs=errs; return pg
def ls(pg,k): return pg.evaluate("k=>localStorage.getItem(k)",k)
def seed(pg, srv, key, expire_access=False):
    a,r=srv.issue(key)
    if expire_access: srv.access.pop(a)
    pg.goto(BASE+"/index.html?intro=off")
    pg.evaluate("([a,r,u])=>{localStorage.setItem('evo_auth',JSON.stringify({accessToken:a,refreshToken:r}));localStorage.setItem('evo_session',JSON.stringify(u));}",[a,r,USERS[key]])
    pg.reload(); pg.wait_for_timeout(500)
def form_login(pg,email,pw):
    pg.click("#btnEntrar"); pg.fill("#loginEmail",email); pg.fill("#loginSenha",pw); pg.click("#btnLoginSubmit"); pg.wait_for_timeout(1200)
def panel_ok(pg): return "admin.html" in pg.url and pg.locator("#admin-name").inner_text()!="" 

with sync_playwright() as p:
    b=p.chromium.launch()

    print("1) Participante: login → avatar → painel → Sair (modal)")
    srv=Server(); pg=new_page(b,srv); pg.goto(BASE+"/index.html?intro=off")
    form_login(pg,"demo@evotech.com","demo123")
    check("login fecha modal e mostra avatar", pg.locator("#navAvatarBtn").count()==1 and not pg.locator("#modalParticipante").is_visible())
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(500)
    check("avatar abre a área do participante (sem recarregar)", pg.locator("#modalParticipante").is_visible() and "index.html" in pg.url)
    pg.click("#btnLogout"); pg.wait_for_timeout(700)
    check("Sair do modal: volta para Entrar/Cadastrar", pg.locator("#btnEntrar").count()==1 and pg.locator("#navAvatarBtn").count()==0)
    check("Sair limpa tokens e sessão", ls(pg,"evo_auth") is None and ls(pg,"evo_session") is None)
    check("Sair revogou o refresh token no servidor", srv.logouts==1)

    print("2) Participante: botão Sair da barra")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"part")
    check("barra mostra avatar + Sair", pg.locator("#navAvatarBtn").count()==1 and pg.locator("#btnSairNav").count()==1)
    pg.click("#btnSairNav"); pg.wait_for_timeout(600)
    check("Sair da barra encerra a sessão", pg.locator("#btnEntrar").count()==1 and ls(pg,"evo_auth") is None and srv.logouts==1)

    print("3) Admin (owner): login → painel → Sair")
    srv=Server(); pg=new_page(b,srv); pg.goto(BASE+"/index.html?intro=off")
    form_login(pg,"admin@evotech.com","admin123"); pg.wait_for_timeout(600)
    check("login de admin abre o painel", panel_ok(pg), pg.url)
    pg.click("text=↩ Sair"); pg.wait_for_timeout(900)
    check("Sair do painel volta à home deslogado", "index.html" in pg.url and ls(pg,"evo_auth") is None and ls(pg,"evo_session") is None)
    check("home mostra Entrar após sair", pg.locator("#btnEntrar").count()==1)

    print("4) Admin já logado: avatar na home → painel abre (sem 'refresh')")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"owner")
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(1200)
    check("avatar leva ao painel e ele permanece aberto", panel_ok(pg), pg.url)
    check("painel carregou dados da API", ("GET","/participants") in srv.calls)
    check("sem erros de JS", not pg.errs, pg.errs)

    print("5) Admin na home: botão Sair da barra")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"owner")
    pg.click("#btnSairNav"); pg.wait_for_timeout(600)
    check("admin consegue sair direto da home", pg.locator("#btnEntrar").count()==1 and ls(pg,"evo_auth") is None)

    print("6) BUG ORIGINAL: sessão de admin órfã (sem tokens)")
    srv=Server(); pg=new_page(b,srv); pg.goto(BASE+"/index.html?intro=off")
    pg.evaluate("u=>localStorage.setItem('evo_session',JSON.stringify(u))",USERS["owner"]); pg.reload(); pg.wait_for_timeout(500)
    check("home NÃO mostra avatar fantasma", pg.locator("#navAvatarBtn").count()==0 and pg.locator("#btnEntrar").count()==1)
    check("snapshot órfão é descartado", ls(pg,"evo_session") is None)
    form_login(pg,"admin@evotech.com","admin123"); pg.wait_for_timeout(500)
    check("login normal funciona depois disso", panel_ok(pg), pg.url)

    print("6b) Acessar admin.html direto com sessão órfã")
    srv=Server(); pg=new_page(b,srv); pg.goto(BASE+"/index.html?intro=off")
    pg.evaluate("u=>localStorage.setItem('evo_session',JSON.stringify(u))",USERS["owner"])
    pg.goto(BASE+"/admin.html"); pg.wait_for_timeout(600)
    check("guard redireciona e limpa o lixo", "index.html" in pg.url and ls(pg,"evo_session") is None)

    print("7) Operador de portaria (403 em /expenses)")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"gate")
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(1500)
    check("painel abre mesmo com 403 em /expenses", panel_ok(pg), pg.url)
    check("sessão NÃO foi derrubada", ls(pg,"evo_auth") is not None)
    pg.click("text=↩ Sair"); pg.wait_for_timeout(800)
    check("e consegue sair", "index.html" in pg.url and ls(pg,"evo_auth") is None)

    print("8) Access token expirado + refresh válido")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"owner",expire_access=True)
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(1500)
    check("painel abre após renovar o token", panel_ok(pg), pg.url)
    check("houve refresh", ("POST","/auth/refresh") in srv.calls)
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"part",expire_access=True)
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(1000)
    check("participante com token expirado abre a área", pg.locator("#modalParticipante").is_visible())

    print("9) Refresh token revogado/expirado (sessão morta)")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"part",expire_access=True); srv.refresh.clear()
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(1200)
    check("pede login de novo com aviso", pg.locator("#modalLogin").is_visible() and "expirou" in pg.locator("#loginSenha-error").inner_text())
    check("barra volta para Entrar", pg.locator("#btnEntrar").count()==1 and pg.locator("#navAvatarBtn").count()==0)
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"owner",expire_access=True); srv.refresh.clear()
    pg.click("#navAvatarBtn"); pg.wait_for_timeout(1500)
    check("admin com sessão morta cai na home deslogado (sem loop)", "index.html" in pg.url and pg.locator("#btnEntrar").count()==1)

    print("10) Login com senha errada")
    srv=Server(); pg=new_page(b,srv); pg.goto(BASE+"/index.html?intro=off"); form_login(pg,"demo@evotech.com","errada")
    check("mostra erro e continua deslogado", "incorretos" in pg.locator("#loginSenha-error").inner_text() and pg.locator("#navAvatarBtn").count()==0)

    print("11) Mobile")
    srv=Server(); pg=new_page(b,srv,mobile=True); seed(pg,srv,"owner")
    pg.click("#hamburger"); pg.wait_for_timeout(400)
    check("menu mobile mostra Painel + Sair (não 'Entrar')", pg.locator("#btnContaMobile").is_visible() and pg.locator("#btnSairMobile").is_visible() and pg.locator("#btnEntrarMobile").count()==0)
    pg.click("#btnSairMobile"); pg.wait_for_timeout(600)
    check("Sair no mobile funciona", ls(pg,"evo_auth") is None)
    pg.click("#hamburger"); pg.wait_for_timeout(400)
    check("deslogado: menu mobile volta a Entrar/Cadastrar", pg.locator("#btnEntrarMobile").is_visible() and pg.locator("#btnCadastroMobile").is_visible())
    pg.click("#btnEntrarMobile"); pg.wait_for_timeout(500)
    check("Entrar mobile abre o modal de login", pg.locator("#modalLogin").is_visible())
    srv=Server(); pg=new_page(b,srv,mobile=True); seed(pg,srv,"part")
    pg.click("#hamburger"); pg.wait_for_timeout(400); pg.click("#btnContaMobile"); pg.wait_for_timeout(600)
    check("'Minha conta' (mobile) abre a área do participante", pg.locator("#modalParticipante").is_visible())

    print("12) Regressão — deslogado e atalhos")
    srv=Server(); pg=new_page(b,srv); pg.goto(BASE+"/index.html?intro=off"); pg.wait_for_timeout(300)
    pg.click("#btnCadastro"); pg.wait_for_timeout(500)
    check("Cadastrar abre o modal de cadastro", pg.locator("#modalCadastro").is_visible())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    pg.click("#btnEntrar"); pg.wait_for_timeout(400); pg.click("#linkDemoParticipante"); pg.wait_for_timeout(1200)
    check("atalho demo (participante) loga", pg.locator("#navAvatarBtn").count()==1)
    # teclado no avatar
    pg.focus("#navAvatarBtn"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    check("avatar responde a Enter", pg.locator("#modalParticipante").is_visible())
    check("sem erros de JS na home", not pg.errs, pg.errs)

    print("13) Logout em outra aba reflete nesta")
    srv=Server(); pg=new_page(b,srv); seed(pg,srv,"part")
    pg2=pg.context.new_page(); pg2.route("**/localhost:3333/api/**",srv.handle); pg2.route(lambda u:"localhost" not in u,lambda r:r.abort())
    pg2.goto(BASE+"/index.html?intro=off"); pg2.wait_for_timeout(400); pg2.click("#btnSairNav"); pg2.wait_for_timeout(600)
    pg.wait_for_timeout(500)
    check("aba original volta para Entrar", pg.locator("#btnEntrar").count()==1)
    b.close()

bad=[n for n,ok in results if not ok]
print(f"\n{len(results)-len(bad)}/{len(results)} verificações OK"); 
if bad: print("FALHARAM:",bad); sys.exit(1)
