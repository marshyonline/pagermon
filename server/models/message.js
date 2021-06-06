/* eslint-disable global-require */
const { Model } = require('objection');

class Message extends Model {
    static get tableName() {
        return 'messages';
    }

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

    static get virtualAttributes() {
        return ['wildcardMatch'];
    }

    get wildcardMatch() {
        if (!this.alias) {
            return 'No alias found';
        }
        return !Object.is(this.address, this.alias.address);
    }

    deleteAlias() {
        delete this.address();
        if (this.alias) delete this.alias.address;
    }
}

module.exports = Message;
