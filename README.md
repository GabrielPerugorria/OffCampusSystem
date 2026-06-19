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
HTML5
CSS3
JavaScript (ES6+)
LocalStorage
Google Fonts (Inter e Sora)
Sem Dependências

O projeto não utiliza:

React
Vue
Angular
Node.js
Bundlers
Frameworks CSS

Tudo foi desenvolvido utilizando tecnologias nativas da web.

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
│   ├── main.js          (lógica da landing page / área do participante)
│   ├── admin.js         (lógica do painel administrativo)
│   └── admin-guard.js   (verificação de sessão de admin, carregada antes do CSS)
│
└── imagens/
    ├── favicon.png
    ├── offcampushexa.png
    ├── resenhadoportes.png
    ├── halloween.png
    ├── brazil.svg
    └── brazil-wireframe.svg
🚀 Como Executar
Python
python -m http.server 8080
Node.js
npx serve .
VS Code

Utilize a extensão Live Server.

🔑 Contas de Demonstração
Perfil	E-mail	Senha
Administrador	admin@evotech.com	admin123
Participante	demo@evotech.com	demo123
💾 Persistência de Dados

Todos os dados são armazenados localmente através do LocalStorage.

Chave	Função
evo_users	Usuários cadastrados
evo_session	Sessão ativa
evotech_admin	Dados administrativos
⚠️ Limitações

Este projeto foi desenvolvido para demonstração e prototipação.

Atualmente não possui:

Backend
Banco de dados real
Autenticação segura
Integração com pagamentos
QR Code real
Sincronização entre dispositivos
🗺️ Roadmap
Próximas versões
 API REST
 Banco PostgreSQL
 Integração PIX
 Mercado Pago
 QR Code real
 Multiusuários
 Controle de permissões
 Aplicativo Mobile
 Dashboard em tempo real
🎯 Objetivo

Transformar o EvoTech Events em uma plataforma SaaS completa para gestão de eventos, festivais, festas universitárias, casas noturnas e produtoras de eventos.

📄 Licença

Projeto de uso interno e demonstração.
