# RELATÓRIO DE AUDITORIA: VARIÁVEIS DE AMBIENTE, RESEND, WEBHOOK E PUBLICAÇÃO NO GITHUB — EVOTECH EVENTS

## 1. Diagnóstico das Variáveis de Ambiente

A inspeção de `backend/src/config/env.js` e de todos os arquivos do backend mostrou que o código espera nomes **em inglês** para todas as variáveis de ambiente. Os nomes em português presentes na Deplexo (`ORIGENS_CORS`, `URL_FRONTEND`, `E-MAIL_DE`) não eram lidos antes desta revisão.

### Tabela de Padronização

| Variável | Nome definitivo | Aliases legados (compatibilidade temporária) | Finalidade | Obrigatória |
| :--- | :--- | :--- | :--- | :--- |
| CORS | `CORS_ORIGINS` | `ORIGENS_CORS` | Origens autorizadas separadas por vírgula (obrigatória em `production`) | Sim |
| Frontend | `FRONTEND_URL` | `URL_FRONTEND` | URL pública do frontend para links de recuperação/acesso | Sim |
| Remetente | `EMAIL_FROM` | `E-MAIL_DE`, `EMAIL_DE` | Endereço remetente de e-mails (`Nome <email@dominio>`) | Sim |
| Resend API | `RESEND_API_KEY` | — | Autenticação na API do Resend | Sim |
| Resend Webhook | `RESEND_WEBHOOK_SECRET` | — | Validação criptográfica Svix da assinatura dos webhooks (obrigatória em `production`) | Sim |

---

## 2. Nomes Definitivos e Endereços Validados

- **Frontend**: `https://gabrielperugorria.github.io/OffCampusSystem` (sem barra final; `env.js` normaliza barras finais).
- **Origem CORS**: `https://gabrielperugorria.github.io` (apenas esquema + host, sem o caminho `/OffCampusSystem`; `env.js` também remove eventuais barras finais).
- **API (`js/config.js`)**: `https://offcampussystem-api.de.deplexo.com/api`.
- **Webhook Resend**: `https://offcampussystem-api.de.deplexo.com/api/webhooks/resend` (aponta diretamente para a API na Deplexo).
- **Remetente (`EMAIL_FROM`)**: Deve pertencer exatamente ao domínio ou subdomínio verificado no painel do Resend (enquanto usar `onboarding@resend.dev`, o Resend restringe envios ao e-mail proprietário da conta).

---

## 3. Compatibilidade com as Variáveis Já Existentes na Deplexo

Em `backend/src/config/env.js`, foi adicionada compatibilidade temporária para que o ambiente atual da Deplexo continue funcionando imediatamente sem quebra:
- `CORS_ORIGINS || ORIGENS_CORS` (com remoção de barra final por origem)
- `FRONTEND_URL || URL_FRONTEND`
- `EMAIL_FROM || E-MAIL_DE || EMAIL_DE`

Quando um alias legado é utilizado, o backend registra um aviso no log (`[ENV] Aviso: usando alias legado ...`) recomendando a migração para o nome definitivo.

---

## 4. Correções Realizadas

- Padronização e fallback de aliases em `backend/src/config/env.js`.
- Implementação da migration `010_security_email_verification_and_profile.sql` (`email_verified_at`, `avatar_url`, `tokens_valid_after`, `email_verification_codes`).
- Verificação obrigatória de e-mail no cadastro, login 2FA unificado (participantes + admins), detecção de novo IP, troca de senha com revogação imediata de JWTs (`tokens_valid_after`), troca de e-mail segura (notificando endereço antigo e novo) e isolamento multi-tenant estrito na central administrativa.
- Atualização completa das telas de login, cadastro, perfil e central administrativa (`index.html`, `js/api.js`, `js/main.js`, `admin.html`, `js/admin.js`).

---

## 5. Resultado da Auditoria Resend

- SDK `resend` (`^6.39.0`) inicializado em `backend/src/services/emailService.js`.
- Templates HTML + texto puro validados para cadastro, login 2FA, recuperação de senha, alteração de senha, alteração de e-mail e alertas de segurança (sem exposição de segredos ou códigos em logs).
- Fila persistente `notification_outbox` com idempotência, retentativas com backoff e criação de alerta interno `operation` em caso de falha de envio.

---

## 6. Resultado da Validação do Webhook

- Rota `POST /api/webhooks/resend` ativa em `backend/src/routes/webhookRoutes.js`.
- Corpo bruto (`req.rawBody`) capturado via `express.json({ verify })` em `backend/src/app.js`.
- Assinatura Svix validada com `RESEND_WEBHOOK_SECRET` (suporte ao prefixo `whsec_` em Base64, janela anti-replay de 300s e `crypto.timingSafeEqual`).
- Eventos `email.delivered`, `email.bounced` e `email.complained` tratados com máquina de estados idempotente em `notificationOutboxService.js`.
- Em produção, `RESEND_WEBHOOK_SECRET` ausente bloqueia a requisição com HTTP `401`.

---

## 7. Testes Executados e Resultados Reais

