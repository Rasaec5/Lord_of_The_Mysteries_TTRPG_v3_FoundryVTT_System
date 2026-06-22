<script setup>
    import { ref, computed, inject, onMounted, onUnmounted, watch, nextTick } from "vue";

    const props = defineProps({
        systemPath: String,
        context: Object,
        primaryColor: String,
        secondaryColor: String,
        tertiaryColor: String
    });
    
    const document = inject('rawDocument');
    const search = ref('');
    const loading = ref(false);
    const showColumnDialog = ref(false);

    const columnVisibility = ref({});
    const columnOrder = ref([]);

    const data = computed(() => {
        // Table fields represent embedded items. Map over context.object.items (plain objects
        // from toObject()) to keep the reactive dependency and avoid Vue's reactive proxy
        // traversing Foundry's EmbeddedCollection. toObject() omits derived/computed values
        // (their getters are non-enumerable), so we transiently read the live item and overlay
        // each schema field's resolved value -- the live item is never stored in reactive state.
        const allItems = props.context?.object?.items ?? [];
        return allItems.filter(i => i.type === 'loot').map(plain => {
            const live = document.items.get(plain._id);
            if (live) {
                const fields = live.system.schema?.fields ?? live.system.constructor?.schema?.fields ?? {};
                for (const key of Object.keys(fields)) {
                    plain.system[key] = foundry.utils.deepClone(live.system[key]);
                }
            }
            return plain;
        });
    });

    // Create a map of item _id to item for drag operations
    const itemMap = computed(() => {
        const map = new Map();
        data.value.forEach(item => {
            map.set(item._id, item);
        });
        return map;
    });

    // Expose itemMap globally for drag handlers to access
    if (!window.isdlItemMaps) window.isdlItemMaps = new Map();
    window.isdlItemMaps.set(document._id, itemMap);
    
    const customHeaders = [
        // Image and Name are configurable columns like any other. Image is ordered first by default.
        { title: game.i18n.localize("Image"), key: 'img', sortable: false, width: '50px', maxWidth: '50px' },
        { title: game.i18n.localize("Name"), key: 'name', sortable: true, minWidth: '120px', locked: true },
        
        { title: game.i18n.localize("Loot.Value"), key: 'system.value', sortable: true, minWidth: '100px', type: 'NumberExp', visibility: 'default' },
    ];

    const orderedHeaders = computed(() => {
        if (columnOrder.value.length === 0) {
            return customHeaders;
        }
        
        // Create a map for quick lookup
        const headerMap = new Map();
        customHeaders.forEach(header => {
            headerMap.set(header.key, header);
        });
        
        // Build ordered array based on columnOrder, then add any missing headers
        const ordered = [];
        columnOrder.value.forEach(key => {
            if (headerMap.has(key)) {
                ordered.push(headerMap.get(key));
                headerMap.delete(key);
            }
        });
        
        // Add any remaining headers that weren't in the order
        headerMap.forEach(header => {
            ordered.push(header);
        });
        
        return ordered;
    });

    // Per-viewer column gating from the referenced field's visibility.
    // 'hidden' columns are already dropped at build time; method-block visibility can't be
    // resolved here, so such columns fall through as visible.
    const passesVisibility = (header) => {
        const v = header?.visibility;
        if (v === 'gmOnly') return game.user.isGM;
        if (v === 'secret') {
            return game.user.isGM || document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        }
        return true;
    };

    const actionPassesVisibility = (action) => {
        const v = action?.visibility;
        if (v === 'hidden') return false;
        if (v === 'gmOnly') return game.user.isGM;
        if (v === 'secret') {
            return game.user.isGM || document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        }
        return true;
    };

    const visibleHeaders = computed(() => {
        const baseHeaders = [
            {
                                title: "",
                                key: 'system.pinned',
                                sortable: false,
                                width: '40px',
                                maxWidth: '40px',
                                align: 'center'
                            }
        ];

        let customHeadersToShow = orderedHeaders.value.filter(header => header && isColumnVisible(header.key) && passesVisibility(header));

        const actionHeaders = [
            {
                                title: game.i18n.localize("Actions"),
                                key: 'actions',
                                sortable: false,
                                width: '150px',
                                align: 'end'
                            }
        ];

        return [...baseHeaders, ...customHeadersToShow, ...actionHeaders];
    });
    
    // Column configuration
    const settingKey = 'documentTableColumns';
    
    const defaultVisibileColumns = [
        'system.value'
    ];

    // Default visibility per column. Image defaults to the image table param (default true),
    // Name is always visible (locked), and the rest follow the table's fields defaults.
    const columnDefaultVisible = (key) => {
        if (key === 'img') return true;
        if (key === 'name') return true;
        
        return defaultVisibileColumns.includes(key);
    };

    const buildDefaultVisibility = (tableSettings) => {
        const defaultVisibility = {};
        customHeaders.forEach(col => {
            defaultVisibility[col.key] = columnDefaultVisible(col.key);
            if (tableSettings && tableSettings.visibility && tableSettings.visibility[col.key] !== undefined) {
                defaultVisibility[col.key] = tableSettings.visibility[col.key];
            }
        });
        // Name can never be hidden.
        defaultVisibility['name'] = true;
        return defaultVisibility;
    };

    const initializeColumnSettings = async () => {
        try {
            const savedSettings = game.settings.get("LOTM_VTT", settingKey) || {};
            const documentTables = savedSettings[document._id] || {};
            const tableSettings = documentTables['PCMyLoot'] || {};

            columnVisibility.value = buildDefaultVisibility(tableSettings);

            // Initialize order
            if (tableSettings.order && Array.isArray(tableSettings.order)) {
                // Start from the saved order, then splice in any columns the save predates
                // (e.g. img/name, or fields added to the document later) at their default index.
                const order = [...tableSettings.order];
                customHeaders.map(h => h.key).forEach((key, idx) => {
                    if (!order.includes(key)) {
                        order.splice(Math.min(idx, order.length), 0, key);
                    }
                });
                columnOrder.value = order;
            } else {
                // Default order is the order they appear in customHeaders
                columnOrder.value = customHeaders.map(h => h.key);
            }
        } catch (error) {
            console.warn("Failed to load column settings, using defaults:", error);
            // Use defaults if setting doesn't exist yet
            columnVisibility.value = buildDefaultVisibility(null);
            columnOrder.value = customHeaders.map(h => h.key);
        }
    };

    const saveColumnSettings = async () => {
        try {
            const savedSettings = game.settings.get("LOTM_VTT", settingKey) || {};
            const documentTables = savedSettings[document._id] || {};
            savedSettings[document._id] = documentTables;
            
            const tableSettings = documentTables['PCMyLoot'] || {};
            
            // Save visibility
            const visibilitySettings = {};
            customHeaders.forEach(col => {
                visibilitySettings[col.key] = columnVisibility.value[col.key];
            });
            
            tableSettings.visibility = visibilitySettings;
            tableSettings.order = [...columnOrder.value];
            
            savedSettings[document._id]['PCMyLoot'] = tableSettings;
            await game.settings.set("LOTM_VTT", settingKey, savedSettings);
        } catch (error) {
            console.error("Failed to save column settings:", error);
            ui.notifications.error("Failed to save column settings");
        }
    };

    const isColumnVisible = (columnKey) => {
        return columnVisibility.value[columnKey] !== false;
    };

    const toggleColumn = async (columnKey) => {
        // Name is the row identity column and can't be hidden.
        if (columnKey === 'name') return;
        columnVisibility.value[columnKey] = !columnVisibility.value[columnKey];
        await saveColumnSettings();
    };

    const resetColumns = async () => {
        columnVisibility.value = buildDefaultVisibility(null);
        columnOrder.value = customHeaders.map(h => h.key);
        await saveColumnSettings();
    };

    const moveColumn = async (fromIndex, toIndex) => {
        const newOrder = [...columnOrder.value];
        const [movedItem] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedItem);
        columnOrder.value = newOrder;
        await saveColumnSettings();
    };

    const onColumnDragStart = (event, index) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', index.toString());
    };

    const onColumnDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const onColumnDrop = async (event, toIndex) => {
        event.preventDefault();
        const fromIndex = parseInt(event.dataTransfer.getData('text/plain'));
        if (fromIndex !== toIndex) {
            await moveColumn(fromIndex, toIndex);
        }
    };

    onMounted(() => {
        initializeColumnSettings();
    });

    const humanize = (str) => {
        if (!str) return "";
        let humanized = str.replace(/_/g, " ");
        humanized = humanized.replace("system.", "").replaceAll(".", " ");
        humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
        return humanized;
    };

    const getNestedValue = (obj, path) => {
        const data = foundry.utils.getProperty(obj, path);
        return data;
    };

    const getResourceColor = (resource) => {
        if (!resource || !resource.max) return 'grey';
        const percentage = (resource.value / resource.max) * 100;
        if (percentage > 75) return 'green';
        if (percentage > 50) return 'orange';
        if (percentage > 25) return 'red';
        return 'red-darken-2';
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return "";
        return new Date(dateValue).toLocaleDateString();
    };

    const editItem = (item) => {
        const foundryItem = document.items.get(item._id);
        foundryItem.sheet.render(true);
    };

    const sendItemToChat = async (item) => {
        const foundryItem = document.items.get(item._id);
        const chatDescription = foundryItem.description ?? foundryItem.system.description;
        const content = await renderTemplate("systems/LOTM_VTT/system/templates/chat/standard-card.hbs", { 
            cssClass: "LOTM_VTT",
            document: foundryItem,
            hasEffects: foundryItem.effects?.size > 0,
            description: chatDescription,
            hasDescription: chatDescription != ""
        });
        ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker(),
            style: CONST.CHAT_MESSAGE_STYLES.IC
        });
    };

    const deleteItem = async (item) => {
        const foundryItem = document.items.get(item._id);
        const shouldDelete = await Dialog.confirm({
            title: "Delete Confirmation",
            content: `<p>Are you sure you would like to delete the "${foundryItem.name}" Item?</p>`,
            defaultYes: false
        });
        if (shouldDelete) foundryItem.delete();
    };

    const duplicateItem = async (item) => {
        loading.value = true;
        try {
            const foundryItem = document.items.get(item._id);
            const itemData = foundryItem.toObject();
            itemData.name = "Copy of " + itemData.name;
            delete itemData._id;

            const duplicatedItems = await Item.createDocuments([itemData], {parent: document});
            if (duplicatedItems && duplicatedItems[0]) {
                ui.notifications.info(`Duplicated "${foundryItem.name}"`);
            }
        } catch (error) {
            console.error("Error duplicating item:", error);
            ui.notifications.error("Failed to duplicate item");
        } finally {
            loading.value = false;
        }
    };

    const customItemAction = async (item, actionName) => {
        const foundryItem = document.items.get(item._id);
        const event = { currentTarget: { dataset: { action: actionName } } };
        foundryItem.sheet._onAction(event);
    };

    

    const togglePin = async (item) => {
        const foundryItem = document.items.get(item._id);
        await foundryItem.update({"system.pinned": !foundryItem.system.pinned});
    };

    const addNewItem = async () => {
        loading.value = true;
        try {
            const type = 'loot';
            const items = await Item.createDocuments([{
                type: type,
                name: "New " + type
            }], {parent: document});

            if (items && items[0]) {
                items[0].sheet.render(true);
            }
        } catch (error) {
            console.error("Error creating item:", error);
            ui.notifications.error("Failed to create new item");
        } finally {
            loading.value = false;
        }
    };
    
    const truncate = (text, maxLength) => {
        if (!text) return '';
        if (text.length > maxLength) {
            return text.substring(0, maxLength) + '...';
        }
        return text;
    }

    const bindDragDrop = () => {
        try {
            if (document.sheet.element) {
                document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    const getExtendedChoiceTooltip = (item, systemPath) => {
        const tooltipParts = [];
        const coreKeys = ['value', 'color', 'icon'];
        const base = getNestedValue(item, systemPath);
        for (const key of Object.keys(base)) {
            if (!coreKeys.includes(key)) {
                const value = base[key];
                if (value !== undefined) {
                    tooltipParts.push(`${key}: ${value}`);
                }
            }
        }
        return tooltipParts.join('<br>');
    };

    // Get item props for row attributes (for drag-drop)
    const getItemProps = (item) => {
        // Construct UUID for embedded items: parent.uuid + Item.itemId
        const itemUuid = item.uuid || `${document.uuid}.Item.${item._id}`;
        return {
            'data-item-id': item._id,
            'data-document-id': document._id,
            'data-uuid': itemUuid
        };
    };

    // Function to add data attributes to table rows
    const updateTableRowAttributes = () => {
        const tableEl = window.document.querySelector('.custom-datatable table');
        if (!tableEl) {
            console.warn('Table not found for attribute update');
            return;
        }

        const rows = tableEl.querySelectorAll('tbody tr');
        const items = data.value;

        rows.forEach((row, index) => {
            if (index < items.length) {
                const item = items[index];
                const itemUuid = item.uuid || `${document.uuid}.Item.${item._id}`;
                row.setAttribute('data-item-id', item._id);
                row.setAttribute('data-document-id', document._id);
                row.setAttribute('data-uuid', itemUuid);
            }
        });
    };

    // Watch for data changes and update attributes
    watch(data, () => {
        nextTick(updateTableRowAttributes);
    }, { immediate: false });

    // Bind drag drop and update attributes after component mount
    onMounted(() => {
        setTimeout(() => {
            updateTableRowAttributes();
            bindDragDrop();
        }, 200);
    });

    // Clean up item map on unmount
    onUnmounted(() => {
        if (window.isdlItemMaps) {
            window.isdlItemMaps.delete(document._id);
        }
    });
</script>

<template>
    <v-card flat class="isdl-datatable">
        <v-card-title class="d-flex align-center pe-1" style="height: 40px;">
            <v-icon icon="fa-solid fa-table" size="small" />
            &nbsp; {{ game.i18n.localize("PC.MyLoot") }}
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
                icon="fa-solid fa-columns"
                size="small"
                variant="text"
                @click="showColumnDialog = true"
                style="margin-right: 8px;"
            >
                <v-icon>fa-solid fa-columns</v-icon>
                <v-tooltip activator="parent" location="top">Configure Columns</v-tooltip>
            </v-btn>
            <v-btn
                                :color="primaryColor || 'primary'"
                                prepend-icon="fa-solid fa-plus"
                                rounded="0"
                                size="small"
                                :loading="loading"
                                @click="addNewItem"
                                style="max-width: 80px; height: 38px;"
                            >
                                {{ game.i18n.localize("Add") }}
                            </v-btn>
        </v-card-title>
        <v-divider></v-divider>
        
        <v-data-table
            v-model:search="search"
            :headers="visibleHeaders"
            :items="data"
            :search="search"
            hover
            density="compact"
            hide-default-footer
            items-per-page=-1
            style="background: none;"
            class="custom-datatable"
            :sort-by="[{ key: 'system.pinned', order: 'desc' }, { key: 'name', order: 'asc' }]"
            :item-props="getItemProps"
        >
            <!-- Image slot -->
            <template v-slot:item.img="{ item }">
                <v-avatar size="40" rounded="0">
                                        <v-img :src="item.img" :alt="item.name" cover></v-img>
                                    </v-avatar>
            </template>

            <!-- Name slot with description tooltip -->
            <template v-slot:item.name="{ item }">
                <div class="d-flex align-center" :data-tooltip="item.system.description">
                    <div class="font-weight-medium text-truncate" style="min-width: 120px; max-width: 200px;">{{ item.name }}</div>
                </div>
            </template>

            <!-- Pinned slot -->
            <template v-slot:item.system.pinned="{ item }">
                                <div class="d-flex justify-center">
                                    <v-btn
                                        icon
                                        size="small"
                                        variant="text"
                                        @click="togglePin(item)"
                                        :data-tooltip="item.system.pinned ? 'Unpin' : 'Pin'"
                                    >
                                        <v-icon
                                            :icon="item.system.pinned ? 'fa-solid fa-thumbtack' : 'fa-regular fa-thumbtack'"
                                            :color="item.system.pinned ? primaryColor : 'grey'"
                                            size="small"
                                        ></v-icon>
                                    </v-btn>
                                </div>
                            </template>

            <!-- Type chip slot for multi-type tables -->
            

            <!-- Custom field slots -->

            <!-- Actions slot -->
            <template v-slot:item.actions="{ item }">
                                <div class="d-flex align-center justify-end ga-1">
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
                                    <v-tooltip text="Send to Chat">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon="fa-solid fa-message"
                                                size="x-small"
                                                variant="text"
                                                @click="sendItemToChat(item)"
                                            ></v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-menu>
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon="fa-solid fa-ellipsis-vertical"
                                                size="x-small"
                                                variant="text"
                                            ></v-btn>
                                        </template>
                                        <v-list density="compact" class="pa-0" min-width="120">
                                            
                                            <v-list-item
                                                @click="duplicateItem(item)"
                                                title="Duplicate"
                                                min-height="32"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon icon="fa-solid fa-copy" size="15"></v-icon>
                                                </template>
                                            </v-list-item>
                                            <v-list-item
                                                @click="deleteItem(item)"
                                                title="Delete"
                                                class="text-error"
                                                min-height="32"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon icon="fa-solid fa-trash" size="15"></v-icon>
                                                </template>
                                            </v-list-item>
                                        </v-list>
                                    </v-menu>
                                </div>
                            </template>

            <!-- No data slot -->
            <template v-slot:no-data>
                <div class="text-center pa-4">
                    <v-icon size="48" color="grey-lighten-1">fa-solid fa-inbox</v-icon>
                    <div class="text-h6 mt-2">No items found</div>
                    <div class="text-body-2 text-medium-emphasis">
                        Add your first {{ game.i18n.localize("Loot").toLowerCase() }} to get started
                    </div>
                </div>
            </template>
        </v-data-table>
    </v-card>

    <!-- Column Configuration Dialog (always available; a view preference, not editing) -->
    <v-dialog v-model="showColumnDialog" max-width="600px">
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon class="me-2">fa-solid fa-columns</v-icon>
                Configure Columns
            </v-card-title>
            <v-divider></v-divider>
            <v-card-text>
                <div class="text-body-2 mb-4 text-medium-emphasis">
                    Drag to reorder columns, check/uncheck to show/hide columns
                </div>
                <v-list density="compact" class="column-config-list">
                    <div
                        v-for="(columnKey, index) in columnOrder"
                        :key="columnKey"
                        v-if="passesVisibility(customHeaders.find(h => h.key === columnKey))"
                        class="column-config-item"
                        draggable="true"
                        @dragstart="onColumnDragStart($event, index)"
                        @dragover="onColumnDragOver"
                        @drop="onColumnDrop($event, index)"
                    >
                        <v-list-item class="px-2">
                            <template v-slot:prepend>
                                <v-icon 
                                    icon="fa-solid fa-grip-vertical" 
                                    class="drag-handle me-2" 
                                    size="small"
                                    style="cursor: grab;"
                                ></v-icon>
                                <v-checkbox-btn
                                    :model-value="columnKey === 'name' ? true : columnVisibility[columnKey]"
                                    :disabled="columnKey === 'name'"
                                    @update:model-value="toggleColumn(columnKey)"
                                    class="me-2"
                                ></v-checkbox-btn>
                            </template>
                            <v-list-item-title>
                                {{ customHeaders.find(h => h.key === columnKey)?.title || columnKey }}
                            </v-list-item-title>
                        </v-list-item>
                    </div>
                </v-list>
            </v-card-text>
            <v-card-actions class="flexrow">
                <v-btn
                    variant="elevated"
                    @click="showColumnDialog = false"
                    :color="primaryColor"
                >
                    Close
                </v-btn>
                <v-btn
                    variant="elevated"
                    @click="resetColumns"
                    prepend-icon="fa-solid fa-undo"
                    :color="secondaryColor"
                >
                    Reset to Default
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
