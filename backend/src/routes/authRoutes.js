'use strict';
const { Router } = require('express');
const c = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');
const s = require('../validators/schemas');

const router = Router();

router.post('/register',        authLimiter, validate(s.registerSchema), c.register);
router.post('/login',           authLimiter, validate(s.loginSchema),    c.login);
router.post('/refresh',         validate(s.refreshSchema),               c.refresh);
router.post('/logout',          c.logout);
router.post('/forgot-password', authLimiter, validate(s.forgotSchema),   c.forgotPassword);
router.get('/me',               authenticate,                            c.me);
router.put('/me',               authenticate, validate(s.updateMeSchema), c.updateMe);

module.exports = router;
