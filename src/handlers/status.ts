import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { getPlayerSummaries } from "../services/steam.js";
import { getOnlineClients } from "../services/teamspeak.js";
import { getRichPresence } from "../services/steamUser.js";
import { registerCommand } from "../utils/commandRegistry.js";

export const statusHandler = async (ctx: MyContext) => {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const user = await prisma.user.findUnique({
        where: { telegramId }
    });

    if (!user) {
        await ctx.reply("❌ You are not registered yet. Use /start to register.", { parse_mode: "HTML" });
        return;
    }

    let statusMsg = `📊 <b>Your Status</b>\n\n`;
    statusMsg += `👤 <b>Display Name:</b> ${user.displayName || "Not set"}\n`;
    statusMsg += `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n\n`;

    // Steam Status
    statusMsg += `🎮 <b>Steam Account</b>\n`;
    if (user.steamId) {
        statusMsg += `├ <b>Steam ID:</b> <code>${user.steamId}</code>\n`;

        // Fetch live Steam data
        try {
            const [steamData] = await getPlayerSummaries([user.steamId]);
            if (steamData) {
                statusMsg += `├ <b>Name:</b> ${steamData.personaname}\n`;
                statusMsg += `├ <b>Status:</b> ${steamData.gameextrainfo || "Offline/Not playing"}\n`;

                // Get Rich Presence if available
                const rp = getRichPresence(user.steamId);
                if (rp) {
                    statusMsg += `└ <b>Details:</b> <i>${rp}</i>\n`;
                } else {
                    statusMsg += `└ <b>Rich Presence:</b> Not available\n`;
                }
            } else {
                statusMsg += `└ <i>Unable to fetch live data</i>\n`;
            }
        } catch (e) {
            statusMsg += `└ <i>Error fetching Steam data</i>\n`;
        }
    } else {
        statusMsg += `└ <i>Not linked. Use /link_steam [steam_id64]</i>\n`;
    }

    statusMsg += `\n`;

    // TeamSpeak Status
    statusMsg += `🎙️ <b>TeamSpeak Account</b>\n`;
    if (user.tsAlias) {
        statusMsg += `├ <b>Nickname:</b> ${user.tsAlias}\n`;

        // Fetch live TS data
        try {
            const tsClients = await getOnlineClients();
            const tsClient = tsClients.find(c => c.nickname === user.tsAlias);
            if (tsClient) {
                statusMsg += `└ <b>Status:</b> ✅ Online (Channel ${tsClient.cid})\n`;
            } else {
                statusMsg += `└ <b>Status:</b> ⚫ Offline\n`;
            }
        } catch (e) {
            statusMsg += `└ <i>Error fetching TS data</i>\n`;
        }
    } else {
        statusMsg += `└ <i>Not linked. Use /link_ts [nickname]</i>\n`;
    }

    await ctx.reply(statusMsg, { parse_mode: "HTML" });
};

registerCommand({
    name: "status",
    description: "Show your account status and live data",
    handler: statusHandler
});
