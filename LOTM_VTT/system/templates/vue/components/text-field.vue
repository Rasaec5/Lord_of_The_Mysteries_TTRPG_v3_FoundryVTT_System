<script setup>
    import { ref, computed, inject } from "vue";

    const props = defineProps({
        label: String,
        systemPath: String,
        context: Object,
        disabled: Boolean,
        editMode: Boolean,
        icon: String,
        color: String,
        hideLabel: Boolean
    });

    const value = ref(foundry.utils.getProperty(props.context, props.systemPath));
    const document = inject("rawDocument");

    const debouncedPersist = foundry.utils.debounce((newValue) => {
        const update = {};
        value.value = newValue;
        update[props.systemPath] = newValue;
        document.update(update);
    }, 150);

    const update = (newValue) => {
        value.value = newValue;
        debouncedPersist(newValue);
    };

    const getLabel = computed(() => {
        const localized = game.i18n.localize(props.label);
        if (props.icon) {
            return `<i class="fa-solid ${props.icon}"></i> ${localized}`;
        }
        return localized;
    });
</script>
<template>
    <v-text-field
        v-model="value"
        :disabled="disabled"
        :dense="true"
        density="compact"
        variant="outlined"
        @update:modelValue="update"
        :data-tooltip="value"
        :color="color"
    >
        <template v-if="!props.hideLabel" #label>
            <span v-html="getLabel" />
        </template>
    </v-text-field>
</template>
