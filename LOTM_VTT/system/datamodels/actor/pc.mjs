import LOTM_VTTActor from "../../documents/actor.mjs";
import LOTM_VTTItem from "../../documents/item.mjs";
import UuidDocumentField from "../UuidDocumentField.mjs";
import UuidDocumentArrayField from "../UuidDocumentArrayField.mjs";

export default class PCTypeDataModel extends foundry.abstract.DataModel {
    /** @inheritDoc */
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new fields.HTMLField({required: false, blank: true, initial: ""}),
            hp: new fields.SchemaField({
                value: new fields.NumberField({min: -100, initial: 0, integer: true}),
                temp: new fields.NumberField({initial: 0, min: 0, integer: true}),
                max: new fields.NumberField({min: 0, initial: 100, integer: true}),
            }),
            
        };
    }

    /* -------------------------------------------- */

};
