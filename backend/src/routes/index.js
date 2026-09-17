'use strict';
const { Router } = require('express');
const db = require('../config/db');
const { ok } = require('../utils/response');

const router = Router();

router.get('/health', async (req, res) => {
  const database = await db.healthCheck().catch(() => false);
  return ok(res, { status: 'up', database: database ? 'up' : 'down', time: new Date().toISOString() });
});

router.use('/auth',         require('./authRoutes'));
router.use('/public',       require('./publicRoutes'));
router.use('/me',           require('./meRoutes'));
router.use('/events',       require('./eventRoutes'));
router.use('/batches',      require('./batchRoutes'));
router.use('/orders',       require('./orderRoutes'));
router.use('/tickets',      require('./ticketRoutes'));
router.use('/checkins',     require('./checkinRoutes'));
router.use('/participants', require('./participantRoutes'));
router.use('/financial',    require('./financeRoutes'));
router.use('/expenses',     require('./expenseRoutes'));
router.use('/products',     require('./productRoutes'));
router.use('/inventory',    require('./inventoryRoutes'));
router.use('/contacts',     require('./contactRoutes'));
router.use('/team',         require('./teamRoutes'));
router.use('/dashboard',    require('./dashboardRoutes'));
router.use('/analytics',    require('./analyticsRoutes'));
router.use('/reports',      require('./reportRoutes'));
router.use('/audit-logs',   require('./auditRoutes'));

module.exports = router;
