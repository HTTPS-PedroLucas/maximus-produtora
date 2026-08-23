require('dotenv').config();
const { runMigrations } = require('../db/migrate');
const { ensureBaseData } = require('./bootstrap');

runMigrations();
ensureBaseData();
