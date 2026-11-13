# EVO TECH EVENTS — DOCUMENTO OFICIAL DE REDESIGN VISUAL & IDENTIDADE

**Data:** Novembro de 2026  
**Status:** Identidade visual atualizada
**Padrão:** SaaS Corporativo, Editorial & Tecnológico (Design System EvoTech)

---

## 1. VISÃO GERAL DO REDESIGN

O projeto **EvoTech Events** passou por uma reformulação visual completa e estruturada, superando layouts genéricos de templates pré-fabricados e estabelecendo uma identidade corporativa própria, profissional e robusta para operação com clientes reais.

As intervenções contemplaram:
1. Adoção integral da biblioteca **Lucide Icons** como biblioteca vetorial oficial em substituição definitiva a emojis em botões, tabelas, modais, alertas e cards.
2. Padronização global em grafite, cinza-cimento e preto, com verde moderado reservado a ações, indicadores e estados.
3. Títulos em branco/cinza, sem o gradiente verde anterior.
4. Remoção rigorosa de badges, tags e balões decorativos vazios (`.mod-badge`, `.evo-chip`, `.cinema-top-badge`, `.dif-tag`).
5. Redesign da Home com composição assimétrica editorial, eliminando grids uniformes de "cards de IA".
6. Novo design dos modais de **Login** e **Registro** com painel flutuante, divisão assimétrica e integração nativa com o tema escuro.
7. Preservação integral de todas as integrações com backend, IDs de formulário, fluxos de autenticação e proteção matemática contra erros.

---

## 2. BIBLIOTECA OFICIAL DE ÍCONES — LUCIDE

- **CDN Oficial:** `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`
- **Inicialização Dinâmica:** Invocação de `lucide.createIcons()` na carga do documento e em todas as renderizações assíncronas do DOM (`renderAll()`, `renderEventos()`, `renderBar()`, `renderContatos()`, `renderParticipantes()`, `renderAlertasCentral()`, `renderComparativo()`).
- **Estilo:** Traçado vetorial outline limpo, stroke padronizado entre 1.8px e 2px.

### Mapeamento dos Ícones Implementados

| Módulo / Ação | Ícone Lucide | Aplicação |
|---|---|---|
| Dashboard Geral | `layout-dashboard` | Sidebar, cards de visão geral e títulos |
| Gestão de Eventos | `calendar-days` / `calendar` | Sidebar, tabelas de eventos, meta info |
| Pedidos & Ingressos | `shopping-bag` / `ticket` | Sidebar, compras, emissão e listagem de ingressos |
| Portaria & Check-in | `scan-line` | Sidebar, leitor de QR Code, histórico de entradas |
| Estoque & Open Bar | `package` | Sidebar, cartões operacionais, alertas de estoque |
| Financeiro | `wallet` | Sidebar, receitas, despesas, métricas de ROI |
| Pessoas & Participantes | `users` | Sidebar, participantes, métricas de público |
| Contatos & Fornecedores | `book-user` / `mail` / `phone` | Sidebar e cards de fornecedores/artistas |
| Governança & Auditoria | `shield-check` | Sidebar e painel de logs de segurança |
| Sistema & Configurações | `settings` / `radio` | Sidebar e status de contingência |
| Equipe & Permissões | `users-round` / `check` | Sidebar e matriz de permissões |
| Metas & ROI | `target` | Sidebar e alertas de faturamento |
| Comparativo & IA | `bar-chart-3` / `brain-circuit` | Sidebar e caixas de insights comparativos |
| Ações de Edição | `pencil` | Botões de ação em tabelas (eventos, despesas, equipe) |
| Ações de Exclusão | `trash-2` | Botões de exclusão de registros |
| Fechamento de Modais | `x` | Botão superior direito de todos os modais |
| Alertas e Avisos | `triangle-alert` / `alert-octagon` | Central de alertas operacionais e validações |

---

## 3. PALETA DE CORES GLOBAL & DESIGN TOKENS

Consistência em `css/main.css`, `style.css` e `css/admin.css`:

```css
:root {
  --background: #101214;      /* Fundo grafite escuro */
  --surface: #191c20;         /* Superfícies principais */
  --surface-2: #23272b;       /* Superfícies elevadas */
  --primary: #20d96b;         /* Verde vivo para ações e estados */
  --primary-dark: #16964e;    /* Hover e contraste */
  --secondary: #83f2a7;       /* Realce claro */
  --text: #f2f4f5;            /* Texto principal */
  --muted: #b0b6bb;           /* Texto de apoio */
  --border: rgba(220, 226, 230, 0.11); /* Divisórias neutras */
}
```

O `body::before` aplica um halo branco radial de baixa opacidade no canto superior direito, em uma camada absoluta que acompanha toda a altura da página, sem restringir o efeito a uma seção.

### Scrollbars Personalizadas
Padronizadas em todos os navegadores Chromium e Firefox:
- Trilho grafite (`#191c20`)
- Indicador fino (7px) com verde translúcido
- Hover discreto em verde
- Preservação da posição de rolagem via `ModalScrollLock` sem pulos ou redefinições indesejadas de scroll.

