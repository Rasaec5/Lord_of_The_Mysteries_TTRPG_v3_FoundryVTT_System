import {init} from "./hooks/init.mjs";
import {ready} from "./hooks/ready.mjs";
import {renderChatLog} from "./hooks/render-chat-log.mjs";
import {renderSettings} from "./hooks/render-settings.mjs";
import {hotReload} from "./hooks/hot-reload.mjs";
import {hotbarDrop} from "./hooks/hotbar-drop.mjs";

Hooks.once("init", init);
Hooks.once("ready", ready);
Hooks.on("devModeReady", ({registerPackageDebugFlag}) => registerPackageDebugFlag("LOTM_VTT"));
Hooks.on("renderChatMessage", renderChatLog);
Hooks.on("renderSettings", renderSettings);
Hooks.on("hotReload", hotReload);
Hooks.on("hotbarDrop", hotbarDrop);
