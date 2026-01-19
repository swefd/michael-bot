// Auto-import all command handlers to trigger registration
import "./handlers/start.js";
import "./handlers/status.js";
import "./handlers/linkSteam.js";
import "./handlers/linkTs.js";
import "./handlers/setStatusChat.js";
import "./handlers/adminLink.js";
import "./handlers/grokCommands.js";
import "./handlers/aiCommands.js";
import "./handlers/factCommands.js";
import "./handlers/squadAlert.js";
// Import callbacks separately (not commands)
import { refreshBoardHandler } from "./handlers/callbacks.js";
// Import Grok message middleware
import { grokMessageMiddleware } from "./handlers/grokMessage.js";

import { Bot, session } from "grammy";
import dotenv from "dotenv";
import { MyContext, SessionData } from "./context.js";
import { startPolling } from "./polling.js";
import { initSteamUserBot } from "./services/steamUser.js";
import { getCommands } from "./utils/commandRegistry.js";

dotenv.config();

const bot = new Bot<MyContext>(process.env.BOT_TOKEN || "");

// Install session middleware
function initial(): SessionData {
    return {};
}
bot.use(session({ initial }));

// Install Grok message middleware
bot.use(grokMessageMiddleware);

// Auto-register all commands from registry
const commands = getCommands();
commands.forEach(cmd => {
    bot.command(cmd.name, cmd.handler);
});

// Callbacks
bot.callbackQuery("refresh_board", refreshBoardHandler);

// Register commands for Telegram autocomplete
bot.api.setMyCommands(commands.map(cmd => ({
    command: cmd.name,
    description: cmd.description
})));

bot.start();
startPolling(bot);
initSteamUserBot(bot);

console.log("Bot is running...");
console.log(`Registered ${commands.length} commands:`, commands.map(c => c.name).join(", "));
