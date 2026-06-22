<script setup>
    import { ref, computed, inject } from "vue";

    const props = defineProps({
        label: String,
        type: String,
        systemPath: String,
        context: Object,
        disabled: Boolean,
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
</script>
<template>
    <v-input v-model="value" class="isdl-datetime">
        <template #default>
            <v-field 
                class="v-field--active"
                density="compact"
                variant="outlined"
                :disabled="disabled"
                :label="props.hideLabel ? undefined : game.i18n.localize(label)"
            >
                <input :type="type" :name="systemPath" v-model="value" :disabled="disabled" />
            </v-field>
        </template>
    </v-input>
</template>
