const express = require('express');
const Messages = require('../../../models/message');
const nconf = require('nconf');
const authHelper = require('../../../middleware/authhelper');
const _ = require('lodash');
const logger = require('../../../log');

const confFile = './config/config.json';
nconf.file({ file: confFile }).load();
const messagesRouter = express.Router();

messagesRouter.use(function(req, res, next) {
    res.locals.login = req.isAuthenticated();
    res.locals.user = req.user || false;
    next();
});

messagesRouter.route('/').get(authHelper.isLoggedInMessages, async (req, res, next) => {
    console.time('init');
    const pdwMode = nconf.get('messages:pdwMode');
    const adminShow = nconf.get('messages:adminShow');
    const hideCapcode = nconf.get('messages:HideCapcode');
    const hideSource = nconf.get('messages:HideSource');
    const maxLimit = nconf.get('messages:maxLimit');
    const defaultLimit = nconf.get('messages:defaultLimit');
    const replaceText = nconf.get('messages:replaceText');

    /* Parse requested page and limit and reset to default if not readable or reset to max if exceeding max */
    const requestedLimit = parseInt(req.query.limit);
    const requestedPage = parseInt(req.query.page);

    let limit = defaultLimit;
    if (!Number.isNaN(requestedLimit)) {
        if (requestedLimit > maxLimit)
            return next(
                new Error(`Limit request for message list must not exceed ${maxLimit} with current server settings`)
            );
        limit = requestedLimit;
    }

    let page = 0;
    if (!Number.isNaN(requestedPage)) {
        if (requestedPage < 0) return next(new Error('Requested page is negative'));
        page = requestedPage - 1;
    }

    logger.main.debug(
        `Page: cur ${page} reqP ${requestedPage} \nLimit: cur ${limit} reqP ${requestedLimit} def ${defaultLimit} max ${maxLimit}`
    );

    console.timeEnd('init');
    console.time('db');

    const queryResult = await Messages.query()
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
        init: {
            currentPage: page + 1,
            limit,
            msgCount: queryResult.total,
            offset: page * limit,
            offsetEnd: page * limit + limit >= queryResult.total ? queryResult.total : page * limit + limit,
            pageCount: Math.ceil(queryResult.total / limit),
            replaceText,
        },
        messages: queryResult.results.map(message => {
            // Removing field 'alias_id' from response, because id is included as alias.id and remove plugin configuration
            const omit = ['alias_id', 'alias.pluginconf'];
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
});

module.exports = messagesRouter;
