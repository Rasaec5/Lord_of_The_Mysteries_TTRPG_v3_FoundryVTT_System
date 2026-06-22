<script setup>
    import { ref, computed, inject, watchEffect } from "vue";

    const props = defineProps({
        label: String,
        systemPath: String,
        context: Object,
        visibility: String,
        editMode: Boolean,
        icon: String,
        hideLabel: Boolean
    });

    const document = inject("rawDocument");

    // Static damage type configuration extracted from AST
    const damageTypeConfig = {};

    const isHidden = computed(() => {
        if (props.visibility === "hidden") {
            return true;
        }
        if (props.visibility === "gm" && !game.user.isGM) {
            return true;
        }
        return false;
    });

    // Get all damage bonuses from the actor's system
    const damageBonuses = computed(() => {  
        const system = document.system;
        const bonusInfo = {};
        
        // Scan all system properties for bonus damage fields
        for (const [key, value] of Object.entries(system)) {
            const bonusMatch = key.match(/^(.+)bonusdamage$/);
            
            if (bonusMatch) {
                const damageType = bonusMatch[1];
                const damageTypeObj = damageTypeConfig[damageType] || {};
                
                bonusInfo[damageType] = {
                    type: damageType,
                    label: damageTypeObj.label || damageType,
                    icon: damageTypeObj.icon || 'fa-solid fa-circle-info',
                    color: damageTypeObj.color || '#666666',
                    bonus: Number(value) || 0
                };
            }
        }
        
        // Convert to array and sort by damage type name
        return Object.values(bonusInfo).sort((a, b) => a.type.localeCompare(b.type));
    });

    // Helper function to capitalize damage type names
    const capitalize = (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Helper function to format bonus values
    const formatBonus = (value) => {
        const numValue = Number(value) || 0;
        return numValue > 0 ? `+${numValue}` : `${numValue}`;
    };
</script>

<template>
    <div v-if="!isHidden" class="isdl-damage-bonuses pt-2 single-wide">
        <v-card class="damage-bonuses-card" variant="outlined" theme="light" color="white">
            <v-card-title v-if="!props.hideLabel" class="damage-bonuses-header bg-grey-darken-3 text-white">
                <v-icon v-if="icon" class="me-2">{{ icon }}</v-icon>
                <span>{{ game.i18n.localize(label) }}</span>
            </v-card-title>

            <v-card-text class="pa-0">
                <div v-if="damageBonuses.length === 0" class="text-center text-disabled pa-2">
                    No damage bonuses found
                </div>

                <v-table v-else density="compact" class="damage-bonuses-table">
                    <thead>
                        <tr>
                            <th class="text-left text-white">Type</th>
                            <th class="text-center text-white">Bonus</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="damage in damageBonuses" :key="damage.type" class="damage-type-row">
                            <td class="damage-type-name">
                                <div class="damage-type-header">
                                    <v-icon :color="damage.color" size="small" class="me-2">{{ damage.icon }}</v-icon>
                                    <span class="text-subtitle-2">{{ damage.label || capitalize(damage.type) }}</span>
                                </div>
                            </td>
                            <td class="text-center">
                                <v-chip
                                    size="small"
                                    :color="Number(damage.bonus) > 0 ? 'success' : Number(damage.bonus) < 0 ? 'error' : 'default'"
                                    variant="flat"
                                    class="text-white font-weight-bold"
                                >
                                    {{ formatBonus(damage.bonus) }}
                                </v-chip>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
        </v-card>
    </div>
</template>

<style scoped>
.damage-bonuses-card {
    border-radius: 6px;
    background: #ffffff;
}

.damage-bonuses-header {
    background: #424242;
    color: #ffffff;
    padding: 6px 12px;
    font-size: 0.85rem;
    font-weight: 600;
    border-bottom: 1px solid #333;
}

.damage-bonuses-table {
    background: #ffffff;
}

.damage-type-row:hover {
    background-color: #f9f9f9;
}

.damage-type-name {
    font-weight: 500;
    min-width: 120px;
}

.damage-type-header {
    display: flex;
    align-items: center;
    gap: 4px;
}

.v-table th {
    font-weight: 600;
    font-size: 0.8rem;
    color: #555;
    background: #fafafa;
    border-bottom: 1px solid #e0e0e0;
}

.v-table td {
    padding: 4px 12px;
    border-bottom: 1px solid #f0f0f0;
}

.v-chip {
    min-width: 48px;
    justify-content: center;
}
</style>

