import SteamUser from "steam-user";
import { Bot } from "grammy";
import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { logger } from "../utils/logger.js";

const client = new SteamUser();

// Cache for Rich Presence [SteamID -> Status String]
const rpCache = new Map<string, string>();

// Cooldown for match alerts [SteamID -> Timestamp]
const alertCooldowns = new Map<string, number>();

export const getRichPresence = (steamId: string) => {
    return rpCache.get(steamId);
};

export const initSteamUserBot = async (bot: Bot<MyContext>) => {
    const username = process.env.STEAM_USERNAME;
    const password = process.env.STEAM_PASSWORD;
    const refreshToken = process.env.STEAM_REFRESH_TOKEN;

    // Login options
    const logOnOptions: any = {};

    if (refreshToken) {
        logger.log("Steam: Logging in with Refresh Token...");
        logOnOptions.refreshToken = refreshToken;
    } else if (username && password) {
        logger.log("Steam: Logging in with Username/Password...");
        logOnOptions.accountName = username;
        logOnOptions.password = password;
    } else {
        logger.warn("Skipping Steam User Bot: No Password or Refresh Token provided.");
        return;
    }

    client.logOn(logOnOptions);

    // If we get a new token (e.g. after password login), log it for the user
    client.on("refreshToken", (token) => {
        if (!process.env.STEAM_REFRESH_TOKEN) {
            logger.log("\n[STEAM BOT] 🔑 Generatred new Refresh Token!");
            logger.log("Add this to your .env to avoid using your password:");
            logger.log(`STEAM_REFRESH_TOKEN=${token}\n`);
        }
    });

    client.on("loggedOn", () => {
        const steamId = client.steamID?.getSteamID64();
        logger.log(`Steam User Bot logged in as ${steamId}`);
        client.setPersona(SteamUser.EPersonaState.Online);

        // Optional: Poll for Rich Presence (only for debugging)
        // Enable by setting STEAM_ENABLE_RP_POLLING=true in .env
        if (client.steamID && process.env.STEAM_ENABLE_RP_POLLING === 'true') {
            const myId = client.steamID.getSteamID64();
            logger.info(`Starting self-RP polling for ${myId}`);
            setInterval(() => {
                logger.info(`Requesting RP for self (CS2)...`);
                // CS2 AppID = 730
                // Note: This may timeout if not playing CS2, which causes uncaught errors
                client.requestRichPresence(730, [myId], "english");
            }, 10000);
        }
    });

    client.on("error", (err) => {
        logger.error("Steam User Bot Error:", err);
    });

    client.on("user", (sid, user) => {
        const steamId = sid.getSteamID64();
        logger.info(`User event for ${steamId}`, {
            hasRP: !!user.rich_presence,
            rpLength: user.rich_presence?.length || 0,
            gameid: user.gameid,
            game_name: user.game_name
        });

        // Handle rich presence updates
        if (user.rich_presence && user.rich_presence.length > 0) {
            handleRichPresence(bot, steamId, user.rich_presence);
        }
    });
};

const handleRichPresence = async (bot: Bot<MyContext>, steamId: string, rp: any[]) => {
    // Convert RP array to object for easier access
    const rpData: Record<string, string> = {};
    rp.forEach((item: any) => {
        rpData[item.key] = item.value;
    });

    logger.info(`RP Data for ${steamId}:`, JSON.stringify(rpData));

    // 1. Update Cache
    // steam_display often contains localization tokens like "#display_GameKnownMapScore"
    // Use 'status' field which contains the actual readable text
    let displayText = rpData.steam_display;

    // If steam_display is a localization token (starts with #), use status instead
    if (displayText && displayText.startsWith('#') && rpData.status) {
        displayText = rpData.status;
    }

    if (displayText) {
        logger.info(`Cache updated for ${steamId}: ${displayText}`);
        rpCache.set(steamId, displayText);
    } else {
        logger.info(`No displayable status for ${steamId}`);
    }

    // 2. Check Match Point
    const display = rpData.steam_display;
    if (!display) return;

    if (display.toLowerCase().includes("score:")) {
        await checkMatchPoint(bot, steamId, display);
    }
};

const checkMatchPoint = async (bot: Bot<MyContext>, steamId: string, display: string) => {
    // Parse score. Format usually "score: CT:T" or "score: 12:10"
    const match = display.match(/score:\s*(\d+):(\d+)/i);
    if (!match) return;

    const s1 = parseInt(match[1]);
    const s2 = parseInt(match[2]);
    const maxScore = Math.max(s1, s2);
    const totalRounds = s1 + s2;

    // Win condition 13. Match point at 12.
    let isMatchPoint = false;
    if (maxScore === 12) isMatchPoint = true;

    // Warning for high rounds (OT potential)
    if (totalRounds >= 23 && s1 === s2) {
        isMatchPoint = true;
    }

    if (isMatchPoint) {
        const now = Date.now();
        const last = alertCooldowns.get(steamId) || 0;

        // Cooldown 20 mins per user
        if (now - last > 1200000) {
            const user = await prisma.user.findUnique({ where: { steamId } });
            if (!user) return; // Not a linked user

            const groups = await prisma.group.findMany({ where: { pinnedMessageId: { not: null } } });

            const msg = `🎾 **Match Point Alert**\n\n**${user.tsAlias || "Friend"}** is at match point in CS2!\nCurrent Score: **${s1}:${s2}**\nGet ready for the next game!`;

            for (const group of groups) {
                try {
                    await bot.api.sendMessage(group.telegramChatId.toString(), msg, { parse_mode: "Markdown" });
                } catch (e) { console.error(e); }
            }

            alertCooldowns.set(steamId, now);
        }
    }
};
