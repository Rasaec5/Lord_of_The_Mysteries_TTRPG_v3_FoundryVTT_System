export function hotReload(context) {
    const reloadFileTypes = ["mjs", "json"];
    if (!reloadFileTypes.includes(context.extension)) return;
    
    if (context.extension === "json") {
        if (!context.path.endsWith("system.json")) return;
        ui.notifications.warn("The system configuration has been updated. Please reload your world to apply changes.", { permanent: true });
    }

    ui.notifications.info("Reloading page to apply script changes", { permanent: true });

    const lastState = {
        openWindows: []
    };
    for (const window of Object.values(ui.windows)) {
        if (!window.object) continue;
        const uuid = window.object.uuid;
        lastState.openWindows.push({
            uuid: uuid,
            position: window.position
        });
    }
    game.settings.set("LOTM_VTT", "hotReloadLastState", lastState).then(() => 
    {
        // Reload the page
        window.location.reload(true);
    });
}
