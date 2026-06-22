<script setup>
    import { ref, watch, inject, computed, watchEffect } from "vue";
    import PCPCMyLootVuetifyDatatable from './components/datatables/pcPCMyLootVuetifyDatatable.vue';
    import PCEffectsVuetifyDatatable from './components/datatables/pcEffectsVuetifyDatatable.vue';
    import LOTM_VTTRoll from "../../../../rolls/roll.mjs";

    const document = inject('rawDocument');
    const props = defineProps(['context']);

    // Colors
    // Defaults come from the system theme (theme primary/secondary/tertiary tokens);
    // when the theme doesn't set them they fall back to the built-in palette. These feed
    // the Vuetify :color props on fields. userColorsEnabled mirrors the userColors config.
    const userColorsEnabled = true;
    const defaultPrimaryColor = '#1565c0';
    const defaultSecondaryColor = '#4db6ac';
    const defaultTertiaryColor = '#ffb74d';

    let storedColors = game.settings.get('LOTM_VTT', 'documentColorThemes');
    const documentColors = userColorsEnabled ? (storedColors[document.uuid] ?? {}) : {};
    const primaryColor = ref(documentColors.primary ?? defaultPrimaryColor);
    const secondaryColor = ref(documentColors.secondary ?? defaultSecondaryColor);
    const tertiaryColor = ref(documentColors.tertiary ?? defaultTertiaryColor);

    // Track which colors the user has explicitly chosen. Only an explicit choice is
    // emitted as a CSS variable (below) so it can override the theme default; the ref
    // defaults must NOT leak to --isdl-* or an unthemed sheet would gain a colored edge.
    const primarySet = ref(documentColors.primary != null);
    const secondarySet = ref(documentColors.secondary != null);
    const tertiarySet = ref(documentColors.tertiary != null);

    // User-chosen colors override the theme's --isdl-primary/secondary/tertiary for this
    // document. Bound inline on <v-app>, which sits inside .LOTM_VTT.vue-application, so it wins
    // over the theme.css defaults for every descendant field. Keys are omitted unless chosen.
    const userColorVars = computed(() => {
        const vars = {};
        if (primarySet.value) vars['--isdl-primary'] = primaryColor.value;
        if (secondarySet.value) vars['--isdl-secondary'] = secondaryColor.value;
        if (tertiarySet.value) vars['--isdl-tertiary'] = tertiaryColor.value;
        return vars;
    });

    const setupColors = () => {
        const colors = {
            primary: primaryColor.value,
            secondary: secondaryColor.value,
            tertiary: tertiaryColor.value
        };
        game.settings.set('LOTM_VTT', 'documentColorThemes', { ...storedColors, [document.uuid]: colors });
    };
    const resetColors = () => {
        primaryColor.value = defaultPrimaryColor;
        secondaryColor.value = defaultSecondaryColor;
        tertiaryColor.value = defaultTertiaryColor;
        primarySet.value = false;
        secondarySet.value = false;
        tertiarySet.value = false;
        let updated = { ...storedColors };
        delete updated[document.uuid];
        storedColors = updated;
        game.settings.set('LOTM_VTT', 'documentColorThemes', updated);
    };

    watch(primaryColor, () => {
        primarySet.value = true;
        setupColors();
    });
    watch(secondaryColor, () => {
        secondarySet.value = true;
        setupColors();
    });
    watch(tertiaryColor, () => {
        tertiarySet.value = true;
        setupColors();
    });

    // Pages and Tabs
    const lastStates = game.settings.get('LOTM_VTT', 'documentLastState');
    const lastState = lastStates[document.uuid] ?? {
        page: 'pc',
        tab: 'description'
    };

    const drawer = ref(false);
    const page = ref(lastState.page);
    const tab = ref(lastState.tab);
    const pageDefaultTabs = {
        'pc': 'description'
    };

    const updateLastState = () => {
        const lastStates = game.settings.get('LOTM_VTT', 'documentLastState');
        lastStates[document.uuid] = { page: page.value, tab: tab.value };
        game.settings.set('LOTM_VTT', 'documentLastState', lastStates);
    };

    // When the page changes, reset the tab to the first tab on that page
    watch(page, () => {
        tab.value = pageDefaultTabs[page.value.toLowerCase()];
        document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
        // Dismiss the drawer when the page changes
        drawer.value = false;
        updateLastState();
    });

    watch(tab, () => {
        try {
            if (document.sheet?.element) {
                document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
            }
        }
        catch {}
        updateLastState();
    });

    const pageBackgrounds = {
        'pc': 'topography',
    };

    const pageBackground = computed(() => {
        if (editModeRef.value) {
            return 'edit-mode';
        }
        if (props.context.system.dead) {
            return 'dead';
        }
        return pageBackgrounds[page.value];
    });

    // Edit Mode
    const editModeRef = ref(document.getFlag('LOTM_VTT', 'edit-mode') ?? true);
    const hovered = ref(false);

    const toggleEditMode = () => {
        editModeRef.value = !editModeRef.value;
        document.setFlag('LOTM_VTT', 'edit-mode', editModeRef.value);
    };

    

    function spawnDatatableWindow(e, pageName, tabName) {
        if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
            const tableName = `actorPC${pageName}${tabName}`;
            const systemName = "system." + tabName.toLowerCase();
            const sheet = new game.system.datatableApp(document, tableName, systemName, tabName);
            sheet.render(true);
        }
    }

    // Effects
    const effects = ref([]);

    function updateEffects() {
        effects.value = Array.from(document.allApplicableEffects());
    }

    updateEffects();

    Hooks.on("createActiveEffect", updateEffects);
    Hooks.on("updateActiveEffect", updateEffects);
    Hooks.on("deleteActiveEffect", updateEffects);
    
    // Combat
    const currentCombatant = ref(game.combat?.combatant);
    Hooks.on("combatTurnChange", () => {
        currentCombatant.value = game.combat?.combatant;
    });

    // Paper Doll Slots

    // Visibility states
    const visibilityStates = {
        'hp': computed(() => {
            return 'default';
        })
        ,
        'myloot': computed(() => {
            return 'default';
        })
        ,
    };

    // Computed fields mapping
    const computedFields = {
        'hp': false,
        'myloot': false
        ,
    };


    const isHidden = (type) => {
        const visibility = visibilityStates[type].value;
        if (visibility === "hidden") {
            return true;
        }
        if (visibility === "gmOnly") {
            return !game.user.isGM;
        }
        if (visibility === "secret") {
            const isGm = game.user.isGM;
            const isOwner = document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            return !isGm && !isOwner;
        }
        if (visibility === "edit") {
            return !editModeRef.value;
        }
        if (visibility === "play") {
            return editModeRef.value;
        }

        // Default to visible
        return false;
    };

    const isDisabled = (type) => {
        // Computed fields are always disabled
        if (computedFields[type]) {
            //console.log(type + " is computed and disabled");
            return true;
        }
        
        const visibility = visibilityStates[type].value;
        const disabledStates = ["readonly", "locked"];
        if (disabledStates.includes(visibility)) {
            //console.log(type + " is readonly / locked and disabled");
            return true;
        }
        if (visibility === "gmEdit") {
            const isGm = game.user.isGM;
            const isEditMode = editModeRef.value;
            return !isGm && !isEditMode;
        }

        if (visibility === "unlocked") {
            //console.log(type + " is unlocked and enabled");
            return false;
        }
        
        // Default to enabled while in editMode
        return !editModeRef.value;
    };

    const getLabel = (label, icon) => {
        const localized = game.i18n.localize(label);
        if (icon) {
            return `<i class="${icon}"></i> ${localized}`;
        }
        return localized;
    };
    
    // Attribute roll methods
