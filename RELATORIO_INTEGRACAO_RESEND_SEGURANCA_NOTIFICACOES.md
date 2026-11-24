# RELATÓRIO DE INTEGRAÇÃO: RESEND, AUTENTICAÇÃO, SEGURANÇA E NOTIFICAÇÕES — EVOTECH EVENTS

## 1. Diagnóstico Inicial

A auditoria técnica realizada no repositório `OffCampusSystem` identificou que a infraestrutura base de e-mails (SDK `resend ^6.39.0`, `emailService.js`, `notificationOutboxService.js`, `notificationProcessor.js`, `notificationScheduler.js`, `webhookController.js` e `inAppNotificationService.js`) já possuía estrutura inicial, porém apresentava lacunas críticas de segurança, integridade e integração ponta a ponta:

1. **Ambiente local sem `.env` configurado**: O arquivo `backend/.env` não existe no workspace local (apenas `backend/.env.example`), mantendo `RESEND_API_KEY` e `RESEND_WEBHOOK_SECRET` vazios e `EMAIL_FROM` no remetente sandbox padrão (`EvoTech Events <onboarding@resend.dev>`).
2. **Cadastro sem confirmação de e-mail**: `authService.register()` criava contas já ativas e emitia `accessToken` e `refreshToken` imediatamente, sem envio nem validação de código de 6 dígitos.
3. **Login de participantes sem verificação por código**: Apenas contas `admin` passavam por desafio 2FA em `authService.login()`; participantes comuns recebiam tokens diretamente.
4. **Mascaramento de falhas de envio no Resend**: `authService.login()` e `authService.resendAdminCode()` capturavam erros com `.catch()` e ignoravam `{ success: false }` retornado por `sendImmediateTransactional()`, informando ao usuário que o código havia sido enviado mesmo quando o Resend falhava ou estava sem chave.
5. **Reenvio de código com colisão de `UNIQUE KEY`**: `resendAdminCode()` tentava inserir uma nova linha em `admin_login_codes` reutilizando o mesmo `challenge_token`, o que violaria a constraint `UNIQUE KEY uq_admin_challenge` no MySQL.
6. **Falta de fluxos de segurança no perfil**: O frontend (`index.html` / `js/main.js`) não possuía interface para alteração de senha autenticada, alteração segura de e-mail com confirmação por código, edição de avatar ou revogação manual de sessões. Além disso, `resetPassword` e `updateMe` não revogavam Access Tokens JWT já emitidos.
7. **Isolamento multi-tenant parcial em notificações internas**: `inAppNotificationService.js` filtrava `WHERE (organization_id = ? OR organization_id IS NULL)` para qualquer organização, permitindo que administradores de uma organização visualizassem eventos globais (`organization_id IS NULL`).
8. **Filtros e paginação incompletos no painel admin**: A central de notificações em `admin.html` / `js/admin.js` não possuía filtro por gravidade (`info`, `warning`, `critical`) nem paginação.

---

## 2. Problemas Encontrados

| Área | Problema Identificado | Impacto | Correção Aplicada |
| :--- | :--- | :--- | :--- |
| Cadastro | Emissão imediata de JWT sem verificar e-mail | Contas com e-mails inválidos ou de terceiros podiam acessar | Fluxo obrigatório de código de 6 dígitos (`email_verification_codes`) antes de emitir tokens |
| Login | Participantes sem código de verificação por e-mail | Menor proteção contra credenciais vazadas | Desafio de 6 dígitos unificado para participantes e admins + detecção de novo IP |
| Resend / Outbox | `authService` ignorava falha de envio e mentia sucesso | Usuário ficava aguardando código que nunca foi enviado | Propagação de `emailDeliveryFailed` no desafio inicial e HTTP `503` no reenvio; alerta `operation` na central |
| Banco / Reenvio | `INSERT` duplicado de `challenge_token` no reenvio | Erro `ER_DUP_ENTRY` no MySQL ao reenviar código | Atualização (`UPDATE`) do registro de desafio existente preservando `challenge_token` |
| Sessões JWT | Troca/redefinição de senha não invalidava JWTs ativos | Access Tokens antigos permaneciam válidos até expirar | Coluna `users.tokens_valid_after` validada contra `payload.iat` em `middlewares/auth.js` |
| Perfil / Conta | Sem troca de e-mail, senha autenticada ou revogação | Usuários não conseguiam gerenciar segurança da conta | Endpoints e UI completos para senha, e-mail (código no novo + alerta nos dois) e sessões |
| Multi-tenant | `organization_id IS NULL` exposto a todas as orgs | Vazamento de eventos globais para admins de tenants | Isolamento estrito `organization_id = ?`; `includeSystem` restrito a `platform_admin` |
| Painel Admin | Ausência de filtro de gravidade e paginação | Dificuldade de triagem de alertas críticos | Seletor de gravidade e controles de paginação integrados à API |

