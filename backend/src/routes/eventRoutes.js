'use strict';
const { Router } = require('express');
const c = require('../controllers/eventController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireAdmin } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/',            requireMember, validate(s.listQuery, 'query'), c.list);
router.post('/',           requireAdmin,  validate(s.eventSchema),        c.create);
router.get('/:id',         requireMember, validate(s.idParam, 'params'),  c.get);
router.put('/:id',         requireAdmin,  validate(s.idParam, 'params'), validate(s.eventUpdateSchema), c.update);
router.patch('/:id/goals', requireAdmin,  validate(s.idParam, 'params'), validate(s.goalsSchema),       c.updateGoals);
router.delete('/:id',      requireAdmin,  validate(s.idParam, 'params'),  c.remove);

router.get('/:id/batches',  requireMember, validate(s.idParam, 'params'), c.listBatches);
router.post('/:id/batches', requireAdmin,  validate(s.idParam, 'params'), validate(s.batchSchema), c.createBatch);

module.exports = router;
