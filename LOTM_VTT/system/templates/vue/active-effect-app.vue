<script setup>
import { ref, inject, onMounted, computed } from 'vue';

const document = inject('rawDocument');
const props = defineProps(['context']);
console.log("Vue AE context", props.context);

// Colors
const primaryColor = ref('#1565c0');
const secondaryColor = ref('#4db6ac');
const tertiaryColor = ref('#ffb74d');

const drawer = ref(false);
const page = ref('details');
const tab = ref('description');

// Available fields for each document type
const availableFields = ref({});
const selectedFields = ref({});

// Create field name mapping for each document
const createFieldMapping = () => {
    const mapping = {};
    const damageTypes = [];
    
    mapping['PC'] = {
        'hp': 'HP',
        // Auto-generated damage type fields
        
    };
    return mapping;
};

// Helper method to get change value from the changes array
const getChangeValue = (key) => {
    const change = props.context?.document?.changes?.find(x => x.key === key);
    return change?.value || '';
};

// Helper method to get numeric change value from the changes array
const getChangeNumberValue = (key) => {
    const change = props.context?.document?.changes?.find(x => x.key === key);
    if (!change?.value) return 0;
    const num = Number(change.value);
    return isNaN(num) ? 0 : num;
};

// Helper method to get change type from the changes array
const getChangeMode = (key) => {
    const change = props.context?.document?.changes?.find(x => x.key === key);
    return change?.type || 'add';
};

// Initialize selectedFields from existing changes
const initializeSelectedFields = () => {
    if (!props.context?.document?.changes) return;
    
    const fieldMapping = createFieldMapping();
    
    console.log(fieldMapping, props.context.document.changes);
    for (const change of props.context.document.changes) {
        // Parse the key to extract document name and field name
        // Format: "hero.system.availableskilllevels" or "hero.system.resourcefield.value"
        const parts = change.key.split('.');
        if (parts.length >= 3) {
            const documentName = parts[0];
            const fieldNameLower = parts[2];
            
            // Convert document name to proper case (e.g., "hero" -> "Hero")
            const docName = documentName.charAt(0).toUpperCase() + documentName.slice(1);
            
            // Look up the proper field name from our mapping
            const properFieldName = fieldMapping[docName]?.[fieldNameLower];
            console.log(properFieldName);
            
            if (properFieldName) {
                if (!selectedFields.value[docName]) {
                    selectedFields.value[docName] = [];
                }
                
                if (!selectedFields.value[docName].includes(properFieldName)) {
                    selectedFields.value[docName].push(properFieldName);
                }
            }
        }
    }
};

// Generate a summary of current changes
const changesSummary = computed(() => {
    if (!props.context?.document?.changes || props.context.document.changes.length === 0) {
        return 'No changes configured';
    }
    
    const changes = props.context.document.changes.filter(change => {
        // Skip zero values for numbers
        const numValue = Number(change.value);
        return !((!isNaN(numValue) && numValue === 0) || change.value === '' || change.value === null);
    });
    
    if (changes.length === 0) {
        return 'No changes configured';
    }
    
    // Group changes by document type
    const groupedChanges = {};
    changes.forEach(change => {
        const parts = change.key.split('.');
        if (parts.length >= 3) {
            const documentName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1); // Capitalize
            const fieldPath = parts.slice(2).join('.');
            
            if (!groupedChanges[documentName]) {
                groupedChanges[documentName] = [];
            }
            
            console.log(change.key, fieldPath, parts);
            
            // Convert field names to human readable
            let step1 = fieldPath.replaceAll('.', ' ');
            let step2 = step1.replace(/([a-z])([A-Z])/g, '$1 $2');
            let step3 = step2.replace(/w/g, l => l.toUpperCase());
            //console.log("Debug steps:", fieldPath, "->", step1, "->", step2, "->", step3);
            
            const humanFieldName = step3;
            
            // Format the mode symbol
            const modeSymbol = change.type === 'multiply' ? ' × ' :
                             change.type === 'add' ? ' + ' :
                             change.type === 'downgrade' ? ' ↓ ' :
                             change.type === 'upgrade' ? ' ↑ ' :
                             change.type === 'custom' ? ' (Once) + ' : ' ';
            
            //console.log("Human Field Name:", humanFieldName, "Mode Symbol:", modeSymbol);
            groupedChanges[documentName].push(humanFieldName + modeSymbol + change.value);
        }
    });
    
    // Format as "Document: change1, change2"
    const documentSummaries = Object.entries(groupedChanges).map(([docName, changes]) => {
        return docName + ': ' + changes.join(', ');
    });
    
    return documentSummaries.join(' | ');
});

// Initialize on component mount
onMounted(() => {
    initializeSelectedFields();
});
</script>
        <template>
            <v-app>
                <!-- App Bar -->
                <v-app-bar :color="primaryColor" density="comfortable">
                    <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                    <v-text-field name="name" v-model="context.document.name" variant="outlined" class="document-name" density="compact"></v-text-field>
                </v-app-bar>
                
                <!-- Navigation Drawer -->
                <v-navigation-drawer v-model="drawer" temporary style="background-color: #dddddd">
                    <v-img :src="context.document.img" style="background-color: lightgray" data-edit-path='img' data-action='onEditImage'>
                        <template #error>
                            <v-img src="/systems/LOTM_VTT/img/missing-character.png" data-edit-path='img' data-action='onEditImage'></v-img>
                        </template>
                    </v-img>
                    <v-tabs v-model="page" direction="vertical">
                        <v-tab value="details" prepend-icon="fa-solid fa-book">Details</v-tab>
