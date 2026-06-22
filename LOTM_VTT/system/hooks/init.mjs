import PCTypeDataModel from "../datamodels/actor/pc.mjs"
import LootTypeDataModel from "../datamodels/item/loot.mjs"
import PCVueSheet from "../sheets/vue/actor/pc-sheet.mjs"
import LootVueSheet from "../sheets/vue/item/loot-sheet.mjs"
import DataTableApp from "../sheets/vue/datatable-app.mjs";
import LOTM_VTTEffectVueSheet from "../sheets/vue/active-effect-sheet.mjs";
import LOTM_VTTActor from "../documents/actor.mjs";
import LOTM_VTTItem from "../documents/item.mjs";
import LOTM_VTTCombatant from "../documents/combatant.mjs";
import LOTM_VTTTokenDocument from "../documents/token.mjs";
import LOTM_VTTToken from "../canvas/token.mjs";
import LOTM_VTTRoll from "../rolls/roll.mjs";
import LOTM_VTTDamageRoll from "../rolls/damage-roll.mjs";
import DocumentCreationVueDialog from "../sheets/vue/document-creation-dialog.mjs";
import MeasuredTemplatePreview from "../placeables/measured-template-preview.mjs";

export function init() {
    console.log('LOTM_VTT | Initializing System');

    CONFIG.ActiveEffect.legacyTransferral = false;

    registerSettings();
    registerDataModels();
    registerDocumentSheets();
    registerDocumentClasses();
    registerPromptClasses();
    registerCanvasClasses();
    registerTypeInfo();
    registerHandlebarsHelpers();
    registerResourceBars();
    registerStatusEffects();
    registerMacroActions();
    registerKeywords();
    setupKeywordEnricher();
    registerUtils();
    //addVueImportMap();

    game.system.documentHooks = new Map();
    game.system.datatableApp = DataTableApp;
    game.system.rollClass = LOTM_VTTRoll;
    game.system.damageRollClass = LOTM_VTTDamageRoll;
    CONFIG.Dice.rolls.push(LOTM_VTTRoll);
    CONFIG.Dice.rolls.push(LOTM_VTTDamageRoll);
}

/* -------------------------------------------- */