Todos os testes abaixo foram executados após a última alteração de código e aprovados com código de saída `0` (utilizando mocks do cliente Resend e banco em memória nos testes automatizados):

- `node -e "require('./backend/src/config/env')"` com aliases `ORIGENS_CORS`, `URL_FRONTEND`, `E-MAIL_DE`: **aprovado** (normalização e avisos validados).
- `tests/resend-email-integration.test.js`: **13/13 aprovados**.
- `tests/notification-system-integration.test.js`: **28/28 aprovados**.
- `tests/admin-auth-and-notifications.test.js`: **14/14 aprovados**.
- `tests/full-security-auth-resend.test.js`: **6/6 cenários avançados aprovados**.
- `cd backend && npm test`: **todas as 14 suítes aprovadas**.

*Nota*: Não houve envio real via API do Resend neste ambiente local por ausência de `backend/.env` / `RESEND_API_KEY` local.

---

## 8. Arquivos Modificados e Criados

- **Backend**: `backend/src/config/env.js`, `backend/src/database/migrations/010_security_email_verification_and_profile.sql`, `backend/src/database/runMigrations.js`, `backend/src/middlewares/auth.js`, `backend/src/validators/schemas.js`, `backend/src/routes/authRoutes.js`, `backend/src/controllers/authController.js`, `backend/src/controllers/notificationController.js`, `backend/src/services/authService.js`, `backend/src/services/emailService.js`, `backend/src/services/notificationOutboxService.js`, `backend/src/services/inAppNotificationService.js`, e 4 novos templates em `backend/src/services/emailTemplates/`.
- **Frontend**: `index.html`, `js/api.js`, `js/main.js`, `admin.html`, `js/admin.js`.
- **Testes**: `tests/full-security-auth-resend.test.js`, `tests/admin-auth-and-notifications.test.js`, `tests/notification-system-integration.test.js`, `tests/pre-homologation-migrations.test.js`.
- **Relatórios**: `RELATORIO_INTEGRACAO_RESEND_SEGURANCA_NOTIFICACOES.md`, `RELATORIO_AUDITORIA_RESEND_VARIAVEIS_E_PUBLICACAO.md`.

---

## 9. Arquivos Protegidos e Excluídos do Git

- `.gitignore` protege `.env`, `.env.*` (preservando `!.env.example`), `*.key`, `*.p12`, `*.pfx`, `*.pem` (preservando `!backend/src/certs/ca.pem`), `*.log`, `*.dump`, `*.bak`, `*.sqlite`, `*.db`, `backups/`.
- `backend/package-lock.json` (alteração local de `npm install`) foi mantido fora dos commits.
- Varredura no working tree não encontrou nenhuma chave `re_...`, `whsec_...` ou chave privada.

---

## 10. Resultado da Inspeção de Segurança do Histórico

- Inspeção dos 15 commits recentes no histórico do Git (`git log -n 15 -S "whsec_"` e `-S "re_"`) **não encontrou credenciais reais** expostas no histórico analisado.

---

## 11. Commits Criados

1. `2ffd9f0` — `feat(database): add migration 010 for email verification, session revocation, and profile`
2. `8b68b7c` — `feat(email): add security templates, outbox failure alerts, and Deplexo env aliases`
3. `191a4d5` — `feat(auth): enforce email verification, unified 2FA login, profile security, and multi-tenant isolation`
4. `cea9b2d` — `feat(ui): integrate email verification, 2FA login, profile security, and admin notification filters`
5. `fa0df2b` — `test: add security/Resend test suite and update integration tests`
6. Commit de documentação final contendo este relatório e `RELATORIO_INTEGRACAO_RESEND_SEGURANCA_NOTIFICACOES.md`.

---

## 12. Branch e Repositório de Destino

- **Branch**: `main`
- **Repositório remoto**: `https://github.com/GabrielPerugorria/OffCampusSystem.git` (`origin/main`)

---

## 13. Resultado do Push

- Os commits foram enviados para `origin/main` sem `--force`, preservando integralmente o histórico existente e confirmando a sincronização no GitHub.

---

## 14. Pendências Manuais na Deplexo e no Resend

1. **Na Deplexo (variáveis de ambiente)**:
   - Migrar gradualmente `ORIGENS_CORS` → `CORS_ORIGINS` (`https://gabrielperugorria.github.io`), `URL_FRONTEND` → `FRONTEND_URL` (`https://gabrielperugorria.github.io/OffCampusSystem`) e `E-MAIL_DE` → `EMAIL_FROM`.
   - Garantir que `RESEND_API_KEY` e `RESEND_WEBHOOK_SECRET` estejam preenchidos e reiniciar/reimplantar o serviço.
2. **No Resend**:
   - Verificar domínio próprio (SPF, DKIM, DMARC) para liberar envios a quaisquer destinatários além do e-mail da conta.
   - Opcionalmente habilitar também o evento `email.complained` no webhook já criado (`https://offcampussystem-api.de.deplexo.com/api/webhooks/resend`).
   - Considerar rotacionar o `RESEND_WEBHOOK_SECRET` caso deseje renovar o segredo após os testes iniciais.
