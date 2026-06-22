import LOTM_VTTActor from "../../documents/actor.mjs";
import LOTM_VTTItem from "../../documents/item.mjs";
import UuidDocumentField from "../UuidDocumentField.mjs";
import UuidDocumentArrayField from "../UuidDocumentArrayField.mjs";

export default class LootTypeDataModel extends foundry.abstract.DataModel {
    /** @inheritDoc */
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new fields.HTMLField({required: false, blank: true, initial: ""}),
            value: new fields.NumberField({integer: true, initial: 0, min: 0}),
            
            pinned: new fields.BooleanField({initial: false}),
        };
    }

    /* -------------------------------------------- */

};
