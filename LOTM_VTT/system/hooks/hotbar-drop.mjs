        export function hotbarDrop(bar, data, slot) {
            // Only handle actor and item documents
            if (data.type !== "Actor" && data.type !== "Item") return;

            // Get the document
            const document = fromUuidSync(data.uuid);
            if (!document) return;

            // Check if this document type has a macro action
            const macroConfig = game.system.macroActions?.[document.type];

            // Create the macro
            let macroData;

            if (macroConfig) {
                // Create a macro that runs the specified action
                macroData = {
                    name: `${document.name} - ${macroConfig.name}`,
                    type: "script",
                    img: 'icons/svg/dice-target.svg',
                    command: `// Macro for ${document.name}
const document = await fromUuid("${data.uuid}");
if (!document) {
    ui.notifications.warn("Document not found: ${document.name}");
    return;
}

// Run the macro action
const event = {
    currentTarget: { dataset: { action: "${macroConfig.action}" } },
    preventDefault: () => {}
};
document.sheet._onAction(event);`,
                    flags: {
                        "LOTM_VTT": {
                            documentUuid: data.uuid,
                            actionName: macroConfig.action
                        }
                    }
                };
            } else {
                // Default behavior: create a macro that displays the document sheet
                macroData = {
                    name: document.name,
                    type: "script",
                    img: document.img,
                    command: `// Display ${document.name}
const document = await fromUuid("${data.uuid}");
if (!document) {
    ui.notifications.warn("Document not found: ${document.name}");
    return;
}
document.sheet.render(true);`,
                    flags: {
                        "LOTM_VTT": {
                            documentUuid: data.uuid,
                            actionName: "display"
                        }
                    }
                };
            }

            // Check if a macro with this command already exists
            let macro = game.macros.find(m =>
                m.flags?.["LOTM_VTT"]?.documentUuid === data.uuid &&
                m.flags?.["LOTM_VTT"]?.actionName === macroConfig?.action
            );

            if (!macro) {
                Macro.create(macroData).then((createdMacro) => {
                    game.user.assignHotbarMacro(createdMacro, slot);
                });
            }
            else {
                // Assign the macro to the hotbar slot
                game.user.assignHotbarMacro(macro, slot);
            }

            // Prevent default
            return false;
        }
