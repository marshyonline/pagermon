const { Model } = require('objection');
const config = require('../knexfile.js');
const Knex = require('knex');

const knex = Knex(config);
Model.knex(knex);
module.exports = knex;
