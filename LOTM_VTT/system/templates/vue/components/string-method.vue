<script setup>
    import { ref, computed, inject } from "vue";

    const props = defineProps({
        label: String,
        systemPath: String,
        context: Object,
        icon: String,
        color: String,
        disabled: Boolean,
        hideLabel: Boolean
    });

    const document = inject("rawDocument");

    const value = computed({
        get: () => foundry.utils.getProperty(props.context, props.systemPath),
        set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
    });

    const isHidden = computed(() => {
        if (props.visibility === "hidden") {
            return true;
        }
        if (props.visibility === "gm" && !game.user.isGM) {
            return true;
        }
        return false;
    });

    const fieldColor = computed(() => {
        return props.color || 'primary';
    });

    const tooltipText = computed(() => {
        return value.value || '';
    });
</script>

<template>
    <div v-if="!isHidden" class="isdl-string-method single-wide">
        <v-text-field 
            v-model="value"
            :name="props.systemPath"
            :disabled="disabled"
            :color="fieldColor"
            variant="outlined"
            density="compact"
            append-inner-icon="fa-solid fa-function"
            :data-tooltip="tooltipText"
        >
            <template v-if="!props.hideLabel" #label>
                <span class="field-label">
                    <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                    {{ game.i18n.localize(props.label) }}
                </span>
            </template>
        </v-text-field>
    </div>
</template>

