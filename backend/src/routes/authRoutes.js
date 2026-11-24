'use strict';
const { Router } = require('express');
const c = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');
const s = require('../validators/schemas');

const router = Router();

router.post('/register',                 authLimiter, validate(s.registerSchema),           c.register);
router.post('/verify-email',             authLimiter, validate(s.verifyCodeSchema),         c.verifyEmail);
router.post('/resend-verification-code', authLimiter, validate(s.resendCodeSchema),         c.resendVerificationCode);
router.post('/login',                    authLimiter, validate(s.loginSchema),              c.login);
router.post('/verify-login-code',        authLimiter, validate(s.verifyCodeSchema),         c.verifyLoginCode);
router.post('/resend-login-code',        authLimiter, validate(s.resendCodeSchema),         c.resendLoginCode);
router.post('/verify-admin-code',        authLimiter, validate(s.verifyAdminCodeSchema),    c.verifyAdminCode);
router.post('/resend-admin-code',        authLimiter, validate(s.resendAdminCodeSchema),    c.resendAdminCode);
router.post('/refresh',                  validate(s.refreshSchema),                         c.refresh);
router.post('/logout',                   c.logout);
router.post('/forgot-password',          authLimiter, validate(s.forgotSchema),             c.forgotPassword);
router.post('/reset-password',           authLimiter, validate(s.resetPasswordSchema),      c.resetPassword);
router.get('/me',                        authenticate,                                      c.me);
router.put('/me',                        authenticate, validate(s.updateMeSchema),          c.updateMe);
router.post('/change-password',          authenticate, validate(s.changePasswordSchema),    c.changePassword);
router.post('/change-email/request',     authenticate, authLimiter, validate(s.requestEmailChangeSchema), c.requestEmailChange);
router.post('/change-email/confirm',     authenticate, authLimiter, validate(s.verifyCodeSchema),         c.confirmEmailChange);
router.post('/revoke-sessions',          authenticate, validate(s.revokeSessionsSchema),    c.revokeAllSessions);

module.exports = router;
