# EvoTech Events — API

Backend REST em **Node.js + Express + MySQL** que substitui o armazenamento em
localStorage do frontend. O frontend continua 100% estático e pode ser
hospedado no GitHub Pages.

```
Frontend (GitHub Pages)  →  HTTP/REST  →  Node.js + Express  →  MySQL
```

O navegador nunca fala com o MySQL. Nenhuma credencial vive no frontend.

---

## 1. Instalar as dependências

Requisitos: **Node.js 18+** e **MySQL 8.0+** (ou MariaDB 10.6+).

```bash
cd backend
npm install
```

## 2. Configurar o `.env`

```bash
cp .env.example .env
```

Preencha:

```ini
NODE_ENV=development
PORT=3333

DB_HOST=localhost
DB_PORT=3306
DB_USER=evotech
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=evotech_events

JWT_SECRET=<cole aqui>
REFRESH_SECRET=<cole aqui>
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080
AUTO_CONFIRM_ORDERS=true
```

As configurações `DB_*` deste arquivo são usadas pela API e pelos comandos
`db:setup` e `db:seed`. `localhost` é apenas o valor de exemplo para um MySQL
instalado na mesma máquina; para um banco remoto, substitua `DB_HOST` pelas
informações fornecidas pelo provedor. Também é possível informar `DATABASE_URL`
em vez das cinco variáveis de conexão. Sem configuração de conexão, a aplicação
falha explicitamente em vez de tentar conectar a um banco local padrão.

Gere cada segredo com:

```bash
openssl rand -hex 64
```

O `.env` está no `.gitignore` e **nunca deve ser commitado**. O `.env.example`
é versionado e não contém credenciais reais.

## 3. Criar o usuário do banco

```sql
CREATE USER 'evotech'@'localhost' IDENTIFIED BY 'sua_senha_do_mysql';
CREATE DATABASE evotech_events CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON evotech_events.* TO 'evotech'@'localhost';
FLUSH PRIVILEGES;
```

## 4. Criar as tabelas

```bash
npm run db:setup
```

Isso executa `src/database/schema.sql`. Também dá para rodar direto:

```bash
mysql -u root -p < src/database/schema.sql
```

> Atenção: o `schema.sql` começa com `DROP TABLE` — ele recria o banco do zero.

## 5. Popular com os dados de demonstração

```bash
npm run db:seed
```

Cria os 3 eventos, lotes, itens do bar, despesas e contatos que existiam no
protótipo. As senhas são geradas com **bcrypt** no momento do seed — não há
senha em texto puro em nenhum arquivo.

| Conta | Senha | Perfil |
|---|---|---|
| admin@evotech.com | admin123 | Owner do produtor |
| carla@evotech.com | equipe123 | Financeiro |
| diego@evotech.com | equipe123 | Portaria |
| bia@evotech.com | equipe123 | Bar |
| demo@evotech.com | demo123 | Participante |

Troque essas senhas antes de qualquer uso real.

## 6. Subir a API

```bash
npm run dev     # com reload automático
npm start       # produção
```

## 7. Testar

```bash
curl http://localhost:3333/api/health

curl -X POST http://localhost:3333/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@evotech.com","password":"admin123"}'

curl http://localhost:3333/api/public/events
```

Use o `accessToken` devolvido pelo login nas rotas protegidas:

```bash
curl http://localhost:3333/api/dashboard -H "Authorization: Bearer SEU_TOKEN"
```

## 8. Conectar o frontend

Na raiz do projeto, sirva os arquivos estáticos:

```bash
python -m http.server 8080      # ou: npx serve .   ou: Live Server do VS Code
```

Abra `http://localhost:8080`. O arquivo `js/config.js` já detecta o ambiente
local e aponta para `http://localhost:3333/api`.

Se você usar outra porta, adicione a origem em `CORS_ORIGINS` no `.env`.

## 9. Publicar

**API** (Deplexo):

1. Suba só a pasta `backend/`.
2. Configure as variáveis do `.env` no painel do provedor (não suba o arquivo).
3. `NODE_ENV=production` e segredos novos, diferentes dos de desenvolvimento.
4. `CORS_ORIGINS=https://gabrielperugorria.github.io`
5. `AUTO_CONFIRM_ORDERS=false` quando houver gateway de pagamento.

**MySQL hospedado** (PlanetScale, Railway, Amazon RDS, Hostinger…): aponte
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` para o servidor
gerenciado (ou use `DATABASE_URL`) e rode `npm run db:setup` uma vez. Se o
provedor exigir TLS, configure `DB_SSL=true` e o caminho do certificado em
`DB_SSL_CA`.

**Frontend no GitHub Pages**: `js/config.js` usa automaticamente a API da Deplexo
fora do ambiente local e mantém `http://localhost:3333/api` durante o desenvolvimento:

```js
API_BASE_URL: isLocal
  ? 'http://localhost:3333/api'
  : 'https://offcampussystem-api.de.deplexo.com/api',
```

Commit, push, e pronto. Nada mais precisa ser reescrito.

---

## Estrutura

