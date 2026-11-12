# Captura telas REAIS do admin, alimentadas com os dados de demonstração do próprio seed.js
import json, subprocess, time, sys
from playwright.sync_api import sync_playwright

EVENTS = [
 dict(id=1,name='OFFCampus na Copa',type='Experiência Premium',eventDate='2026-12-31T22:00:00',venue='Curitiba, PR',capacity=380,status='upcoming',description='',rules='',goalAttendance=340,goalRevenue=60000,
  batches=[('Lote Promocional',49.90,100,50),('1º Lote',79.90,300,100),('VIP',149.90,50,20),('Open Bar',199.90,30,10)]),
 dict(id=2,name='Resenha do Portes',type='Festival Eletrônico',eventDate='2026-11-15T23:00:00',venue='Curitiba, PR',capacity=470,status='active',description='',rules='',goalAttendance=420,goalRevenue=45000,
  batches=[('1º Lote',69.90,250,100),('2º Lote',99.90,200,100),('Camarote',179.90,20,5)]),
 dict(id=3,name='Halloween OffCampus',type='Ambiente VIP',eventDate='2026-10-31T22:00:00',venue='Curitiba, PR',capacity=610,status='active',description='',rules='',goalAttendance=550,goalRevenue=52000,
  batches=[('Lote Estudante',39.90,150,70),('1º Lote',59.90,400,200),('VIP + Open Food',129.90,60,20)]),
]
bid=0
for e in EVENTS:
    out=[]
    for n,p,t,s in e['batches']:
        bid+=1; out.append(dict(id=bid,name=n,price=p,quantityTotal=t,available=t-s))
    e['batches']=out
PRODUCTS=[('Cerveja Long Neck','🍺','Cerveja',4.5,240,40),('Vodka 1L','🥃','Destilado',28,42,10),('Gin Tônica Kit','🍹','Destilado',22,55,10),
 ('Energético 473ml','⚡','Energético',8,18,20),('Refrigerante 2L','🥤','Refrigerante',6,90,15),('Água 500ml','💧','Água',1.5,200,50)]
PRODUCTS=[dict(id=i+1,name=a,emoji=b,category=c,unitCost=d,stockQuantity=e,minStock=f) for i,(a,b,c,d,e,f) in enumerate(PRODUCTS)]
EXP=[('Segurança','🛡️','Equipe de segurança para 3 eventos',42000),('Marketing','📣','Redes sociais + panfletos',28000),('Bebidas','🍺','Estoque para Open Bar',38000),
 ('Estrutura','🏗️','Palco, som, iluminação',26000),('DJs/Atrações','🎤','Line-up confirmado',49000)]
EXP=[dict(id=i+1,category_id=i+1,category_name=a,category_icon=b,description=c,amount=d,event_id=None) for i,(a,b,c,d) in enumerate(EXP)]
NAMES=['Ana Lima','Pedro Souza','Maria Santos','Lucas Oliveira','Julia Pereira','Rafael Costa','Camila Almeida','Bruno Ribeiro']
CHECK=[dict(id=i+1,guest_name=n,code=f'RDP-1S{i:02d}K',event_name='Resenha do Portes',checked_in_at=f'2026-11-15T23:{10+i*4:02d}:00') for i,n in enumerate(NAMES)]

def route(r):
    u=r.request.url.split('/api')[1].split('?')[0]
    d={'/events':EVENTS,'/products':PRODUCTS,'/expenses':EXP,'/checkins':dict(rows=CHECK,total=len(CHECK)),'/participants':[],'/contacts':[],'/team':[],'/audit-logs':[]}.get(u,[])
    r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(dict(success=True,data=d)))

srv=subprocess.Popen(['python3','-m','http.server','8123','--directory','/home/claude/OffCampusSystem'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b=p.chromium.launch()
        shots=[('dash',1100,688,'dashboard'),('gate',900,625,'portaria'),('bar',340,736,'bar')]
        for name,w,h,panel in shots:
            ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2)
            ctx.add_init_script("localStorage.setItem('evo_auth',JSON.stringify({accessToken:'x',refreshToken:'y'}));localStorage.setItem('evo_session',JSON.stringify({role:'admin',nome:'Admin EvoTech',name:'Admin EvoTech',email:'admin@evotech.com'}));")
            pg=ctx.new_page(); pg.on('console',lambda m: print('  [console]',m.type,m.text[:140]) if m.type in('error',) else None); pg.on('pageerror',lambda e: print('  [pageerror]',str(e)[:200]))
            pg.route('**/localhost:3333/api/**',route)
            pg.goto('http://localhost:8123/admin.html'); pg.wait_for_timeout(2500)
            if panel!='dashboard':
                pg.evaluate(f"goPanel('{panel}')"); pg.wait_for_timeout(1200)
            if name=='dash':
                pg.evaluate("(()=>{const el=[...document.querySelectorAll('.section-label')].find(e=>/Desempenho/.test(e.textContent)); if(el){const m=document.querySelector('.main, main, .content')||document.scrollingElement; el.scrollIntoView({block:'start'}); let p=el.parentElement; while(p&&p!==document.body){ if(p.scrollHeight>p.clientHeight+5 && getComputedStyle(p).overflowY!=='visible'){p.scrollTop-=90;break;} p=p.parentElement;} window.scrollBy(0,-90);}})()"); pg.wait_for_timeout(600)
            pg.screenshot(path=f'/home/claude/capture/{name}.png')
            print(name,'ok',pg.url)
            ctx.close()
        b.close()
finally:
    srv.terminate()