---

## 4. PADRONIZAÇÃO DOS TÍTULOS

Componente e classe global reutilizável, usando branco/cinza:
```css
.section-heading,
.evo-title-gradient,
.topbar-title,
.auth-title {
  font-family: 'Sora', sans-serif;
  font-weight: 800;
  background: linear-gradient(135deg, #f2f4f5 60%, #c9ced1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}
```

Aplicado de forma uniforme em:
- Cabeçalhos de seção da Home (`.section-heading`)
- Catálogo de Eventos (`.catalog-header .text-gradient`)
- Topbar do Painel Administrativo (`.topbar-title`)
- Títulos de modais de Login e Cadastro (`.auth-title`)
- Painéis de governança, finanças e auditoria.

---

## 5. REMOÇÃO DE BADGES E ELEMENTOS DECORATIVOS VAZIOS

Varredura e remoção global dos seguintes elementos não funcionais:
- `<span class="mod-badge">Acesso completo</span>`, `Finanças`, `Operação`, `Acesso`
- `<span class="evo-chip reveal">✦ Evo Intelligence</span>`
- `<span class="cinema-top-badge">Próximo</span>`, `Eletrônico`, `Destaque`
- `<div class="dif-tag">Destaque</div>`

**Preservados estritamente os badges funcionais de estado real:**
- Status de pedidos (`paid`, `pending`, `cancelled`)
- Status de eventos (`ativo`, `em_breve`, `esgotado`, `encerrado`)
- Status de participantes (`Ativo`, `Bloqueado`)

---

## 6. REFORMULAÇÃO DA HOME & COMPOSIÇÃO ASSIMÉTRICA

A seção **Plataforma** foi reestruturada para romper a repetição de cartões homogêneos:
- **Dashboard Executivo & Painel Unificado:** Bloco prioritário com proporção de 8 colunas (`col-span-8`) com descrição técnica detalhada.
- **Controle Financeiro:** Bloco complementar de 4 colunas (`col-span-4`).
- **Ingressos, Participantes e Portaria:** Bloco intermediário triplo balanceado (`col-span-4` cada).
- **Estoque & Open Bar em Tempo Real:** Bloco horizontal contínuo (`col-span-12`) com ícone Lucide integrado e ênfase no monitoramento contra perdas.

---

## 7. NOVO LAYOUT DE LOGIN E REGISTRO (`.auth-panel`)

Substituição da estrutura de caixa genérica flutuante por uma experiência corporativa dedicada:
- **Painel Flutuante Translúcido:** Backdrop filter (`blur(20px)`), fundo grafite e borda sutil com realce verde.
- **Divisão Assimétrica:**
  - **Lado Esquerdo (`auth-brand`):** Logotipo vetorial em alta definição, slogan tipográfico e destaques de segurança e operação em tempo real com ícones Lucide.
  - **Lado Direito (`auth-form-side`):** Título com gradiente oficial, campos com foco verde estilizado, validação em linha e ícones embutidos.
- **Responsividade Móvel:** Em telas menores que 768px, adapta-se verticalmente ocultando ornamentos e priorizando os campos de entrada.

---

## 8. TESTES EXECUTADOS E RESULTADOS

Suítes executadas após a atualização visual e de dependências:

| Suíte de Testes | Objetivo | Status |
|---|---|---|
| `tests/visual-redesign-lucide.test.js` | Validação de CDN Lucide, zero emojis, paleta grafite, layout assimétrico e integridade de IDs de auth | **18/18 PASSOU** |
| `tests/concurrency-and-security.test.js` | Sanitização de logs, prevenção de overbooking com reservas e travas de perfil | **4/4 PASSOU** |
| `tests/backend-integrity.test.js` | Schemas Zod, cálculos de ROI/margem/take-rate e travas de produção | **5/5 PASSOU** |
| `tests/xss-verification.js` | Testes de escape HTML, injeções XSS e higienização de URLs | **71/71 PASSOU** |
| `tests/catalog-page.test.js` | Funcionalidade e componentes da página independente de catálogo | **37/37 PASSOU** |
| `tests/mobile-fixes.test.js` | Comportamentos mobile, viewport e travas de inputs | **24/24 PASSOU** |
| `tests/totem-carousel.test.js` | Funcionamento do carrossel de eventos | **30/30 PASSOU** |
| `tests/intro-splash.test.js` | Inicialização, saída, falhas e ausência de cópias órfãs do splash | **19/19 PASSOU** |
| `tests/responsive-check.js` | Responsividade e integridade do header | **25/25 PASSOU** |
| `npm audit --prefix backend` | Dependências do backend | **0 vulnerabilidades** |
| **Total de verificações automatizadas** | **9 suítes funcionais** | **233/233 PASSOU** |

`tests/empty-org-lifecycle.test.js` depende de `DB_HOST` e de uma base de dados configurada; não foi possível executá-lo neste ambiente.
