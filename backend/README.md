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

**API** (Railway, Render, Fly.io, VPS…):

1. Suba só a pasta `backend/`.
2. Configure as variáveis do `.env` no painel do provedor (não suba o arquivo).
3. `NODE_ENV=production` e segredos novos, diferentes dos de desenvolvimento.
4. `CORS_ORIGINS=https://SEU-USUARIO.github.io`
5. `AUTO_CONFIRM_ORDERS=false` quando houver gateway de pagamento.

**MySQL hospedado** (PlanetScale, Railway, Amazon RDS, Hostinger…): aponte
`DB_HOST`, `DB_USER`, `DB_PASSWORD` para o servidor gerenciado e rode
`npm run db:setup` uma vez.

**Frontend no GitHub Pages**: troque uma linha em `js/config.js`:

```js
API_BASE_URL: isLocal
  ? 'http://localhost:3333/api'
  : 'https://sua-api-publicada.com/api',   // ← só isso muda
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
