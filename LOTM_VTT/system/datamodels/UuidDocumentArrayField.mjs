export default class UuidDocumentArrayField extends foundry.data.fields.ArrayField {

    constructor(options = {}) {
        super(new foundry.data.fields.StringField({
            required: false,
            blank: false,
            nullable: false,
            initial: null,
            readonly: false,
            validationError: "is not a valid Document UUID string"
        }), foundry.utils.mergeObject({
            initial: []
        }, options));
    }

    /** @override */
    _cast(value) {
        if (!Array.isArray(value)) return [];
        return value.map(item => {
            if (item instanceof foundry.abstract.Document) return item.uuid;
            return String(item);
        }).filter(uuid => uuid && uuid !== "null" && uuid !== "undefined");
    }

    /** @inheritdoc */
    initialize(value, model, options={}) {
        if (!game.collections) return value; // server-side
        if (!Array.isArray(value)) return [];

        return () => { 
            return value.map(uuid => {
                if (!uuid || uuid === "null" || uuid === "undefined") return null;
                return fromUuidSync(uuid);
            }).filter(Boolean);
        }
    }
}
