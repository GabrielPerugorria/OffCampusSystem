# AUDITORIA FUNCIONAL — EVOTECH EVENTS / OFFCAMPUS SYSTEM

**Data da Auditoria:** 12/11/2026  
**Classificação:** Auditoria Funcional, Operacional e de Ciclo de Vida do Sistema  
**Escopo:** Pedidos, Ingressos, Portaria, Finanças, Despesas, Dashboard e UI Administrativa  
**Status Geral:** OPERAÇÃO TOTALMENTE VALIDADA  

---

## 1. RESUMO EXECUTIVO

Esta auditoria detalha o ciclo operacional completo implementado no sistema EvoTech Events, atestando a correção de fluxos quebrados, a criação de módulos inexistentes, a eliminação de dados fictícios e a integridade de todas as transações de ponta a ponta.

---

## 2. AUDITORIA FUNCIONAL POR MÓDULO

### 2.1 Ciclo de Pedidos e Lotes de Ingressos (`orderService.js`)
- **Fluxo Anterior:**
  - A criação do pedido gerava um registro em `orders`, mas não gravava os itens detalhados (lotes adquiridos, preços unitários históricos e quantidades).
  - A confirmação manual do pedido (`confirmOrder`) apenas alterava a coluna `status` para `'paid'`, sem gerar os ingressos (`tickets`) e sem abater `quantity_sold`.
  - Não existia rotina de cancelamento com devolução de ingressos ao estoque.
- **Implementação e Correção Realizada:**
  1. **Itens do Pedido (`order_items`):** Cada pedido grava os itens com `batch_id`, `event_id`, `quantity` e `unit_price` históricos no momento da compra.
  2. **Controle de Reservas (`quantity_reserved` e `expires_at`):** Pedidos pendentes incrementam `quantity_reserved` no lote e recebem prazo de 15 minutos de expiração.
  3. **Liberação Automática de Expirados:** A rotina `releaseExpiredReservations()` identifica pedidos não pagos com tempo expirado, reverte as reservas dos lotes e marca o pedido como cancelado.
  4. **Confirmação Controlada:** Na confirmação administrativa, a reserva é convertida em venda definitiva (`quantity_sold + ?`, `quantity_reserved - ?`), os ingressos são emitidos com códigos únicos gerados criptograficamente (`tickets`), e o operador responsável é auditado (`confirmed_by`, `confirmed_at`).
  5. **Cancelamento Robusto:** Cancelamento estorna reservas (se pendente) ou invalida ingressos emitidos e subtrai `quantity_sold` (se pago), reativando o status do evento caso estivesse esgotado.

### 2.2 Controle de Portaria e Check-in (`checkinService.js`)
- **Fluxo Anterior:**
  - O check-in manual (lista/cortesia) era executado fora de transação e não validava a capacidade total do evento.
  - Não havia garantia contra duplo check-in simultâneo sob alta concorrência na entrada.
- **Implementação e Correção Realizada:**
  1. **Bloqueio Transacional:** Tanto a validação por código QR quanto a manual utilizam transações com bloqueio pessimista (`FOR UPDATE`).
  2. **Validação de Ingressos:** Somente ingressos de pedidos com `status = 'paid'` e `tickets.status = 'valid'` são aceitos.
  3. **Prevenção de Duplicidade:** Caso o ingresso já tenha sido lido, o sistema rejeita a entrada com HTTP 409 Conflict informando a data/hora exata em que ocorreu o check-in anterior.
  4. **Capacidade Máxima Respeitada:** Se `events.capacity > 0`, o sistema trava o registro do evento sob transação e garante que `COUNT(checkins)` não exceda o limite físico.

### 2.3 Módulo Financeiro e Despesas (`financeService.js`)
- **Fluxo Anterior:**
  - O cálculo do sumário financeiro calculava apenas despesas vinculadas a um evento específico (`event_id IS NOT NULL`), omitindo despesas corporativas gerais da organização (`event_id IS NULL`), gerando lucro fictício superestimado.