```
backend/
├── src/
│   ├── config/         env.js · db.js (pool mysql2) · cors.js
│   ├── database/       schema.sql · setup.js · seed.js
│   ├── middlewares/    auth · authorize · validate · errorHandler
│   │                   notFound · rateLimit · audit
│   ├── validators/     schemas.js (zod)
│   ├── services/       regra de negócio + SQL (prepared statements)
│   ├── controllers/    HTTP: req → service → res
│   ├── routes/         um arquivo por recurso + index.js
│   ├── utils/          AppError · response · asyncHandler
│   │                   slug · ticketCode · logger
│   ├── app.js
│   └── server.js
├── .env.example
├── .gitignore
└── package.json
```

## Formato das respostas

```json
{ "success": true,  "data": { }, "meta": { "total": 42, "page": 1 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…",
                               "details": [{ "field": "email", "message": "…" }] } }
```

Status usados: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`,
`429`, `500`, `503`.

## Segurança implementada

- Senhas com **bcrypt** (custo 12). O banco nunca guarda senha legível.
- **JWT** de 15 min + **refresh token** rotativo, guardado como hash SHA-256.
- **RBAC por organização**: `owner`, `admin`, `finance`, `gate`, `bar`.
  O `organization_id` sai sempre do token — nunca do corpo da requisição.
- Toda query usa **prepared statements** (`pool.execute` com `?`).
- **Validação com zod** em body, params e query; campos não declarados no
  schema são descartados antes de chegar ao banco.
- **CORS** por lista branca explícita.
- **Rate limit**: 600 req/15 min na API, 20 tentativas/15 min no login.
- **Helmet** nos headers HTTP.
- Erros do MySQL são traduzidos; stack trace e SQL nunca vão para o cliente.
- **Auditoria** com o autor real de cada ação, gravada no servidor.
- Preço, disponibilidade e código do ingresso são decididos no servidor.
- Bloqueio de participante revoga os refresh tokens dele na hora.

---

## E-mails Transacionais — Integração Resend

O serviço de envio de e-mails transacionais é centralizado em `backend/src/services/emailService.js` utilizando o SDK oficial `resend` (`^6.x`).

### 1. Variáveis de Ambiente necessárias (`.env`)

```ini
# Chave obtida no painel https://resend.com/api-keys
RESEND_API_KEY=sua_chave_resend_aqui

# Remetente oficial (inicialmente em sandbox; substitua pelo seu domínio quando verificado)
EMAIL_FROM=EvoTech Events <onboarding@resend.dev>

# URL base do frontend (usada nos links absolutos dos e-mails)
FRONTEND_URL=https://gabrielperugorria.github.io/OffCampusSystem
```

### 2. Fluxos Transacionais com E-mail Ativo

1. **Recuperação de Senha (`/auth/forgot-password` e `/auth/reset-password`)**:
   - Token criptograficamente seguro (`crypto.randomBytes(32)`).
   - Apenas o hash SHA-256 é armazenado em `password_reset_tokens`.
   - Expiração estrita de 30 minutos e uso único (*one-time use*).
   - Invalidação automática de tokens anteriores do usuário.
   - Proteção estrita contra enumeração de e-mails (resposta idêntica para cadastrados e não cadastrados).
   - Revogação imediata de todas as sessões anteriores após a redefinição de senha.
   - Notificação de segurança enviada confirmando a alteração.

2. **Confirmação de Cadastro (Boas-vindas)**:
   - Disparado automaticamente após o registro bem-sucedido.
   - Totalmente assíncrono: falhas transitórias do provedor de e-mail não impedem a criação da conta.

3. **Confirmação de Compra de Ingressos**:
   - Disparado **exclusivamente** após a confirmação efetiva do pagamento (`status = 'paid'`).
   - Apresenta detalhes do evento, local, data, resumo financeiro e os códigos alfanuméricos dos ingressos emitidos.
   - Idempotência a nível de banco: a coluna `confirmation_email_sent_at` na tabela `orders` impede envios duplicados caso o status seja atualizado repetidas vezes.

### 3. Restrições do Domínio de Teste (`onboarding@resend.dev`)

- Enquanto o domínio próprio não for verificado no painel do Resend, a plataforma opera com o remetente padrão `onboarding@resend.dev`.
- No modo de teste, a API do Resend autoriza envios apenas para o e-mail cadastrado na conta do desenvolvedor ou para o destinatário de homologação `delivered@resend.dev`.
- **Migração para Domínio Próprio**:
  1. Adicione seu domínio no painel do Resend (Settings → Domains).
  2. Configure os registros DNS (SPF, DKIM, DMARC) indicados pelo Resend.
  3. No `.env`, atualize `EMAIL_FROM=EvoTech Events <contato@seudominio.com>`. Não é necessário alterar nenhuma linha de código.

### 4. Como Testar o Envio Localmente

Para validar a conectividade e os templates em ambiente local:

```bash
# Testa template de boas-vindas
node src/scripts/testEmailSend.js seu-email@exemplo.com welcome

# Testa template de recuperação de senha
node src/scripts/testEmailSend.js seu-email@exemplo.com reset

# Testa template de confirmação de pedido
node src/scripts/testEmailSend.js seu-email@exemplo.com order
```

### 5. Execução dos Testes Automatizados

```bash
# Executa a suíte de testes de integração do Resend (mocks e segurança)
node tests/resend-email-integration.test.js

# Executa os testes de integridade do backend
node tests/backend-integrity.test.js
```
