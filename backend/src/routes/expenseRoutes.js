'use strict';
const { Router } = require('express');
const c = require('../controllers/financeController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireFinance } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate, requireFinance);

router.get('/',       validate(s.listQuery, 'query'), c.listExpenses);
router.post('/',      validate(s.expenseSchema),      c.createExpense);
router.put('/:id',    validate(s.idParam, 'params'), validate(s.expenseUpdateSchema), c.updateExpense);
router.delete('/:id', validate(s.idParam, 'params'),  c.removeExpense);

module.exports = router;
