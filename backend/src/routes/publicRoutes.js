'use strict';
const { Router } = require('express');
const c = require('../controllers/eventController');

const router = Router();

// Vitrine: sem autenticação, sem dados internos do produtor.
router.get('/events',       c.listPublic);
router.get('/events/:slug', c.getPublic);

module.exports = router;