</script>
<style>
</style>
<template>
    <v-app :style="userColorVars">
        <!-- App Bar -->
        <v-app-bar :color="editModeRef ? 'amber-accent-3' : primaryColor" density="comfortable">
            <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
            <v-app-bar-title v-if="!editModeRef">{{ context.document.name }}</v-app-bar-title>
            <v-text-field name="name" v-model="context.document.name" variant="outlined" class="document-name" v-if="editModeRef" density="compact"></v-text-field>
            <v-alert :text="game.i18n.localize('EditModeWarning')" type="warning" density="compact" class="ga-2 ma-1" color="amber-accent-3" v-if="editModeRef"></v-alert>
            <template v-slot:append>
                <v-btn
                    :icon="hovered ? (editModeRef ? 'fa-solid fa-dice-d20' : 'fa-solid fa-pen-to-square') : (editModeRef ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-dice-d20')"
                    @click="toggleEditMode"
                    @mouseover="hovered = true"
                    @mouseleave="hovered = false"
                    :data-tooltip="editModeRef ? 'Swap to Play mode' : 'Swap to Edit mode'"
                ></v-btn>
            </template>
        </v-app-bar>

        <!-- Navigation Drawer -->
        <v-navigation-drawer v-model="drawer" temporary style="background-color: #dddddd">
            <v-img :src="context.document.img" style="background-color: lightgray" data-edit='img' data-action='onEditImage'>
                                <template #error>
                                    <v-img src="/systems/LOTM_VTT/img/missing-character.png" data-edit='img' data-action='onEditImage'></v-img>
                                </template>
                            </v-img>
            <v-tabs v-model="page" direction="vertical">
                <v-tab value="pc" prepend-icon="fa-solid fa-circle-user">PC</v-tab>
            </v-tabs>
            <template v-slot:append>
                <div class="pa-2" >
                    <v-btn block @click="setupColors" :color="secondaryColor" prepend-icon="fa-solid fa-palette">
                    Setup Colors

                    <v-dialog activator="parent" max-width="1000">
                    <template v-slot:default="{ isActive }">
                    <v-card
                        title="Setup Colors"
                    >
                        <v-card-text>
                            <div class="d-flex flex-row">
                                <div class="d-flex flex-column">
                                    <v-label>Primary Color</v-label>
                                    <v-color-picker hide-inputs hide-sliders hide-canvas show-swatches v-model="primaryColor" swatches-max-height="500px"></v-color-picker>
                                </div>
                                <v-spacer></v-spacer>
                                <div class="d-flex flex-column">
                                    <v-label>Secondary Color</v-label>
                                    <v-color-picker hide-inputs hide-sliders hide-canvas show-swatches v-model="secondaryColor" swatches-max-height="500px"></v-color-picker>
                                </div>
                                <v-spacer></v-spacer>
                                <div class="d-flex flex-column">
                                    <v-label>Tertiary Color</v-label>
                                    <v-color-picker hide-inputs hide-sliders hide-canvas show-swatches v-model="tertiaryColor" swatches-max-height="500px"></v-color-picker>
                                </div>
                            </div>
                            <h3>Preview</h3>
                            <div class="d-flex flex-row"style="overflow-x: scroll; padding-left: 0.5rem; padding-right: 0.5rem;">
                                <div
                                    v-for="i in 10"
                                    :key="i"
                                    :style="{
                                        flex: 1,
                                        minWidth: '5px',
                                        flexShrink: 0,
                                        height: '30px',
                                        backgroundColor: i <= 4 ? primaryColor : (i <= 6 ? tertiaryColor : 'transparent'),
                                        border: i <= value ? 'none' : '2px solid ' + secondaryColor,
                                        transform: 'skewX(-20deg)',
                                        borderRadius: '2px'
                                    }"
                                />
                            </div>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn
                                variant="tonal"
                                prepend-icon="fa-solid fa-sync"
                                text="Reset"
                                :color="secondaryColor"
                                @click="resetColors"
                            ></v-btn>
                        </v-card-actions>
                    </v-card>
                    </template>
                </v-dialog>
                    </v-btn>
                </div>
            </template>
        </v-navigation-drawer>

        <!-- Main Content -->
        <v-main class="d-flex">
            <v-container :key="editModeRef" :class="pageBackground" fluid>
                <v-tabs-window v-model="page">
                    <v-tabs-window-item value="pc" data-tab="pc">
                        <v-row dense>
                            <i-tracker class="isdl-field isdl-resource isdl-field-hp isdl-visibility-default"
    label="PC.HP"
    
    systemPath="system.hp" :context="context"
    :visibility="visibilityStates['hp'].value"
    :editMode="editModeRef"
    :primaryColor="primaryColor" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor"
    
    trackerStyle="bar"
    icon=""
    :hideMin="true"
    :disableMin="false"
    :disableValue="false"
    :disableMax="false"
    :segments="1"
    :isHealth="true"
    :isWounds="false"
    ></i-tracker>

                        </v-row>
                        <v-divider class="mt-4 mb-2"></v-divider>
                        <v-tabs v-model="tab" grow always-center>
                                <v-tab value="description" prepend-icon="fa-solid fa-book">Description</v-tab>
                                <v-tab v-if="!isHidden('myloot')" value="myloot" prepend-icon="fa-solid fa-table" @mousedown="spawnDatatableWindow($event, 'PC', 'MyLoot')">{{ game.i18n.localize('PC.MyLoot') }}</v-tab>
                                <v-tab value="effects" prepend-icon="fa-solid fa-sparkles" @mousedown="spawnDatatableWindow($event, 'PC', 'effects')">Effects</v-tab>
                        </v-tabs>
                        <v-tabs-window v-model="tab" class="tabs-window">
                            <v-tabs-window-item value="description" data-tab="description" class="tabs-container">
                                <i-prosemirror :field="context.editors['system.description']" :disabled="!editModeRef"></i-prosemirror>
                            </v-tabs-window-item>
                            <v-tabs-window-item v-if="!isHidden('myloot')" value="myloot" data-tab="myloot" data-type="table" class="tabs-container">
                                <PCPCMyLootVuetifyDatatable systemPath="system.myloot" :context="context" :primaryColor="primaryColor" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor"></PCPCMyLootVuetifyDatatable>
                            </v-tabs-window-item>

                            <v-tabs-window-item value="effects" data-tab="effects" class="tabs-container">
                                <PCEffectsVuetifyDatatable 
                                    :context="context"
                                    :primaryColor="primaryColor"
                                    :secondaryColor="secondaryColor"
                                    :tertiaryColor="tertiaryColor"
                                />
                            </v-tabs-window-item>
                        </v-tabs-window>
                    </v-tabs-window-item>
                </v-tabs-window>
            </v-container>
        </v-main>
    </v-app>
</template>
