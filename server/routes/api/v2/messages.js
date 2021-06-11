const express = require('express');
const Message = require('../../../models/message');
const nconf = require('nconf');
const authHelper = require('../../../middleware/authhelper');
const _ = require('lodash');
const logger = require('../../../log');
const { format } = require('util');
const { checkLimitRequest, checkPageRequest, createInitObject, pluginHandlerPromised } = require('./helpers');

const confFile = './config/config.json';
nconf.file({ file: confFile }).load();
const messagesRouter = express.Router();

messagesRouter.use(function(req, res, next) {
    res.locals.login = req.isAuthenticated();
    res.locals.user = req.user || false;
    next();
});

messagesRouter
    .route('/')
    .get(authHelper.isLoggedInMessages, async (req, res, next) => {
        console.time('init');
        const pdwMode = nconf.get('messages:pdwMode');
        const adminShow = nconf.get('messages:adminShow');
        const hideCapcode = nconf.get('messages:HideCapcode');
        const hideSource = nconf.get('messages:HideSource');

        const limit = checkLimitRequest(req.query.limit);
        const page = checkPageRequest(req.query.page);

        console.timeEnd('init');
        console.time('db');

        const queryResult = await Message.query()
            .withGraphJoined(
                'alias',
                // If PDW mode is on, ensure that only matched alias are shown to non-admins.
                pdwMode && !(req.isAuthenticated() && adminShow && req.user.role === 'admin')
                    ? {
                          joinOperation: 'innerJoin',
                      }
                    : {
                          joinOperation: 'leftJoin',
                      }
            )
            .where('alias.ignore', false)
            .orWhereNull('alias.ignore')
            .page(page, limit)
            .orderBy('timestamp', 'DESC');

        console.timeEnd('db');
        console.time('postprocessing');

        /*
         * Constructs a new Response object
         * Packs some extra metadata regarding count of rows and pages as well as currently retrieved rows and pages
         * Ensures API security regarding hideCapcode and hideSource
         */
        const response = {
            init: createInitObject(page, limit, queryResult.total),
            messages: queryResult.results.map(message => {
                // Removing field 'alias_id' from response, because id is already included as alias.id and remove plugin configuration
                const omit = ['alias_id', 'alias.pluginconf'];

                // Remove capcodes and source if needed
                if (!req.isAuthenticated()) {
                    if (hideCapcode) omit.push('address', 'alias.address');
                    if (hideSource) omit.push('source');
                }
                return _.omit(message, omit);
            }),
        };
        console.timeEnd('postprocessing');
        console.time('send');
        res.send(response);
        console.timeEnd('send');
    })
    .post(authHelper.isAdmin, async (req, res, next) => {
        // TODO: Duplicate filtering is not yet implemented!
        console.time('before');
        const data = req.body;
        data.timestamp = data.datetime;
        data.pluginData = {};

        // Send to promise wrap of plugin handler
        const pluginResponseBefore = await pluginHandlerPromised('message', 'before', data);
        console.timeEnd('before');
        if (!pluginResponseBefore || !pluginResponseBefore.pluginData) {
            // only set data to the response if it's non-empty and still contains the pluginData object
        }
        logger.main.debug(`Plugin response: ${format('%o', pluginResponseBefore)}`);
        if (pluginResponseBefore.pluginData.ignore) {
            logger.main.debug('Row is ignored per plugin request');
            // stop processing
            res.status(200);
            return res.send('Ignoring filtered');
        }

        try {
            const insertRow = _.pick(pluginResponseBefore, ['message', 'source', 'timestamp', 'address', 'alias_id']);
            const result = await Message.query().insertAndFetch(insertRow);

            const pluginResponseAfter = await pluginHandlerPromised('message', 'after', result);
            // TODO: Socket handling is not yet implemented!

            res.send(pluginResponseAfter);
        } catch (e) {
            return next(e);
        }
    });

module.exports = messagesRouter;
