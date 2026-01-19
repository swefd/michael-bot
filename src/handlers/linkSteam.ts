import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { getPlayerSummaries } from "../services/steam.js";
import { registerCommand } from "../utils/commandRegistry.js";

export const linkSteamHandler = async (ctx: MyContext) => {
    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        return ctx.reply("Usage: /link_steam <steam_id_64>");
    }

    const steamId = args.trim();

    // Basic format check (SteamID64 is usually 17 digits)
    if (!/^\d{17}$/.test(steamId)) {
        return ctx.reply("Invalid Steam ID format. Please use a SteamID64 (17 digits).");
    }

    try {
        const steamIdBigInt = BigInt(steamId);
        // Verify existence
        const players = await getPlayerSummaries([steamId]);
        if (players.length === 0) {
            return ctx.reply("Could not find a Steam profile with that ID. Please check and try again.");
        }

        // Save to DB
        // ctx.from.id is the Telegram User ID
        const telegramId = BigInt(ctx.from!.id);
        const displayName = ctx.from!.first_name;

        await prisma.user.upsert({
            where: { telegramId },
            update: { steamId: steamId, displayName },
            create: {
                telegramId,
                displayName,
                steamId: steamId,
                tsAlias: null
            }
        });

        // React to the message with a thumbs up
        await ctx.react("👍");

    } catch (error) {
        console.error("Error linking steam:", error);
        await ctx.reply("An error occurred while linking your account.");
    }
};

registerCommand({
    name: "link_steam",
    description: "Link your Steam account",
    handler: linkSteamHandler
});
