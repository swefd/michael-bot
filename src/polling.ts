import { Api, Bot, RawApi } from "grammy";
import { MyContext } from "./context.js";
import { prisma } from "./db.js";
import { getPlayerSummaries } from "./services/steam.js";
import { getOnlineClients } from "./services/teamspeak.js";
import { getRichPresence } from "./services/steamUser.js";

// Keep track of when we last notified about a game [GameName -> Timestamp]
const lastNotified = new Map<string, number>();

// Squad Alert toggle (disabled by default)
let squadAlertEnabled = false;

export const isSquadAlertEnabled = () => squadAlertEnabled;
export const setSquadAlertEnabled = (enabled: boolean) => {
    squadAlertEnabled = enabled;
};

const escapeHtml = (unsafe: string) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

let _bot: Bot<MyContext> | null = null;

export const startPolling = (bot: Bot<MyContext>) => {
    _bot = bot;
    // Poll every X seconds (Default: 60)
    const intervalSeconds = Number(process.env.UPDATE_RATE_SECONDS) || 60;
    const intervalMs = intervalSeconds * 1000;

    console.log(`Polling started. Update rate: ${intervalSeconds}s`);

    setInterval(() => updateStatusBoards(bot.api), intervalMs);
    // Run immediately on start
    // setTimeout(() => updateStatusBoards(bot.api), 5000);
};