---

## 3. Arquivos Modificados e Criados

### Backend
- `backend/src/database/migrations/010_security_email_verification_and_profile.sql` *(novo)*
- `backend/src/database/runMigrations.js` *(adicionada migration `20261124_010`)*
- `backend/src/middlewares/auth.js` *(validação de `tokens_valid_after`)*
- `backend/src/services/emailTemplates/emailVerificationTemplate.js` *(novo)*
- `backend/src/services/emailTemplates/loginCodeTemplate.js` *(novo)*
- `backend/src/services/emailTemplates/emailChangeCodeTemplate.js` *(novo)*
- `backend/src/services/emailTemplates/securityAlertTemplate.js` *(novo)*
- `backend/src/services/emailService.js` *(helpers dos novos templates e `getConfigStatus()`)*
- `backend/src/services/notificationOutboxService.js` *(alerta `operation` e propagação de `simulated`/`error` em `sendImmediateTransactional`)*
- `backend/src/services/inAppNotificationService.js` *(isolamento multi-tenant estrito)*
- `backend/src/controllers/notificationController.js` *(passagem de `includeSystem` apenas para `platform_admin`)*
- `backend/src/validators/schemas.js` *(schemas de verificação, troca de senha, troca de e-mail, revogação e perfil)*
- `backend/src/routes/authRoutes.js` *(novas rotas de verificação, login, senha, e-mail e sessões)*
- `backend/src/controllers/authController.js` *(handlers correspondentes)*
- `backend/src/services/authService.js` *(implementação completa dos fluxos de segurança)*

### Frontend
- `js/api.js` *(métodos `verifyEmail`, `resendVerificationCode`, `verifyLoginCode`, `resendLoginCode`, `changePassword`, `requestEmailChange`, `confirmEmailChange`, `revokeAllSessions`)*
- `index.html` *(etapa de confirmação de e-mail no cadastro, verificação unificada no login e seção de segurança/e-mail no perfil)*
- `js/main.js` *(lógica de UI, temporizadores, feedback de falha de envio e ações de segurança do perfil)*
- `admin.html` *(filtro de gravidade e container de paginação na central de notificações)*
- `js/admin.js` *(paginação, filtro de gravidade e estado de carregamento)*

### Testes
- `tests/full-security-auth-resend.test.js` *(novo)*
- `tests/admin-auth-and-notifications.test.js` *(atualizado para os novos fluxos de verificação)*
- `tests/notification-system-integration.test.js` *(mock SQL atualizado para `tokens_valid_after`)*
- `tests/pre-homologation-migrations.test.js` *(atualizado para 10 migrations)*

---

## 4. Funcionalidades Implementadas

