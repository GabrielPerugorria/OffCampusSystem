# MANUAL DE CONTINUIDADE TÉCNICA E OPERACIONAL — EVOTECH EVENTS

**Versão da Plataforma:** 2.2.0-corporate  
**Última Atualização:** 12/11/2026  
**Ambiente Recomendado:** Node.js v20+, MySQL 8.0+ (Aiven Cloud)  
**Arquitetura Frontend:** HTML5, CSS3 Moderno, JavaScript ES6+ Puro (Sem dependência de React/Vite)  
**Arquitetura de Ícones:** Lucide Icons (CDN Oficial via UMD)  
**Arquitetura Backend:** Node.js, Express, mysql2 (Pool com Promises), Zod, Helmet, Rate Limiter  

---

## 1. INICIALIZAÇÃO DO AMBIENTE LOCAL E TESTES

### 1.1 Configuração do Backend
1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie o arquivo `.env` a partir de `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *Nota importante:* Mantenha `AUTO_CONFIRM_ORDERS=false` em produção (existe verificação fatal de boot caso tente subir com valor true).
4. Para iniciar o servidor de desenvolvimento:
   ```bash
   npm run dev
   # ou
   node src/server.js
   ```

### 1.2 Execução das Suítes de Testes Automatizados
O projeto conta com 8 suítes de testes automatizados com 100% de aprovação (214 testes no total):

```bash
# 1. Validação de Redesign Visual, CDN Lucide, Zero Emojis e Layout de Auth:
node tests/visual-redesign-lucide.test.js

# 2. Teste de Integridade Backend, Schemas e Cálculos:
node tests/backend-integrity.test.js

# 3. Teste de Segurança XSS e Sanitização de URLs:
node tests/xss-verification.js

# 4. Teste de Concorrência, Overbooking e Auditoria:
node tests/concurrency-and-security.test.js

# 5. Testes de Interface, Responsividade e Modais:
node tests/catalog-page.test.js
node tests/mobile-fixes.test.js
node tests/totem-carousel.test.js
node tests/responsive-check.js
```

---

## 2. ARQUITETURA DO BANCO DE DADOS E MIGRAÇÕES

### 2.1 Estado Atual e Regras do Banco Aiven
O banco de produção na nuvem Aiven (`evotech_events`) possui os dados cadastrais preservados:
- **1 organização**
- **4 usuários cadastrados**
- **1 vínculo em organization_members**
- **23 registros em refresh_tokens**
- **4 registros em audit_logs**

### 2.2 Sistema de Migrações Versionadas (`runMigrations.js`)
O script `backend/src/database/runMigrations.js` gerencia versões através da tabela `schema_migrations`:
- Registra cada migração aplicada (`version`, `applied_at`, `status`).
- Cada migração possui função `up()` e validação `verify()`.
- Idempotente: se já aplicada, não reexecuta.
- Interrompe a inicialização do servidor com erro explícito se alguma migração falhar (sem `.catch(() => {})` silencioso).

---

## 3. IDENTIDADE VISUAL & DESIGN SYSTEM

### 3.1 Biblioteca Lucide Icons
- Carregada via CDN: `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`.
- Invocada via `<i data-lucide="nome-do-icone"></i>` e `lucide.createIcons()`.
- Substituição total de emojis antigos em botões de ação (`pencil`, `trash-2`), empty states (`calendar-days`, `users`, `book-user`, `scan-line`), sidebar, topbar e modais (`x`).

### 3.2 Paleta Oficial e Tokens Globais
- **Fundo grafite:** `#101214`
- **Superfície principal:** `#191c20`
- **Superfície elevada:** `#23272b`
- **Verde principal:** `#20d96b`
- **Verde escuro:** `#16964e`
- **Texto:** `#f2f4f5`
- **Scrollbars personalizadas:** Fundo `#191c20` com indicador verde translúcido (`rgba(32, 217, 107, 0.28)`).

