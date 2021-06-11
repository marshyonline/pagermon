/* eslint-disable global-require */
const { Model, NotFoundError } = require('objection');
const logger = require('../log');

class Message extends Model {
    static get tableName() {
        return 'messages';
    }

    // Stores the relation to the capcode table
    static get relationMappings() {
        const alias = require('./alias');
        return {
            alias: {
                relation: Model.BelongsToOneRelation,
                modelClass: alias,
                join: {
                    from: 'messages.alias_id',
                    to: 'capcodes.id',
                },
            },
        };
    }

    // Includes virtual wildcardMatch attribute in result rows
    static get virtualAttributes() {
        return ['wildcardMatch'];
    }

    // Ensures alias match, before row is stored
    async $beforeInsert(queryContext) {
        await super.$beforeInsert(queryContext);
        // Only proceed, if no alias_id is set, for example by plugin or explicit request
        if (this.alias_id) return;
        // Match alias and abort, if alias is set to ignore
        await this.matchAlias(queryContext);
        if (this.alias && this.alias.ignore) {
            logger.main.debug(`Alias is ignored`);
            throw new Error('Alias is ignored');
        }
    }

    // Ensures alias match, before row is updated
    async $beforeUpdate(opt, queryContext) {
        await super.$beforeUpdate(opt, queryContext);

        if (opt.old.address === this.address) return;

        await this.matchAlias(queryContext);
        if (this.alias.ignore) {
            throw new Error('New alias is ignored!');
        }
        // Continue, if alias is not set to ignore and set alias_id to aliasses id
        this.alias_id = this.alias.id;
    }

    // Returns true, if alias match was due to wildcard character
    get wildcardMatch() {
        if (!this.alias) {
            return undefined;
        }
        return !Object.is(this.address, this.alias.address);
    }

    static get jsonSchema() {
        return {
            required: ['address', 'message', 'source'],
            type: 'object',
            properties: {
                id: { type: 'integer' },
                address: { type: 'string' },
                message: { type: 'string' },
                source: { type: 'string' },
                timestamp: { type: 'string' },
                alias_id: { type: 'integer' },
                changed: { type: 'integer' },
            },
        };
    }

    // Re-Match alias before storing anything
    async matchAlias(queryContext) {
        const Alias = require('./alias');
        try {
            this.alias = await Alias.query(queryContext)
                .whereRaw(`${this.address} LIKE \`address\``)
                .orderByRaw(`REPLACE(address, '_', '%') DESC`)
                .first()
                .throwIfNotFound();
            this.alias_id = this.alias.id;
        } catch (e) {
            if (e instanceof NotFoundError) {
                this.alias_id = null;
                return;
            }
            throw e;
        }
    }
}

module.exports = Message;