- **Verificação obrigatória de e-mail no cadastro**: Geração de código numérico de 6 dígitos (`crypto.randomInt`), hash SHA-256, expiração em 15 minutos, máximo de 5 tentativas, cooldown de 60s para reenvio e ativação da conta somente após confirmação.
- **Verificação por código no login (Participantes e Administradores)**: Desafio unificado de 6 dígitos com expiração de 10 minutos, registro de IP e User-Agent, detecção de novo IP/dispositivo e alerta de segurança por e-mail.
- **Recuperação e redefinição de senha**: Token criptográfico de uso único, hash SHA-256, transação com `SELECT ... FOR UPDATE`, revogação de refresh tokens e invalidação imediata de JWTs anteriores (`tokens_valid_after`).
- **Segurança do perfil**:
  - Alteração de senha autenticada com confirmação, revogação de sessões e notificação por e-mail.
  - Alteração de e-mail com reautenticação por senha atual, código de 6 dígitos enviado ao novo endereço e notificação enviada tanto ao endereço anterior quanto ao novo.
  - Edição de nome, telefone, CPF (com reautenticação quando já cadastrado) e foto de perfil (`avatarUrl`), com alerta de segurança.
  - Revogação manual de todas as sessões ativas.
- **Central Administrativa de Notificações**: Isolamento multi-tenant estrito, filtros por categoria, gravidade e não lidas, paginação, marcação individual/em massa e polling automático a cada 15s.

---

## 5. Migrations Criadas

- **`010_security_email_verification_and_profile.sql` (`20261124_010`)**:
  - Adiciona `email_verified_at DATETIME NULL`, `avatar_url VARCHAR(255) NULL` e `tokens_valid_after DATETIME NULL` na tabela `users`.
  - Executa backfill compatível (`UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`) para não bloquear usuários já cadastrados antes da migration.
  - Cria a tabela `email_verification_codes` (`purpose ENUM('register', 'email_change')`, `target_email`, `challenge_token` único, `code_hash`, `attempts`, `max_attempts`, `expires_at`, `resend_available_at`, `used_at`, `ip_address`, `user_agent`) com FK para `users(id)`.

---

## 6. Variáveis de Ambiente Necessárias

No servidor de produção e no `backend/.env` local:

- `NODE_ENV=production`
- `PORT=3333`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ou `DATABASE_URL`) e `DB_SSL` conforme provedor MySQL
- `JWT_SECRET` (mínimo 64 caracteres hexadecimais em produção)
- `REFRESH_SECRET`
- `RESEND_API_KEY` (chave obtida no painel do Resend)
- `RESEND_WEBHOOK_SECRET` (segredo Svix `whsec_...` obtido ao configurar o webhook no Resend)
- `EMAIL_FROM` (ex.: `EvoTech Events <no-reply@seudominio.com>`)
- `FRONTEND_URL` (URL pública do frontend para links de recuperação de senha)
- `CORS_ORIGINS` (origens permitidas separadas por vírgula)
- `AUTO_CONFIRM_ORDERS=false`

---

## 7. Configurações do Resend

- SDK oficial `resend` (`^6.39.0`) inicializado em `backend/src/services/emailService.js`.
- Enquanto `EMAIL_FROM` utilizar `onboarding@resend.dev` (domínio sandbox do Resend), a API do Resend restringe os envios apenas ao e-mail da conta proprietária da API Key (ou `delivered@resend.dev`).
- Para envio irrestrito a participantes e administradores em produção, é obrigatório verificar um domínio próprio no painel do Resend e configurar `EMAIL_FROM` com um endereço desse domínio.
- Webhook oficial configurado na rota `POST /api/webhooks/resend` com validação Svix (`svix-id`, `svix-timestamp`, `svix-signature`, janela anti-replay de 300s e `crypto.timingSafeEqual`), tratando `email.delivered`, `email.bounced` e `email.complained`.

---

## 8. Registros DNS Necessários (Ação Externa no Provedor DNS / Resend)

Como não há acesso ao painel do Resend nem ao provedor de DNS neste ambiente, os registros exatos devem ser copiados da seção **Domains** do painel do Resend após adicionar o domínio remetente:

1. **DKIM** (`TXT`): Chaves públicas geradas pelo Resend para assinatura criptográfica dos e-mails.
2. **SPF** (`TXT` / `MX` no subdomínio de bounce indicado pelo Resend, ex.: `send.<seudominio>`): Autorização dos servidores de envio da infraestrutura do Resend (Amazon SES).
3. **DMARC** (`TXT` em `_dmarc.<seudominio>`): Recomendado para reputação e entregabilidade (ex.: `v=DMARC1; p=none;` inicialmente, evoluindo para `quarantine`/`reject`).

