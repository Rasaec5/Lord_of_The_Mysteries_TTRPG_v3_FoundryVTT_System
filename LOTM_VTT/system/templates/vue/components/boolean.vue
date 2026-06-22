<script setup>
    import { ref, computed, inject } from "vue";

    const props = defineProps({
        label: String,
        systemPath: String,
        context: Object,
        visibility: String,
        editMode: Boolean,
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

    const isDisabled = computed(() => {
        return props.disabled ||
               props.visibility === "locked" ||
               props.visibility === "readonly" ||
               (props.visibility === "gmOnly" && !game.user.isGM);
    });

    const checkboxColor = computed(() => {
        return props.color || 'primary';
    });
</script>

<template>
    <div v-if="!isHidden" class="isdl-boolean single-wide">
        <v-checkbox
            v-model="value"
            :name="props.systemPath"
            :disabled="isDisabled"
            :color="checkboxColor"
            density="compact"
            class="single-wide"
            variant="outlined"
        >
            <template v-if="!props.hideLabel" #label>
                <span class="field-label">
                    <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                    {{ game.i18n.localize(props.label) }}
                </span>
            </template>
        </v-checkbox>
    </div>
</template>

