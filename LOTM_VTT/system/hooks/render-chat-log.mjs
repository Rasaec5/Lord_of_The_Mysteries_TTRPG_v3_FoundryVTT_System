import LOTM_VTTChatCard from "../documents/chat-card.mjs";

export function renderChatLog(app, html, data) {
    LOTM_VTTChatCard.activateListeners(html);
}
