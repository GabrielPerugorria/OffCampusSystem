'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * recipientResolver — Resolução segura de destinatários autorizados.
 *
 * REGRAS DE ARQUITETURA E SEGURANÇA:
 * 1. O backend resolve os destinatários a partir dos relacionamentos reais do banco.
 * 2. Nunca confia em dados ou listas de e-mails fornecidas pelo cliente/frontend.
 * 3. O Owner da organização recebe resumos consolidados e notificações de todos os eventos da org.
 * 4. Administradores recebem categorias operacionais e comerciais; financeiro apenas se habilitado.
 * 5. Usuários com função 'finance' recebem atualizações financeiras autorizadas.
 * 6. Usuários 'gate' e 'bar' NUNCA recebem dados financeiros ou resumos executivos.
 * 7. Preferências do usuário (notification_preferences) apenas FILTRAM o que ele deseja
 *    receber dentre o que já está AUTORIZADO — nunca ampliam privilégios de acesso.
 */

/**
 * Mapeamento de categorias e papéis mínimos necessários
 */
const CATEGORY_ROLE_PERMISSIONS = {
  sales_update:   ['owner', 'admin'],
  finance_update: ['owner', 'finance'],
  stock_alert:    ['owner', 'admin', 'bar'],
  goal_reached:   ['owner', 'admin'],
  summary:        ['owner', 'admin', 'finance'],
};

/**
 * Obtém os destinatários autorizados para uma notificação em uma organização/evento.
 *
 * @param {object} opts
 * @param {number} opts.organizationId
 * @param {number|null} opts.eventId
 * @param {string} opts.category - 'sales_update' | 'finance_update' | 'stock_alert' | 'goal_reached' | 'summary'
 * @returns {Promise<Array<{ userId: number, name: string, email: string, role: string }>>}
 */
async function resolveAuthorizedRecipients({ organizationId, eventId = null, category }) {
  if (!organizationId || !category) {
    return [];
  }

  const allowedRoles = CATEGORY_ROLE_PERMISSIONS[category] || ['owner'];

  // Busca todos os membros ativos da organização com papéis permitidos e status ativo
  const query = `
    SELECT u.id AS user_id, u.name, u.email, om.role
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ?
       AND om.status = 'active'
       AND u.status = 'active'
       AND om.role IN (${allowedRoles.map(() => '?').join(',')})
  `;
  const params = [organizationId, ...allowedRoles];

  const members = await db.query(query, params);

  // Também garante que o proprietário da organização (owner_user_id) esteja incluído
  const org = await db.queryOne(
    `SELECT o.owner_user_id, u.name, u.email
       FROM organizations o
       JOIN users u ON u.id = o.owner_user_id
      WHERE o.id = ? AND o.status = 'active' AND u.status = 'active'
      LIMIT 1`,
    [organizationId]
  );

  const recipientMap = new Map();

  if (org && (allowedRoles.includes('owner') || category === 'summary')) {
    recipientMap.set(org.owner_user_id, {
      userId: org.owner_user_id,
      name: org.name,
      email: org.email,
      role: 'owner',
    });
  }

  for (const m of members) {
    recipientMap.set(m.user_id, {
      userId: m.user_id,
      name: m.name,
      email: m.email,
      role: m.role,
    });
  }

  const candidates = Array.from(recipientMap.values());
  if (candidates.length === 0) return [];

  // Agora aplica o filtro de preferências de cada usuário
  const userIds = candidates.map(c => c.userId);
  const placeholders = userIds.map(() => '?').join(',');

  const prefs = await db.query(
    `SELECT recipient_user_id, enabled, sales_updates, finance_updates, stock_alerts, goals_reached, summaries_enabled
       FROM notification_preferences
      WHERE organization_id = ?
        AND recipient_user_id IN (${placeholders})`,
    [organizationId, ...userIds]
  );

  const prefMap = new Map(prefs.map(p => [p.recipient_user_id, p]));

  // Filtra candidatos cujas preferências permitam esta categoria
  const authorized = candidates.filter(user => {
    const userPref = prefMap.get(user.userId);
    // Se o usuário não configurou preferências, o default é receber as categorias permitidas
    if (!userPref) return true;

    // Se desativou todas as notificações
    if (!userPref.enabled) return false;

    // Valida categoria específica
    switch (category) {
      case 'sales_update':
        return Boolean(userPref.sales_updates);
      case 'finance_update':
        return Boolean(userPref.finance_updates);
      case 'stock_alert':
        return Boolean(userPref.stock_alerts);
      case 'goal_reached':
        return Boolean(userPref.goals_reached);
      case 'summary':
        return Boolean(userPref.summaries_enabled);
      default:
        return true;
    }
  });

  return authorized;
}

/**
 * Valida se um usuário específico possui permissão de leitura sobre dados de uma categoria e evento
 */
async function validateUserPermission({ userId, organizationId, category }) {
  if (!userId || !organizationId || !category) return false;

  const allowedRoles = CATEGORY_ROLE_PERMISSIONS[category] || ['owner'];

  // Verifica se é owner direto
  const isOwner = await db.queryOne(
    'SELECT id FROM organizations WHERE id = ? AND owner_user_id = ? AND status = "active" LIMIT 1',
    [organizationId, userId]
  );
  if (isOwner) return true;

  // Verifica membership
  const member = await db.queryOne(
    `SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    [organizationId, userId]
  );

  if (!member) return false;
  return allowedRoles.includes(member.role);
}

module.exports = {
  resolveAuthorizedRecipients,
  validateUserPermission,
  CATEGORY_ROLE_PERMISSIONS,
};
