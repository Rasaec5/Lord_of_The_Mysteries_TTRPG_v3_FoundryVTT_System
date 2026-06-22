export default class LOTM_VTTTokenDocument extends TokenDocument {
    /** @inheritDoc */
    getBarAttribute(barName, options={}) {
        const data = super.getBarAttribute(barName, options);
        if ( data === null ) return;
        const resource = foundry.utils.getProperty(this.actor.system, data.attribute);
        data.value += resource.temp;
        return data;
    }

    _onUpdateBaseActor(update={}, options={}) {
        if (foundry.utils.isEmpty(update)) return;
        if (!this.isEditable) return;
        super._onUpdateBaseActor(update, options);
    }
}
