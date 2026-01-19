import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { getPlayerSummaries } from "../services/steam.js";
import { registerCommand } from "../utils/commandRegistry.js";

export const adminMapSteamHandler = async (ctx: MyContext) => {
    // Must be a reply
    if (!ctx.message?.reply_to_message) {
        return ctx.reply("Please reply to a user's message to link their Steam ID.\nUsage: Reply with `/map_steam <steam_id64>`", { parse_mode: "Markdown" });
    }

    const targetUser = ctx.message.reply_to_message.from;
    if (!targetUser || targetUser.is_bot) {
        return ctx.reply("Cannot link a bot or unknown user.");
    }

    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        return ctx.reply("Usage: `/map_steam <steam_id64>`", { parse_mode: "Markdown" });
    }

    const steamId = args.trim();

    // Basic format check
    if (!/^\d{17}$/.test(steamId)) {
        return ctx.reply("Invalid Steam ID format. Please use a SteamID64 (17 digits).");
    }

    try {
        // Verify Steam ID existence
        const players = await getPlayerSummaries([steamId]);
        if (players.length === 0) {
            return ctx.reply("Could not find a Steam profile with that ID.");
        }

        const telegramId = BigInt(targetUser.id);
        const name = targetUser.first_name;

        await prisma.user.upsert({
            where: { telegramId },
            update: { steamId: steamId, displayName: name },
            create: {
                telegramId,
                displayName: name,
                steamId: steamId,
                tsAlias: null
            }
        });

        // React to the message with a checkmark
        await ctx.react("👍");

    } catch (error) {
        console.error("Error in adminMapSteam:", error);
        await ctx.reply("Failed to link account. Check logs.");
    }
};

export const adminMapTsHandler = async (ctx: MyContext) => {
    // Must be a reply
    if (!ctx.message?.reply_to_message) {
        return ctx.reply("Please reply to a user's message to link their TeamSpeak Alias.\nUsage: Reply with <code>/map_ts <nickname></code>", { parse_mode: "HTML" });
    }

    const targetUser = ctx.message.reply_to_message.from;
    if (!targetUser || targetUser.is_bot) {
        return ctx.reply("Cannot link a bot or unknown user.");
    }

    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        return ctx.reply("Usage: <code>/map_ts <nickname></code>", { parse_mode: "HTML" });
    }

    const tsAlias = args.trim();
    const telegramId = BigInt(targetUser.id);
    const name = targetUser.first_name;

    try {
        await prisma.user.upsert({
            where: { telegramId },
            update: { tsAlias: tsAlias, displayName: name },
            create: {
                telegramId,
                displayName: name,
                steamId: null,
                tsAlias: tsAlias
            }
        });

        // React to the message with a checkmark
        await ctx.react("👍");

    } catch (error) {
        console.error("Error in adminMapTs:", error);
        await ctx.reply("Failed to link account. Check logs.");
    }
};

registerCommand({
    name: "map_steam",
    description: "[Admin] Manually link a user's Steam account",
    handler: adminMapSteamHandler,
    adminOnly: true
});

registerCommand({
    name: "map_ts",
    description: "[Admin] Manually link a user's TeamSpeak nickname",
    handler: adminMapTsHandler,
    adminOnly: true
});
