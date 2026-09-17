'use strict';
const { Router } = require('express');
const c = require('../controllers/participantController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireAdmin } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/', requireMember, validate(s.listQuery, 'query'), c.list);
router.patch('/:id/status', requireAdmin,
  validate(s.idParam, 'params'), validate(s.participantStatusSchema), c.setStatus);

module.exports = router;
