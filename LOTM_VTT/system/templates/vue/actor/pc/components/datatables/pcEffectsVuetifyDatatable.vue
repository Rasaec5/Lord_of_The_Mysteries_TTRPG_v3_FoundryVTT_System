    <script setup>
        import { ref, computed, inject, onMounted } from "vue";

        const props = defineProps({
            context: Object,
            primaryColor: String,
            secondaryColor: String,
            tertiaryColor: String
        });
        
        const document = inject('rawDocument');
        const search = ref('');
        const loading = ref(false);
        
        const data = ref([]);

        function updateEffects() {
            data.value = Array.from(document.allApplicableEffects());
        }

        updateEffects();

        Hooks.on("createActiveEffect", updateEffects);
        Hooks.on("updateActiveEffect", updateEffects);
        Hooks.on("deleteActiveEffect", updateEffects);
        
        const headers = [
            { 
                title: game.i18n.localize("Image"), 
                key: 'img', 
                sortable: false,
                width: '50px',
                maxWidth: '50px'
            },
            { 
                title: game.i18n.localize("Name"), 
                key: 'name', 
                sortable: true,
                minWidth: '120px'
            },
            { 
                title: game.i18n.localize("Source"), 
                key: 'source', 
                sortable: true,
                minWidth: '120px'
            },
            { 
                title: game.i18n.localize("Duration"), 
                key: 'duration', 
                sortable: true,
                minWidth: '100px'
            },
            { 
                title: game.i18n.localize("Actions"), 
                key: 'actions', 
                sortable: false,
                width: '150px',
                align: 'center'
            }
        ];

        const editItem = (item) => {
            const foundryItem = document.effects.get(item._id);
            foundryItem.sheet.render(true);
        };

        const toggleEffect = async (item) => {
            const update = {
                _id: item._id,
                disabled: !item.disabled
            };
            item.disabled = !item.disabled;
            document.updateEmbeddedDocuments("ActiveEffect", [update]);
        };

        const deleteEffect = async (item) => {
            const shouldDelete = await Dialog.confirm({
                title: "Delete Confirmation",
                content: `<p>Are you sure you would like to delete the "${item.name}" Effect?</p>`,
                defaultYes: false
            });
            if (shouldDelete) {
                await document.deleteEmbeddedDocuments("ActiveEffect", [item.id]);
                // Don't call updateEffects() here as the Hooks will handle it
            };
        };

        const addNewEffect = async () => {
            loading.value = true;
            try {
                const effects = await ActiveEffect.createDocuments([{
                    name: "New Effect",
                    icon: "icons/svg/aura.svg"
                }], {parent: document});
                
                if (effects && effects[0]) {
                    effects[0].sheet.render(true);
                    updateEffects();
                }
            } catch (error) {
                console.error("Error creating effect:", error);
                ui.notifications.error("Failed to create new effect");
            } finally {
                loading.value = false;
            }
        };
        
        const formatDuration = (effect) => {
            if (!effect.duration) return "Permanent";
            if (effect.duration.type === "none") return "Permanent";
            if (effect.duration.type === "turns") {
                return `${effect.duration.remaining} turns`;
            }
            if (effect.duration.type === "seconds") {
                return `${effect.duration.remaining} seconds`;
            }
            return "Temporary";
        };
    </script>

    <template>
        <v-card flat class="isdl-datatable">
            <v-card-title class="d-flex align-center pe-1" style="height: 40px;">
                <v-icon icon="fa-solid fa-sparkles" size="small" />
                &nbsp; {{ game.i18n.localize("Effects") }}
                <v-spacer></v-spacer>
                <v-text-field
                        v-model="search"
                        density="compact"
                        label="Search"
                        prepend-inner-icon="fa-solid fa-magnify"
                        variant="outlined"
                        flat
                        hide-details
                        single-line
                        clearable
                        style="margin: 0; margin-right: 8px;"
                ></v-text-field>
                <v-btn
                    :color="primaryColor || 'primary'"
                    prepend-icon="fa-solid fa-plus"
                    rounded="0"
                    size="small"
                    :loading="loading"
                    @click="addNewEffect"
                    style="max-width: 80px; height: 38px;"
                >
                    {{ game.i18n.localize("Add") }}
                </v-btn>
            </v-card-title>
            <v-divider></v-divider>
            
            <v-data-table
                v-model:search="search"
                :headers="headers"
                :items="data"
                :search="search"
                hover
                density="compact"
                hide-default-footer
                style="background: none;"
                class="custom-datatable"
            >
                <!-- Image slot -->
                <template v-slot:item.img="{ item }">
                    <v-avatar size="40" rounded="0">
                        <v-img :src="item.img ?? item.icon" :alt="item.name" cover></v-img>
                    </v-avatar>
                </template>

                <!-- Name slot -->
                <template v-slot:item.name="{ item }">
                    <div class="d-flex align-center">
                        <div class="font-weight-medium text-truncate" style="min-width: 120px; max-width: 200px;">{{ item.name }}</div>
                    </div>
                </template>

                <!-- Source slot -->
                <template v-slot:item.source="{ item }">
                    <v-chip
                        label
                        size="x-small"
                        variant="elevated"
                        class="text-caption text-truncate" 
                        style="max-width: 150px;"
                         :data-tooltip="item.flags?.['LOTM_VTT']?.source || 'Unknown'">
                        {{ item.flags?.['LOTM_VTT']?.source || 'Unknown' }}
                    </v-chip>
                </template>

                <!-- Duration slot -->
                <template v-slot:item.duration="{ item }">
                    <v-chip 
                        label
                        size="x-small"
                        variant="elevated"
                        class="text-caption"
                        :color="item.duration?.type === 'none' ? 'primary' : 'secondary'"
                    >
                        {{ formatDuration(item) }}
                    </v-chip>
                </template>

                <!-- Actions slot -->
                <template v-slot:item.actions="{ item }">
                    <div class="d-flex align-center justify-center ga-1">
                        <v-tooltip :text="item.disabled ? 'Enable' : 'Disable'">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    :icon="item.disabled ? 'fa-solid fa-pause' : 'fa-solid fa-play'"
                                    size="x-small"
                                    variant="text"
                                    :color="item.disabled ? 'warning' : 'success'"
                                    @click="toggleEffect(item)"
                                ></v-btn>
                            </template>
                        </v-tooltip>
                        <v-tooltip text="Edit">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="fa-solid fa-edit"
                                    size="x-small"
                                    variant="text"
                                    @click="editItem(item)"
                                ></v-btn>
                            </template>
                        </v-tooltip>
                        <v-tooltip text="Delete">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="fa-solid fa-trash"
                                    size="x-small"
                                    variant="text"
                                    color="error"
                                    @click="deleteEffect(item)"
                                ></v-btn>
                            </template>
                        </v-tooltip>
                    </div>
                </template>

                <!-- No data slot -->
                <template v-slot:no-data>
                    <div class="text-center pa-4">
                        <v-icon size="48" color="grey-lighten-1">fa-solid fa-magic</v-icon>
                        <div class="text-h6 mt-2">No effects found</div>
                        <div class="text-body-2 text-medium-emphasis">
                            Add your first effect to get started
                        </div>
                    </div>
                </template>
            </v-data-table>
        </v-card>
    </template>
    