---

## 9. Testes Executados e Resultados

Todos os testes automatizados executados após a última alteração passaram:

1. `node tests/resend-email-integration.test.js` — **13/13 aprovados** (inicialização sem chave, envio com mock, mascaramento de e-mail, schemas Zod, templates, tokens, resiliência a erros, bloqueio de pedidos pendentes, idempotência).
2. `node tests/notification-system-integration.test.js` — **28/28 aprovados** (outbox transacional, agrupamento de vendas, deduplicação, rate limit, isolamento multi-tenant, retentativas e backoff, recuperação de crash, concorrência, webhook Svix e recuperação de senha atômica).
3. `node tests/admin-auth-and-notifications.test.js` — **14/14 aprovados** (cadastro com verificação por código, prevenção de duplicidade, login de participante com código, recuperação/redefinição de senha, 2FA admin, rate limit de reenvio, notificações in-app e tratamento de erro sandbox).
4. `node tests/full-security-auth-resend.test.js` — **6/6 cenários avançados aprovados** (falha de envio sem liberar sessão, cooldown e ativação, troca de senha com revogação imediata de JWTs antigos via `tokens_valid_after`, troca de e-mail com notificação ao antigo e novo, detecção de novo IP no login e isolamento multi-tenant estrito).
5. `cd backend && npm test` — **Todas as 14 suítes aprovadas** (XSS, integridade, concorrência, auth/notificações, auditoria de segurança, imagens, JWT, CORS/rate-limit, storage, mapeamento, integridade de migrations, pré-homologação de 10 migrations, auditoria de banco e estabilidade).

---

## 10. Fluxos Homologados com Envio Real

- **Não foi possível executar envio real pela API do Resend neste ambiente**, pois não há `backend/.env` nem `RESEND_API_KEY` configurada no workspace local (e não há acesso ao banco MySQL ou painel do Resend).
- Todos os fluxos foram validados com mocks determinísticos do cliente Resend e banco em memória.
- Para homologar o envio real após configurar `backend/.env` com `RESEND_API_KEY`, execute:
  ```powershell
  cd backend
  node src/scripts/testEmailSend.js seu-email@autorizado.com all
  ```

---

## 11. Pendências que Dependem de Acesso Externo

1. Criar/preencher `backend/.env` (e variáveis no ambiente de hospedagem do backend em produção) com `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `JWT_SECRET`, `REFRESH_SECRET` e credenciais do MySQL.
2. Verificar domínio próprio no painel do Resend e publicar os registros DNS (SPF, DKIM e DMARC).
3. Cadastrar a URL pública `https://<sua-api>/api/webhooks/resend` no painel **Webhooks** do Resend para os eventos `email.delivered`, `email.bounced` e `email.complained` e copiar o `Signing Secret` para `RESEND_WEBHOOK_SECRET`.
4. Executar `npm start` (ou `runMigrations()`) conectado ao MySQL de produção/homologação para aplicar a migration `20261124_010` (`010_security_email_verification_and_profile.sql`).
5. Executar o teste real com `backend/src/scripts/testEmailSend.js` usando um destinatário autorizado.

---

## 12. Riscos Conhecidos e Recomendações Finais

- **Risco Sandbox (`onboarding@resend.dev`)**: Enquanto `EMAIL_FROM` permanecer com o domínio de teste do Resend, e-mails para usuários finais reais serão rejeitados pela API do Resend; o sistema agora trata essa rejeição de forma transparente (sem fingir envio e registrando alerta `operation`), mas o domínio próprio é indispensável para produção.
- **Lockout em memória**: O controle de tentativas incorretas de login (`loginAttempts` em `authService.js`) utiliza `Map` em memória do processo Node.js. Em cenários com múltiplas instâncias/réplicas atrás de load balancer, recomenda-se migrar esse contador para Redis.
- **Limpeza periódica de códigos expirados**: Recomenda-se agendar limpeza periódica (ou evento MySQL) para remover registros expirados antigos de `email_verification_codes`, `admin_login_codes` e `password_reset_tokens`.