### 3.3 Títulos com Gradiente
Classe unificada `.section-heading`, `.evo-title-gradient`, `.topbar-title`, `.auth-title`:
`linear-gradient(135deg, #f2f4f5 60%, #c9ced1 100%)`.

### 3.4 Modais de Login e Cadastro (`.auth-panel`)
- Fundo translúcido com `backdrop-filter: blur(20px)` e borda sutil.
- Divisão assimétrica: lateral esquerda de identidade (`auth-brand`) e lateral direita com formulário (`auth-form-side`).
- Preservação estrita de todos os IDs de elementos usados pelo JavaScript.
- Scroll lock sem saltos de tela via `ModalScrollLock`.

---

## 4. RELAÇÃO DE ARQUIVOS PRINCIPAIS MODIFICADOS

| Arquivo | Natureza da Modificação |
|---|---|
| `admin.html` | Sidebar rail com Lucide icons, topbar com botões Lucide, remoção total de emojis e botões de fechamento de modal |
| `css/admin.css` | Dimensionamento Lucide, scrollbars, indicadores ativos e remoção de redundâncias responsivas |
| `js/admin.js` | Remoção integral de emojis, injeção de ícones Lucide nos renders dinâmicos e chamada de `refreshIcons()` |
| `index.html` | Redesign de Login e Cadastro (`auth-panel`), seção Plataforma com layout assimétrico, remoção de badges vazios e inclusão de CDN Lucide |
| `css/main.css` | Adição de estilos `.auth-panel`, `.evo-title-gradient`, layout assimétrico `.col-span-*` e scrollbars |
| `style.css` | Sincronizado integralmente com `css/main.css` |
| `js/main.js` | Substituição de emojis em renders de participante e compra por Lucide icons |
| `script.js` | Sincronizado integralmente com `js/main.js` |
| `eventos.html` | Inclusão de Lucide CDN, remoção de emojis em modais e breadcrumb com ícone vetorial |
| `css/catalog-events.css` | Padronização de gradiente oficial branco→verde no título |
| `backend/src/database/runMigrations.js` | Controle de versão de migrações e parada fatal em erros |
| `backend/src/services/orderService.js` | Job autônomo de expiração de reservas (60s) e bloqueio de confirmação de pedidos expirados |
| `backend/src/services/checkinService.js` | Transação com `FOR UPDATE` para prevenção de overbooking |
| `backend/src/middlewares/audit.js` | Sanitização recursiva de tokens Bearer e senhas |
| `backend/src/validators/schemas.js` | `updateMeSchema.strict()` contra mass assignment |
| `tests/visual-redesign-lucide.test.js` | Nova suíte de testes de validação visual e ícones (18 testes) |
| `AUDITORIA_FINAL_EVOTECH.md` | Relatório abrangente de auditoria técnica e segurança |
| `REDESIGN_VISUAL_EVOTECH.md` | Especificação completa do design system e reformulação de interfaces |

---

## 5. PONTOS DE ATENÇÃO PARA O PRÓXIMO ENGENHEIRO

1. **Sincronização de Arquivos Espelhados:** Sempre que alterar `css/main.css`, replique em `style.css`. Sempre que alterar `js/main.js`, replique em `script.js`.
2. **Novos Renders Dinâmicos:** Se adicionar uma nova função no JavaScript que injete HTML com tags `<i data-lucide="...">`, lembre-se de chamar `if (typeof lucide !== 'undefined') lucide.createIcons();` ao final.
3. **Novas Migrações:** Adicione novas migrações sequenciais em `backend/src/database/runMigrations.js` com seus respectivos métodos `up()` e `verify()`, sem reexecutar migrações passadas no banco Aiven.
4. **Sem Emojis Decorativos:** Manter a regra de não introduzir emojis como substitutos de ícones na interface. Utilizar sempre a biblioteca Lucide.
