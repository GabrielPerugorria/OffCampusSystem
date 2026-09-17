'use strict';
const { Router } = require('express');
const c = require('../controllers/contactController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireAdmin } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/',       requireMember, validate(s.listQuery, 'query'), c.list);
router.post('/',      requireAdmin,  validate(s.contactSchema),      c.create);
router.put('/:id',    requireAdmin,  validate(s.idParam, 'params'), validate(s.contactUpdateSchema), c.update);
router.delete('/:id', requireAdmin,  validate(s.idParam, 'params'),  c.remove);

module.exports = router;
