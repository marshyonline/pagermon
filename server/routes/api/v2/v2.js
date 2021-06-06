const express = require('express');
const messages = require('./messages');

const v2Router = express.Router();

v2Router.use('/messages', messages);

module.exports = v2Router;
