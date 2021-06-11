const nconf = require('nconf');
const pluginHandler = require('../../../plugins/pluginHandler');

const confFile = './config/config.json';
nconf.file({ file: confFile }).load();

/**
 * Checks, if the consumers row limit request is valid and does not exceed the defined maximum
 * @param {number} req The consumers requested row limit
 * @returns {number} If the request is invalid, the default, if it exceeds the max, the max and else the request
 */
function checkLimitRequest(req) {
    const def = nconf.get('messages:defaultLimit');
    const max = nconf.get('messages:maxLimit');
    const reqParsed = parseInt(req);
    if (Number.isNaN(reqParsed)) return def;
    if (max !== null && reqParsed > max) return max;
    return reqParsed;
}

/**
 * Checks, if the consumers page request is valid and does not exceed the defined maximum
 * @param {number} req The consumers requested page
 * @returns {number} If request is valid the request, else 0
 */
function checkPageRequest(req) {
    const reqParsed = parseInt(req);
    if (Number.isNaN(reqParsed)) return 0;
    return reqParsed - 1;
}

/**
 * Returns a completed Init object used by the frontend for paginated and hightlight related display things
 * @param {number} page Current page, zero based
 * @param {number} limit Current row limit
 * @param {number} total Number of rows in total
 * @returns {Object} Object containting current page one based, limit, total row number, start and end of current selection, number of pages and highlight objects
 */
function createInitObject(page, limit, total) {
    const replaceText = nconf.get('messages:replaceText');
    return {
        currentPage: page + 1,
        limit,
        msgCount: total,
        offset: page * limit,
        offsetEnd: page * limit + limit >= total ? total : page * limit + limit,
        pageCount: Math.ceil(total / limit),
        replaceText,
    };
}

function pluginHandlerPromised(event, scope, data) {
    return new Promise(resolve => {
        pluginHandler.handle(event, scope, data, result => {
            resolve(result);
        });
    });
}

module.exports = { checkLimitRequest, checkPageRequest, createInitObject, pluginHandlerPromised };