export const updateStatusBoards = async (api: Api<RawApi>) => {
    // console.log("Updating status boards...");

    try {
        // 1. Fetch Data
        const users = await prisma.user.findMany();

        // Create maps for quick lookup
        const steamIdToUser = new Map<string, typeof users[0]>();
        const tsAliasToUser = new Map<string, typeof users[0]>();

        const steamIds: string[] = [];
        users.forEach(u => {
            if (u.steamId) {
                steamIds.push(u.steamId);
                steamIdToUser.set(u.steamId, u);
            }
            if (u.tsAlias) {
                tsAliasToUser.set(u.tsAlias, u);
            }
        });

        const [steamPlayers, tsClients] = await Promise.all([
            steamIds.length > 0 ? getPlayerSummaries(steamIds) : [],
            getOnlineClients()
        ]);

        // 2. Merge Data
        // Active Users Map: TelegramID -> Data
        const activeUsers = new Map<number, {
            displayName: string,
            steamGame?: string,
            steamGameId?: string, // Steam App ID for reliable grouping
            steamStatus?: string, // Rich presence info
            tsChannel?: string,
            telegramId: bigint
        }>();

        // Process Steam
        steamPlayers.forEach(p => {
            const user = steamIdToUser.get(p.steamid);
            if (user && p.gameextrainfo) {
                const uid = Number(user.id);
                // Priority: Saved DisplayName > Steam Name
                const name = user.displayName || p.personaname;

                const entry = activeUsers.get(uid) || { telegramId: user.telegramId, displayName: name };
                entry.steamGame = p.gameextrainfo;
                entry.steamGameId = p.gameid; // Store game ID for reliable grouping

                // Fetch Rich Presence - store separately to keep game name pure for grouping
                const rp = getRichPresence(p.steamid);
                if (rp) {
                    entry.steamStatus = rp;
                }

                // If we didn't have a display name before, set it now
                if (!entry.displayName) entry.displayName = name;

                activeUsers.set(uid, entry);
            }
        });

        // Process TeamSpeak
        const unknownTsClients: { nickname: string }[] = [];

        tsClients.forEach(c => {
            if (c.nickname === "GamerBridgeBot") return;

            const user = tsAliasToUser.get(c.nickname);
            if (user) {
                const uid = Number(user.id);
                const name = user.displayName || c.nickname;

                const entry = activeUsers.get(uid) || { telegramId: user.telegramId, displayName: name };
                entry.tsChannel = `Channel ${c.cid}`;
                // Prioritize existing display name
                if (!entry.displayName) entry.displayName = name;

                activeUsers.set(uid, entry);
            } else {
                unknownTsClients.push(c);
            }
        });

        // 3. Format Message V2
        let message = "🎮 <b>Live Status Board</b>\n\n";

        // Grouping - use Game ID for reliable grouping, keep game name for display
        const games = new Map<string, { gameName: string, players: string[] }>(); // GameID -> {gameName, players}
        const justOnline: string[] = []; // List of Names

        activeUsers.forEach(u => {
            const safeName = escapeHtml(u.displayName);
            let status = "";
            let extraInfo = "";

            if (u.tsChannel) status += "🎙️ ";
            if (u.steamStatus) extraInfo = ` <i>(${escapeHtml(u.steamStatus)})</i>`;

            if (u.steamGame && u.steamGameId) {
                const gameData = games.get(u.steamGameId) || { gameName: u.steamGame, players: [] };
                gameData.players.push(`${status}${safeName}${extraInfo}`);
                games.set(u.steamGameId, gameData);
            } else if (u.tsChannel) {
                justOnline.push(`${status}${safeName}`);
            }
        });



        // Render Games
        if (games.size > 0) {
            // Sort games alphabetically by name
            const sortedGameEntries = Array.from(games.entries()).sort((a, b) =>
                a[1].gameName.localeCompare(b[1].gameName)
            );

            sortedGameEntries.forEach(([gameId, gameData]) => {
                // Sort players alphabetically
                gameData.players.sort((a, b) => a.localeCompare(b));

                message += `<b>${escapeHtml(gameData.gameName)}</b>\n`;
                gameData.players.forEach(p => message += `• ${p}\n`);
                message += "\n";
            });
        }

        // Render Online (TS only)
        if (justOnline.length > 0) {
            // Sort players alphabetically
            justOnline.sort((a, b) => a.localeCompare(b));

            message += `<b>TeamSpeak</b>\n`;
            justOnline.forEach(p => message += `• ${p}\n`);
            message += "\n";
        }

        // Render Empty state
        if (games.size === 0 && justOnline.length === 0) {
            message += "<i>No known friends active.</i>\n\n";
        }

        // Render Unknown TS
        if (unknownTsClients.length > 0) {
            message += "❓ <b>Unknown in TeamSpeak</b>\n";
            unknownTsClients.forEach(c => {
                message += `• ${escapeHtml(c.nickname)}\n`;
            });
            message += "\n";
        }

        message += `<i>Last updated: ${new Date().toLocaleTimeString()}</i>`;

        // 4. Update & Alerts
        const groups = await prisma.group.findMany({
            where: { pinnedMessageId: { not: null } }
        });

        // Alert Logic - use game ID for tracking alerts (only if enabled)
        if (squadAlertEnabled) {
            for (const [gameId, gameData] of games.entries()) {
                if (gameData.players.length > 1) {
                    const now = Date.now();
                    const lastTime = lastNotified.get(gameId) || 0;
                    if (now - lastTime > 1800000) { // 30 mins
                        const alertMsg = `🚀 <b>Squad Alert</b>: ${gameData.players.join(" and ")} are playing <b>${escapeHtml(gameData.gameName)}</b>!`;

                        for (const group of groups) {
                            try {
                                await api.sendMessage(group.telegramChatId.toString(), alertMsg, { parse_mode: "HTML" });
                            } catch (e) {
                                console.error("Failed to send alert:", e);
                            }
                        }
                        lastNotified.set(gameId, now);
                    }
                }
            }
        }

        // Update Pins with Refresh Button
        const keyboard = {
            inline_keyboard: [
                [{ text: "🔄 Refresh", callback_data: "refresh_board" }]
            ]
        };

        for (const group of groups) {
            if (!group.pinnedMessageId) continue;
            const chatId = group.telegramChatId.toString();

            try {
                // Check if message content is different to avoid excessive API calls if only timestamp changed? 
                // Actually timestamps always change.
                await api.editMessageText(chatId, group.pinnedMessageId, message, {
                    parse_mode: "HTML",
                    link_preview_options: { is_disabled: true },
                    reply_markup: keyboard
                });
            } catch (e: any) {
                console.error(`Failed to update message in ${chatId}:`, e.description || e.message);
            }
        }

    } catch (error) {
        console.error("Error in polling loop:", error);
    }
};
