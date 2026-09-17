'use strict';
const { Router } = require('express');
const c = require('../controllers/eventController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate, requireAdmin);

router.put('/:id',        validate(s.idParam, 'params'), validate(s.batchUpdateSchema), c.updateBatch);
router.patch('/:id/stock', validate(s.idParam, 'params'), validate(s.batchStockSchema),  c.adjustBatch);
router.delete('/:id',     validate(s.idParam, 'params'), c.removeBatch);

module.exports = router;
