import VueRenderingMixin from './VueRenderingMixin.mjs';
import { ActiveEffectApp } from "./components/components.vue.es.mjs";
const { DOCUMENT_OWNERSHIP_LEVELS } = CONST;
export default class LOTM_VTTEffectVueSheet extends VueRenderingMixin(foundry.applications.api.DocumentSheetV2) {
    
    vueParts = {
        "active-effect": {
            component: ActiveEffectApp,
            template: "<active-effect :context=\"context\">Vue rendering for sheet failed.</active-effect>"
        }
    };

    _arrayEntryKey = 0;
    _renderKey = 0;
    
    
    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["LOTM_VTT", "sheet", "vue-sheet", "active-effect", "active-effect-sheet"],
        viewPermission: DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
        editPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
        position: {
            width: 600,
            height: 600,
        },
        window: {
            resizable: true,
            title: "Active Effect"
        },
        tag: "form",
        actions: {
            onEditImage: this._onEditImage
        },
        changeActions: {
        },
        // Custom property that's merged into this.options
        dragDrop: [
        ],
        form: {
            handler: LOTM_VTTEffectVueSheet._onSubmitForm,
            submitOnChange: false,
            submitOnClose: true,
            closeOnSubmit: false
        }
    };

    /* -------------------------------------------- */

    static async _onEditImage(event, target) {
        // data-edit-path is used by the Vue drawer's <v-img> so Foundry's FormDataExtended
        // never serializes the wrapper div's innerHTML back into img. Fall back to data-edit
        // for any legacy <img data-edit> markup.
        const attr = target.dataset.editPath ?? target.dataset.edit;
        const current = foundry.utils.getProperty(this.document, attr);
        const fp = new FilePicker({
            current,
            type: "image",
            callback: (path) => {
                this.document.update({ [attr]: path });
            },
            top: this.position.top + 40,
            left: this.position.left + 10
        });
        return fp.browse();
    }

    /* -------------------------------------------- */

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        this.object = this.document.toObject();
        context.effect = this.object;
        context.descriptionHTML = await TextEditor.enrichHTML(this.object.description, {secrets: this.object.isOwner});
    
        // Status Conditions
        const statuses = CONFIG.statusEffects.map(s => {
          return {
            id: s.id,
            label: game.i18n.localize(s.name),
            selected: context.effect.statuses.includes(s.id) ? "selected" : ""
          };
        });
        context.statuses = statuses;
        if ( context.effect.origin ) {
            context.originLink = await TextEditor.enrichHTML("@UUID[" + context.effect.origin + "]");
        }
        
        function setValue(obj, access, value, mode) {
            if ( typeof(access)=='string' ) {
                access = access.split('.');
            }
            // Split up an access path into sub-objects, such as "system.attribute.value" => "system": {"attribute": {"value": ...}}
            if ( access.length > 1 ) {
                const key = access.shift();
                if ( !obj[key] ) obj[key] = {};
                setValue(obj[key], access, value, mode);
            }
            else {
                obj[access[0]] = value;
                obj[access[0] + "-mode"] = mode;
            }
        }

        // Turn the changes into the friendlier format
        for ( const change of context.effect.changes ) {
            setValue(context, change.key, change.value, change.mode);
        }
        
        // Output initialization
        const vueContext = {
            // Validates both permissions and compendium status
            editable: this.isEditable,
            owner: this.document.isOwner,
            limited: this.document.limited,

            // Add the document.
            object: context.effect,
            document: this.document,

            // Add the data to context.data for easier access, as well as flags.
            system: this.document.system,
            flags: this.document.flags,

            // Editors
            editors: {},

            // Force re-renders. Defined in the vue mixin.
            _renderKey: this._renderKey ?? 0,
            _arrayEntryKey: this._arrayEntryKey ?? 0,
            isItemEffect: this.document.parent.documentName === "Item",
            originLink: context.originLink
            // tabs: this._getTabs(options.parts),
        };
        
        await this._enrichEditor(vueContext, "description");
        
        const numberTypes = ['multiply', 'add', 'downgrade', 'upgrade', 'override'];
        const stringTypes = ['override'];
        const booleanTypes = ['override'];

        vueContext.numberModes = numberTypes.map(type => ({
            value: type,
            label: game.i18n.localize(`EFFECT.CHANGES.TYPES.${type}`)
        }));
        vueContext.numberModes.push({
            value: 'custom',
            label: game.i18n.localize("EFFECTS.AddOnce")
        });
        vueContext.basicNumberModes = numberTypes.map(type => ({
            value: type,
            label: game.i18n.localize(`EFFECT.CHANGES.TYPES.${type}`)
        }));
        vueContext.stringModes = stringTypes.map(type => ({
            value: type,
            label: game.i18n.localize(`EFFECT.CHANGES.TYPES.${type}`)
        }));
        vueContext.booleanModes = booleanTypes.map(type => ({
            value: type,
            label: game.i18n.localize(`EFFECT.CHANGES.TYPES.${type}`)
        }));
        vueContext.resourceModes = [
            { value: 'custom', label: game.i18n.localize("EFFECTS.AddOnce") }
        ];
        vueContext.trackerModes = [
            { value: 'custom', label: game.i18n.localize("EFFECTS.AddOnce") }
        ];

        // Copy current change values into vueContext so the Vue component can read them
        for ( const change of context.effect.changes ) {
            setValue(vueContext, change.key, change.value, change.mode);
        }

        console.dir("Vue Active Effect Context", vueContext);
        return vueContext;
    }
    
    
    async _enrichEditor(context, field) {
        const enrichmentOptions = {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: {},
            // Relative UUID resolution
            relativeTo: this.document
        };

        const editorOptions = {
            toggled: true,
            collaborate: true,
            documentUUID: this.document.uuid,
            height: 300
        };

        const editorValue = this.document.system?.[field] ?? foundry.utils.getProperty(this.document.system, field);
        context.editors[`${field}`] = {
            enriched: await TextEditor.enrichHTML(editorValue, enrichmentOptions),
            element: foundry.applications.elements.HTMLProseMirrorElement.create({
                ...editorOptions,
                name: `system.${field}`,
                value: editorValue ?? ""
            })
        };
    }
    
    /* -------------------------------------------- */
    
    _prepareSubmitData(event, form, formData) {
        // We don't modify the image via the sheet itself, so we can remove it from the submit data to avoid errors.
        delete formData.object.img;
        return super._prepareSubmitData(event, form, formData);
    }

    /* -------------------------------------------- */

    /**
     * Process form submission for the sheet
     * @this {LOTM_VTTEffectVueSheet}     The handler is called with the application as its bound scope
     * @param {SubmitEvent} event                     The originating form submission event
     * @param {HTMLFormElement} form                  The form element that was submitted
     * @param {FormDataExtended} formData             Processed data for the submitted form
     * @returns {Promise<void>}
     */
    static async _onSubmitForm(event, form, formData) {
        console.log("Updating Active Effect", formData);
        const flags = foundry.utils.duplicate(this.document.flags);
        if ( !flags["LOTM_VTT"] ) {
            flags["LOTM_VTT"] = {};
        }

        // Retrieve the existing effects.
        let changes = this.document.changes ? [...this.document.changes] : [];

        // Build an array of effects from the form data
        let newChanges = [];

        function addChange(documentName, key, customMode) {
            const value = foundry.utils.getProperty(formData.object, key);
            if ( value === undefined ) {
                // Field not rendered in the form - preserve any existing change.
                return;
            }
            if ( !value ) {
                // Field explicitly cleared (empty string / zero) - remove the change.
                changes = changes.filter(c => c.key !== key);
                return;
            }
            const type = foundry.utils.getProperty(formData.object, key + "-type") ?? 'add';
            newChanges.push({
                key: key,
                value: value,
                type: type
            });
            if ( customMode ) flags["LOTM_VTT"][key + "-custommode"] = customMode;
        }

        addChange("pc", "pc.system.hp.value", 1);
        addChange("pc", "pc.system.hp.max");
        addChange("pc", "pc.system.myloot");

        // Auto-generated damage type Active Effect fields

        // Update the existing changes to replace duplicates.
        for (let i = 0; i < changes.length; i++) {
            const newChange = newChanges.find(c => c.key == changes[i].key);
            if (newChange) {
                // Replace with the new change and update the array to prevent duplicates.
                changes[i] = newChange;
                newChanges = newChanges.filter(c => c.key != changes[i].key);
            }
        }

        // Filter changes for empty form fields.
        const finalChanges = changes.concat(newChanges).filter(c => c.value !== null && c.value !== undefined && c.value !== '');
        console.log("Active Effect Changes", finalChanges);
        await this.document.update({
            name: formData.object.name,
            description: formData.object.description ?? '',
            disabled: formData.object.disabled ?? false,
            transfer: formData.object.transfer ?? false,
            changes: finalChanges,
            flags: flags
        });

        // Rerender the parent sheets to update the effect lists.
        this.document.parent?.sheet?.render();
        if ( this.document.parent?.documentName === "Item" ) {
            this.document.parent?.parent?.applyActiveEffects();

            // Wait half a second
            await new Promise(r => setTimeout(r, 500));
            this.document.parent?.parent?.sheet?.render();
        }
    }
}