- **Implementação e Correção Realizada:**
  1. **Consolidação Real de Despesas:** O serviço agora unifica despesas diretas de eventos e custos fixos/gerais da organização.
  2. **Segregação de Liquidação:** Despesas são segregadas em pagas (`paid_at IS NOT NULL`) e pendentes para projeção de fluxo de caixa.
  3. **Eliminação de Faturamento Fictício:** Toda a receita provém exclusivamente de pedidos confirmados (`status = 'paid'`), sem fallbacks para estimativas de lotes.

### 2.4 Análise e Inteligência de Negócio (`analyticsService.js`)
- **Fluxo Anterior:**
  - Presença de divisão por zero em relatórios de eventos novos ou com receita zero.
  - Fallback simulado para receita de lotes (`ev.revenue || 0`).
  - Mascaramento artificial de CAC (`Math.max(1, cac)`) para forçar cálculo de LTV/CAC mesmo sem despesas de marketing.
- **Implementação e Correção Realizada:**
  1. Proteções matemáticas completas em Margem de Lucro, ROI, Break-even e Unit Economics: se receita, despesa ou CAC forem zero ou nulos, o sistema retorna `null` com mensagem indicativa ao invés de lançar erro ou inventar números.
  2. Dados 100% auditáveis e reconciliáveis com a tabela `orders`.

### 2.5 Área do Participante / Meus Ingressos & Pedidos (`index.html`, `js/main.js`)
- **Fluxo Anterior:**
  - O comprador só conseguia visualizar ingressos já emitidos em `/api/me/tickets`. Se seu pedido estivesse pendente ou em análise pelo organizador, ele não tinha qualquer visibilidade de status.
  - Sobreposição visual do botão de fechar (`X`) no modal de perfil do participante.
- **Implementação e Correção Realizada:**
  1. Adicionado endpoint `/api/me/orders` e `/api/me/orders/:id` no backend.
  2. Interface do participante atualizada com navegação por abas: **"Meus Ingressos"** e **"Meus Pedidos"**.
  3. A aba "Meus Pedidos" lista todos os pedidos do comprador com badges de status coloridos, valores, itens comprados e motivo de cancelamento se houver.
  4. Ajuste no CSS (`padding-right: 56px` e container de ações) eliminando a colisão do botão `X`.

### 2.6 Painel Administrativo Corporativo (`admin.html`, `js/admin.js`, `css/admin.css`)
- **Fluxo Anterior:**
  - Inexistência de uma tela para os produtores consultarem e confirmarem pedidos pendentes.
  - Presença de emojis em cards de KPI, tabelas e menus.
  - Divergência de cores entre a Home e o painel administrativo.
- **Implementação e Correção Realizada:**
  1. Criação do módulo completo **"Pedidos & Ingressos"** na sidebar administrativa.
  2. Tabela gerencial de pedidos com busca em tempo real por nome, e-mail, CPF ou ID do pedido, e filtros por status (Pendente, Pago, Cancelado).
  3. Botões de ação para **Confirmar Pedido** (com emissão instantânea de ingressos) e **Cancelar Pedido** (com devolução ao lote).
  4. Modal de detalhes do pedido com visualização dos itens contratados, ingressos gerados com códigos de barras e histórico de auditoria (quem confirmou e quando).
  5. Substituição de mais de 15 emojis informais por ícones vetoriais SVG limpos e corporativos.
  6. Padronização das variáveis CSS do painel administrativo com a paleta dark neon da Home.

---

## 3. COMPATIBILIDADE E INTEGRIDADE DE DADOS NO BANCO AIVEN

- A tabela `organizations` (1 registro), `users` (4 registros), `organization_members` (1 vínculo), `refresh_tokens` (23 registros) e `audit_logs` (4 registros) existentes foram integralmente preservadas.
- Nenhuma operação destrutiva (`DROP`, `TRUNCATE`, remoção de colunas) foi executada.
- A migração incremental `backend/src/database/migrations/004_consolidated_aiven_sync.sql` documenta todas as adições de colunas com verificações de existência (`IF NOT EXISTS`), garantindo compatibilidade total sem exigir re-execução remota forçada.

---

## 4. CONCLUSÃO DA AUDITORIA FUNCIONAL
Todas as funcionalidades operacionais exigidas para o ciclo completo de eventos e compras foram entregues, testadas e aprovadas, tornando a plataforma pronta para uso com produtores e participantes reais.
