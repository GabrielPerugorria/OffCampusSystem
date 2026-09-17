'use strict';
const { Router } = require('express');
const c = require('../controllers/teamController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireAdmin, requireOwner } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/',        requireAdmin, validate(s.listQuery, 'query'), c.list);
router.post('/',       requireOwner, validate(s.teamCreateSchema),   c.create);
router.patch('/:id',   requireOwner, validate(s.idParam, 'params'), validate(s.teamUpdateSchema), c.update);
router.delete('/:id',  requireOwner, validate(s.idParam, 'params'),  c.remove);

module.exports = router;
