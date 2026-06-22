export default class UuidDocumentField extends foundry.data.fields.StringField {

    /** @inheritdoc */
    static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
        required: true,
        blank: false,
        nullable: true,
        initial: null,
        readonly: false,
        validationError: "is not a valid Document UUID string"
    });
    }

    /** @override */
    _cast(value) {
        if ( value instanceof foundry.abstract.Document ) return value.uuid;
        else return String(value);
    }

    /** @inheritdoc */
    initialize(value, model, options={}) {
        if ( !game.collections ) return value; // server-side

        return () => fromUuidSync(value);
    }
}
