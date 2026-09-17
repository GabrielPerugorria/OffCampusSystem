'use strict';
const { Router } = require('express');
const c = require('../controllers/checkinController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireGate } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.post('/',              requireGate,   validate(s.checkinSchema), c.create);
router.get('/',               requireMember, c.list);
router.get('/heatmap',        requireMember, c.heatmap);
router.get('/validate/:code', requireGate,   c.validate);

module.exports = router;
