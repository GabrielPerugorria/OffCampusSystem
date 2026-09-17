🚀 EvoTech Events — EvotechWeb 

Plataforma completa para gestão de eventos, ingressos, participantes, portaria, Open Bar e financeiro.

O EvoTech Events é uma solução desenvolvida pela EvoTechWeb para centralizar toda a operação de eventos em uma única plataforma. O sistema possui uma área pública para participantes e uma área administrativa para organizadores, permitindo acompanhar vendas, acessos, estoque e indicadores operacionais em tempo real.

✨ Principais Recursos
🎟️ Gestão de Ingressos
Venda de ingressos online
Controle de lotes
Emissão de ingressos digitais
Histórico de compras
Área do participante
📊 Dashboard Executivo
Eventos ativos
Receita total
Despesas
Saldo operacional
Entradas registradas
Ocupação por evento
🚪 Portaria
Check-in manual
Validação por código
Registro de entradas
Controle de capacidade
🍻 Open Bar
Controle de estoque
Alertas de reposição
Custos unitários
Indicadores de consumo
💰 Financeiro
Controle de despesas
Categorias financeiras
Relatórios operacionais
Exportação de dados
👥 Participantes
Cadastro de usuários
Gestão de participantes
Bloqueio e ativação
Histórico de presença
🏗️ Estrutura da Plataforma
Módulo	Arquivo	Descrição
Landing Page	index.html	Site institucional e venda de ingressos
Área do Participante	index.html	Perfil, histórico e ingressos
Painel Administrativo	admin.html	Gestão completa dos eventos
🛠️ Tecnologias

Frontend (estático, compatível com GitHub Pages)
HTML5
CSS3
JavaScript (ES6+)
Google Fonts (Inter e Sora)
Sem frameworks, sem bundlers

Backend (API REST)
Node.js + Express
MySQL 8 (mysql2)
JWT + bcrypt
zod (validação)
Helmet, CORS, rate limit

O frontend continua sem React, Vue, Angular ou bundlers.

📂 Estrutura do Projeto
OffCampusSystem/
│
├── index.html
├── admin.html
├── README.md
│
├── css/
│   ├── main.css        (estilos da landing page / área do participante)
│   └── admin.css       (estilos do painel administrativo)
│
├── js/
│   ├── config.js        (URL da API — único arquivo que muda entre ambientes)
│   ├── api.js           (cliente HTTP: token, renovação de sessão, erros)
│   ├── main.js          (lógica da landing page / área do participante)
│   ├── admin.js         (lógica do painel administrativo)
│   └── admin-guard.js   (verificação de sessão de admin, carregada antes do CSS)
│
├── backend/             (API Node.js + Express + MySQL — veja backend/README.md)
│
└── imagens/
    ├── favicon.png
    ├── offcampushexa.png
    ├── resenhadoportes.png
    ├── halloween.png
    ├── brazil.svg
    └── brazil-wireframe.svg
🚀 Como Executar

1) Suba a API (instruções completas em backend/README.md)

cd backend
npm install
cp .env.example .env     # preencha DB_* e os segredos
npm run db:setup
npm run db:seed
npm run dev              # API em http://localhost:3333/api

2) Sirva o frontend na raiz do projeto

Python
python -m http.server 8080
Node.js
npx serve .
VS Code

Utilize a extensão Live Server.

O arquivo js/config.js detecta o ambiente local automaticamente.
Para publicar no GitHub Pages, basta trocar a URL de produção nesse arquivo.

🔑 Contas de Demonstração
Perfil	E-mail	Senha
Administrador	admin@evotech.com	admin123
Participante	demo@evotech.com	demo123
💾 Persistência de Dados

Todos os dados ficam no MySQL, acessados exclusivamente pela API.
O navegador guarda apenas o necessário para a sessão:

Chave	Função
evo_auth	Access token + refresh token
evo_session	Snapshot do usuário logado (nome, e-mail, perfil)
evotech_ui	Preferências de tela (modo contingência, premissas de unit economics)

Nenhum dado de negócio é armazenado no navegador.
⚠️ Limitações atuais

Já implementado: backend, banco relacional, autenticação com hash e JWT,
controle de acesso por perfil e sincronização entre dispositivos.

Ainda pendente:

Integração com gateway de pagamento (PIX / Mercado Pago)
Leitura de QR Code pela câmera (o check-in por código digitado já funciona)
PDV de vendas do Open Bar (o controle de estoque já funciona)
Envio de e-mail na recuperação de senha
🗺️ Roadmap
Concluído
 API REST
 Banco MySQL
 Multiusuários
 Controle de permissões por perfil
 Dashboard sobre dados reais

Próximas versões
 Integração PIX
 Mercado Pago
 QR Code real (leitura pela câmera)
 PDV do Open Bar
 Aplicativo Mobile
🎯 Objetivo

Transformar o EvoTech Events em uma plataforma SaaS completa para gestão de eventos, festivais, festas universitárias, casas noturnas e produtoras de eventos.

📄 Licença

Projeto de uso interno e demonstração.
