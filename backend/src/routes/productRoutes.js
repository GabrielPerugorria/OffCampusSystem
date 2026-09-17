'use strict';
const { Router } = require('express');
const c = require('../controllers/inventoryController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireBar } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/',    requireMember, validate(s.listQuery, 'query'), c.list);
router.post('/',   requireBar,    validate(s.productSchema),      c.create);
router.put('/:id', requireBar,    validate(s.idParam, 'params'), validate(s.productUpdateSchema), c.update);
router.delete('/:id', requireBar, validate(s.idParam, 'params'),  c.remove);
router.post('/:id/movements', requireBar,
  validate(s.idParam, 'params'), validate(s.movementSchema), c.createMovement);

module.exports = router;
