# Handoff — Intro animada (EvoTech Events)

**Projeto:** EvoTech Events (o repositório ainda se chama `OffCampusSystem`; não foi renomeado).

## Arquivos da intro (únicos ativos)
- `index.html` — `<script>` inline no `<head>` liga `html.intro-on`; bloco `#introSplash` no início do `<body>`; `js/intro-splash.js` carregado logo após o bloco.
- `css/intro-splash.css`
- `js/intro-splash.js` — canvas 2D, esfera de Fibonacci (260 pontos + 3 vizinhos), sem Three.js.

## Comportamento
Fundo preto/verde, esfera 3D girando, `EVOTECH EVENTS` / `EVENTOS EM MOVIMENTO`, barra de progresso, botão **Pular** (também `Esc`).
Barra completa em ~1,9 s, fade-out até ~2,3 s (≈2,5 s com o parse da página). Fail-safe em 3,5 s.
`?intro=off` desativa. `prefers-reduced-motion`: esfera estática, ~1,3 s. Sem JS, o overlay nunca aparece.

## Removido (duplicatas/conflitos)
`intro-splash.js` e `intro-splash.css` da raiz, `mnt/user-data/outputs/js/intro-splash.js`, e a intro antiga "Digital Activation" (9,8 s, Three.js).
`js/intro.js` (órfão, procurava `#intro`) foi movido para `_arquivo-antigo-intro/` como `.txt` (pode apagar).

## Foguete
Existe apenas no globo do hero (`js/globe_v2.js`), não na intro. Corrigido: orientação (antes `lookAt` com coordenadas locais + `rotateX` torto) e velocidade (antes 0,016 s fixo por frame).
**Não testado em navegador** (Three.js vem de CDN e o ambiente de teste não tinha internet).

## Pendências conhecidas (não mexidas)
- `style.css` e `script.js` na raiz parecem cópias antigas de `css/main.css` e `js/main.js` (não referenciados por `index.html`); `js/globe.js` também não é usado.
- `backend/.env` está no ZIP (ignorado pelo git): contém segredos, não publique.
