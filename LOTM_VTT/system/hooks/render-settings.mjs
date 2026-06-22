// Adds an "ISDL" version row to the Foundry Settings sidebar, next to the
// system info, showing which version of ISDL generated this system.
export function renderSettings(app, html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    const info = root.querySelector("section.info");
    if (!info || info.querySelector(".isdl-version")) return;

    const version = game.system.flags?.["isdl-version"] ?? "unknown";

    const row = document.createElement("div");
    row.classList.add("isdl-version");
    const label = document.createElement("span");
    label.classList.add("label");
    label.textContent = "ISDL";
    const value = document.createElement("span");
    value.classList.add("value");
    value.textContent = version;
    row.append(label, value);

    // Place it right after the system row when present, else append.
    const systemRow = info.querySelector(".system");
    if (systemRow) systemRow.after(row);
    else info.appendChild(row);
}
