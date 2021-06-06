/* eslint-disable global-require */
const { Model } = require('objection');

class Alias extends Model {
    static get tableName() {
        return 'capcodes';
    }

    static get relationMappings() {
        const message = require('./message');
        return {
            messages: {
                relation: Model.HasManyRelation,
                modelClass: message,
                join: {
                    from: 'capcodes.id',
                    to: 'messages.alias_id',
                },
            },
        };
    }

    static get jsonAttributes() {
        return ['pluginconf'];
    }

    static get jsonSchema() {
        return {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                address: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                agency: { type: 'string' },
                color: { type: 'string' },
                pluginconf: { type: 'object' },
            },
        };
    }
}

module.exports = Alias;