function registerSettings() {

    game.settings.register('LOTM_VTT', 'createSystemJournal', {
        name: game.i18n.localize("SETTINGS.CreateSystemJournalName"),
        hint: game.i18n.localize("SETTINGS.CreateSystemJournalHint"),
        scope: 'world',
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register('LOTM_VTT', 'roundUpDamageApplication', {
        name: game.i18n.localize("SETTINGS.RoundUpDamageApplicationName"),
        hint: game.i18n.localize("SETTINGS.RoundUpDamageApplicationHint"),
        scope: 'world',
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register('LOTM_VTT', 'allowTargetDamageApplication', {
        name: game.i18n.localize('SETTINGS.AllowTargetDamageApplicationName'),
        hint: game.i18n.localize('SETTINGS.AllowTargetDamageApplicationHint'),
        scope: 'world',
        config: true,
        default: false,
        type: Boolean,
        requiresReload: true
    });

    game.settings.register('LOTM_VTT', 'userTargetDamageApplicationType', {
        scope: 'client',
        config: false,
        default: 'selected',
        type: String
    });

    game.settings.register('LOTM_VTT', 'damageApplicationChatCard', {
        name: game.i18n.localize('SETTINGS.DamageApplicationChatCardName'),
        hint: game.i18n.localize('SETTINGS.DamageApplicationChatCardHint'),
        scope: 'world',
        config: true,
        default: 'gm',
        type: String,
        choices: {
            'none': game.i18n.localize('SETTINGS.DamageApplicationChatCard.None'),
            'public': game.i18n.localize('SETTINGS.DamageApplicationChatCard.Public'),
            'gm': game.i18n.localize('SETTINGS.DamageApplicationChatCard.GM')
        }
    });

    game.settings.register('LOTM_VTT', 'hotReloadLastState', {
        scope: 'client',
        config: false,
        default: { openWindows: [] },
        type: Object
    });

    game.settings.register('LOTM_VTT', 'documentColorThemes', {
        scope: 'client',
        config: false,
        default: {},
        type: Object
    });

    game.settings.register('LOTM_VTT', 'documentLastState', {
        scope: 'client',
        config: false,
        default: {},
        type: Object
    });
    
    game.settings.register('LOTM_VTT', 'documentTableColumns', {
        scope: 'client',
        config: false,
        default: {},
        type: Object
    });

    // Author-declared settings (config { settings { ... } })
}

/* -------------------------------------------- */

function registerDataModels() {
    CONFIG.Actor.dataModels = {
        pc: PCTypeDataModel
    };

    CONFIG.Item.dataModels = {
        loot: LootTypeDataModel
    };
}

/* -------------------------------------------- */

function registerDocumentSheets() {
    Actors.unregisterSheet("core", ActorSheet);
    Items.unregisterSheet("core", ItemSheet);

    // Actors
    Actors.registerSheet("LOTM_VTT", PCVueSheet, {types: ["pc"], makeDefault: true});

    // Items
    Items.registerSheet("LOTM_VTT", LootVueSheet, {types: ["loot"], makeDefault: true});

    // Active Effects
    DocumentSheetConfig.registerSheet(ActiveEffect, "LOTM_VTT", LOTM_VTTEffectVueSheet, { makeDefault: true });
}

/* -------------------------------------------- */

function registerDocumentClasses() {
    CONFIG.Actor.documentClass = LOTM_VTTActor;
    CONFIG.Item.documentClass = LOTM_VTTItem;
    CONFIG.Combatant.documentClass = LOTM_VTTCombatant;
    CONFIG.Token.documentClass = LOTM_VTTTokenDocument;
    
    game.system.measuredTemplatePreviewClass = MeasuredTemplatePreview;
}

/* -------------------------------------------- */

function registerPromptClasses() {
    game.system.prompts = {
    };
    game.system.documentCreateDialog = DocumentCreationVueDialog;
}

/* -------------------------------------------- */

function registerCanvasClasses() {
    CONFIG.Token.objectClass = LOTM_VTTToken;
}

/* -------------------------------------------- */

function registerTypeInfo() {
    CONFIG.Actor.defaultType = "pc";
    CONFIG.Item.defaultType = "loot";

    CONFIG.Actor.typeArtworks = {
    };

    CONFIG.Item.typeArtworks = {
    };

    CONFIG.Actor.typeDescriptions = {
    }
    CONFIG.Item.typeDescriptions = {
    }

    CONFIG.Actor.typeCreatables = {
    }
    CONFIG.Item.typeCreatables = {
    }
}

/* -------------------------------------------- */

function registerHandlebarsHelpers() {

    // Convert a type and value to a localized label
    Handlebars.registerHelper("typeLabel", (type, value) => {
        return game.i18n.localize(CONFIG.SYSTEM[type][value]?.label);
    });

    // Truncate a string to a certain length with an ellipsis
    Handlebars.registerHelper("truncate", (str, len) => {
        if (str.length > len) {
            return `${str.slice(0, len)}...`;
        }
        return str;
    });

    // Get a property on an object using a string key
    Handlebars.registerHelper("getProperty", (obj, key) => {
        if (obj == null) return "";
        return foundry.utils.getProperty(obj, key);
    });

    // Humanize a string
    Handlebars.registerHelper("humanize", (str) => {
        let humanized = str.replace(/_/g, " ");
        humanized = humanized.replace("system.", "").replaceAll(".", " ");
        humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
        return humanized;
    });
}

/* -------------------------------------------- */

function registerResourceBars() {
    CONFIG.Actor.trackableAttributes = {
        "pc": {
            "bar": ["hp"],
            "value": []
        }
    };
}

/* -------------------------------------------- */

function registerStatusEffects() { 
    game.system.statusEffects = [];
}

/* -------------------------------------------- */

function registerMacroActions() {
    game.system.macroActions = {
    };
}

/* -------------------------------------------- */

function registerKeywords() {
    game.system.keywords = {
    };
}

/* -------------------------------------------- */

function setupKeywordEnricher() {
    // Register keyword text enricher
    CONFIG.TextEditor.enrichers.push({
        pattern: /@([a-zA-Z][a-zA-Z0-9]*)/gi,
        replaceParent: true,
        enricher: async (match, options) => {
            const keywordName = match[1].toLowerCase();
            const keyword = game.system.keywords[keywordName];
            
            if (!keyword) return null;
            
            // Find the system documentation journal and determine which page the keyword is on
            const keywordsJournal = game.journal.find(j => j.getFlag('LOTM_VTT', 'systemJournal') === true || j.getFlag('core', 'keywordsJournal') === true);
            const isDamageType = keyword.type === 'damage-type';
            const pageType = isDamageType ? 'damage-types' : 'keywords';
            const targetPage = keywordsJournal?.pages.find(p => p.getFlag('core', 'pageType') === pageType);
            
            const element = document.createElement('span');
            element.className = 'keyword-reference';
            element.setAttribute('data-keyword', keywordName);
            element.setAttribute('data-journal-uuid', keywordsJournal?.uuid || '');
            element.setAttribute('data-page-uuid', targetPage?.uuid || '');
            element.setAttribute('data-anchor', keywordName);
            element.title = keyword.description;
            
            if (keyword.icon) {
                const icon = document.createElement('i');
                icon.className = keyword.icon;
                icon.style.color = keyword.color;
                element.appendChild(icon);
            }
            
            element.appendChild(document.createTextNode(keyword.name));
            
            return element;
        }
    });
    
    // Register click handler for keyword references
    $(document).on('click', '.keyword-reference', async function() {
        const journalUuid = $(this).data('journal-uuid');
        const pageUuid = $(this).data('page-uuid');
        const anchor = $(this).data('anchor');
        
        if (journalUuid && pageUuid) {
            const journal = await fromUuid(journalUuid);
            const page = await fromUuid(pageUuid);
            if (journal && page) {
                journal.sheet.render(true, {pageId: page.id, anchor: anchor});
            }
        } else if (journalUuid) {
            const journal = await fromUuid(journalUuid);
            journal?.sheet.render(true);
        }
    });
}

/** -------------------------------------------- */

function addVueImportMap() {
    let script = document.createElement('script');
    script.type = 'importmap';
    script.text = `{
        "imports": {
            "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
        }
    }`;
    document.head.appendChild(script);
}

/* -------------------------------------------- */

function registerUtils() {
    game.system.utils = {};

    function flattenObject(obj, _d=0) {
        const flat = {};
        if ( _d > 100 ) {
            throw new Error("Maximum depth exceeded");
        }
        for ( let [k, v] of Object.entries(obj) ) {
            let t = foundry.utils.getType(v);
            if ( t === "Object" ) {
                if ( k == "parent" ) continue;
                if ( foundry.utils.isEmpty(v) ) flat[k] = v;
                let inner = flattenObject(v, _d+1);
                for ( let [ik, iv] of Object.entries(inner) ) {
                    flat[`${k}.${ik}`] = iv;
                }
            }
            else flat[k] = v;
        }
        return flat;
    }

    game.system.utils.flattenObject = flattenObject;

    function toNearest(interval=1, method="round") {
        if (!Number.isNumeric(this)) {
            throw new Error("toNearest() must be called on a numeric looking value");
        }
        const number = Number.fromString(this);
        return number.toNearest(interval, method);
    }

    Object.defineProperties(String.prototype, {
        toNearest: {value: toNearest}
    });

    async function callAllAsync(hook, ...args) {
        if ( CONFIG.debug.hooks ) {
            console.log(`DEBUG | Calling async ${hook} hook with args:`);
            console.log(args);
        }
        const events = Hooks.events;
        if ( !(hook in events) ) return true;
        for ( const entry of Array.from(events[hook]) ) {
            await entry.fn(...args);
        }
        return true;
    }

    Hooks.callAllAsync = callAllAsync;
    
    let audioSources = new Map();
    let gainNodes = new Map();
    
    async function playAudio(id, url, onEndCallback, volume=0.5) {
        let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let source = audioCtx.createBufferSource();
        let gainNode = audioCtx.createGain();
        audioSources.set(id, source);
        gainNodes.set(id, gainNode);
        source.connect(gainNode).connect(audioCtx.destination);

        let request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        request.onload = () => {
            let audioData = request.response;
            audioCtx.decodeAudioData(audioData,
                (buffer) => {
                    source.buffer = buffer;
                    gainNode.gain.value = volume;
                    source.start(0);
                    source.onended = () => {
                        audioSources.delete(id);
                        gainNodes.delete(id);
                        onEndCallback();
                    };
                },
                (e) => {
                    ui.notifications.error("An error occurred while decoding audio data");
                    console.log(url);
                    console.log(audioData);
                    console.log(e);
                    onEndCallback();
                });
        };
        try {
            request.send();
        }
        catch (e) {
            console.error("Error playing sound effect:", e);
            onEndCallback();
        }
    }
    
    async function playSfx(url, volume=0.5) {
        // Invoke the playAudio function with the provided parameters and wait for it to complete vis the onEndCallback
        let finishedPromise = new Promise(async (resolve) => {
            let onEndCallback = () => {
                resolve();
            };
            // Attach base url
            if (!url.startsWith("http")) {
                url = `${window.location.origin}/systems/LOTM_VTT/${url}`;
            }
            
            await playAudio(foundry.utils.randomID(), url, onEndCallback, volume);
        });
        return finishedPromise;
    }
    game.system.utils.playSfx = playSfx;
}
