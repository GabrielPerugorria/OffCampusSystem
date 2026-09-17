'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const corsOptions = require('./config/cors');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const { apiLimiter } = require('./middlewares/rateLimit');

const app = express();

app.set('trust proxy', 1);            // atrás de proxy/reverse proxy na hospedagem
app.disable('x-powered-by');

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use('/api', apiLimiter);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