<!--                        <v-tab value="duration" prepend-icon="fa-solid fa-clock">Duration</v-tab>-->
                        <v-tab value="PC" prepend-icon="fa-solid fa-pen-to-square">PC Changes</v-tab>
                    </v-tabs>
                </v-navigation-drawer>
                
                <!-- Main Content -->
                <v-main class="d-flex">
                    <v-container class="topography" fluid>
                        <v-tabs-window v-model="page">
                            <v-tabs-window-item value="details" data-tab="details">
                                <v-col cols="12" style="padding: 0">
                                    <v-switch
                                        :model-value="!context.document.disabled"
                                        @update:model-value="context.document.disabled = !$event"
                                        name="enabled"
                                        :color="primaryColor"
                                        label="Enabled">
                                    </v-switch>
                                    <v-switch
                                        v-if="context.isItemEffect"
                                        :model-value="context.document.transfer"
                                        name="transfer"
                                        :color="secondaryColor"
                                        label="Active on parent Actor">
                                    </v-switch>
                                    <v-text-field
                                        v-if="context.originLink"
                                        :model-value="context.originLink"
                                        label="Origin"
                                        :disabled="true"
                                    >
                                    </v-text-field>
                                    <v-card class="mt-3 mb-3" variant="outlined">
                                        <v-card-title class="text-body-2">
                                            <v-icon icon="fa-solid fa-magic" class="mr-2"></v-icon>
                                            Current Changes
                                        </v-card-title>
                                        <v-card-text class="pt-2">
                                            <div class="text-body-2 text-medium-emphasis">
                                                {{ changesSummary }}
                                            </div>
                                        </v-card-text>
                                    </v-card>
                                    <i-prosemirror
                                        label="Description"
                                        icon="fa-solid fa-file-lines"
                                        :field="context.editors['description']"
                                        class="mt-2"
                                        >
                                    </i-prosemirror>
                                </v-col>
                            </v-tabs-window-item>
                            <v-tabs-window-item value="duration" data-tab="duration">
                                <v-col cols="12" style="padding: 0">
                                    <v-label>Duration Settings</v-label>
                                    <!-- Add duration content here -->
                                </v-col>
                            </v-tabs-window-item>
                            <v-tabs-window-item value="PC" data-tab="PC">
                                 <v-col cols="12" style="padding: 0">
                                    <v-card class="mb-4">
                                        <v-card-title>Available Fields</v-card-title>
                                        <v-card-text>
                                            <v-autocomplete
                                                label="Add Field to Change"
                                                :items="[{title: 'HP', value: 'HP'}]"
                                                item-title="title"
                                                item-value="value"
                                                v-model="selectedFields['PC']"
                                                :color="primaryColor"
                                                variant="outlined"
                                                density="compact"
                                                multiple
                                                chips
                                                closable-chips>
                                                <template #chip="{ props, item }">
                                                    <v-chip v-bind="props" :text="item.title" closable></v-chip>
                                                </template>
                                            </v-autocomplete>
                                        </v-card-text>
                                    </v-card>
                                    
                                    <div v-for="fieldName in selectedFields['PC'] || []" :key="fieldName">
                                        <div v-if="fieldName === 'HP'">
                                            <v-card class="mb-4">
                                                <v-card-title>
                                                    HP
                                                    <v-btn 
                                                        icon="fa-solid fa-xmark" 
                                                        size="small" 
                                                        variant="text" 
                                                        @click="selectedFields['PC'] = selectedFields['PC'].filter(f => f !== 'HP')"
                                                        style="float: right;">
                                                    </v-btn>
                                                </v-card-title>
                                                <v-card-text>
                                                     <v-label>Resource Current</v-label>
                                                    <v-row>
                                                        <v-select
                                                            name="pc.system.hp.value-mode"
                                                            :model-value="getChangeMode('pc.system.hp.value')"
                                                            label="Mode"
                                                            :items="context.numberModes"
                                                            item-title="label"
                                                            item-value="value"
                                                            :color="primaryColor"
                                                            variant="outlined"
                                                            density="compact">
                                                        </v-select>
                                                        <v-number-input
                                                            name="pc.system.hp.value"
                                                            :model-value="getChangeNumberValue('pc.system.hp.value')"
                                                            label="Current Value"
                                                            :color="primaryColor"
                                                            variant="outlined"
                                                            density="compact">
                                                        </v-number-input>
                                                    </v-row>
                                                    <v-label class="mt-2">Resource Max</v-label>
                                                    <v-row>
                                                        <v-select
                                                            name="pc.system.hp.max-mode"
                                                            :model-value="getChangeMode('pc.system.hp.max')"
                                                            label="Mode"
                                                            :items="context.numberModes"
                                                            item-title="label"
                                                            item-value="value"
                                                            :color="primaryColor"
                                                            variant="outlined"
                                                            density="compact">
                                                        </v-select>
                                                        <v-number-input
                                                            name="pc.system.hp.max"
                                                            :model-value="getChangeNumberValue('pc.system.hp.max')"
                                                            label="Max Value"
                                                            :color="primaryColor"
                                                            variant="outlined"
                                                            density="compact">
                                                        </v-number-input>
                                                    </v-row>
                                                </v-card-text>
                                            </v-card>
                                        </div>
                                    </div>
                                </v-col>
                            </v-tabs-window-item>
                        </v-tabs-window>
                    </v-container>
                </v-main>
            </v-app>
        </template>
