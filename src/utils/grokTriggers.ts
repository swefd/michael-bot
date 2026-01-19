import { Context } from "grammy";
import { MyContext } from "../context.js";

// Bot name triggers (case insensitive)
const BOT_NAME_TRIGGERS = [
    "місько", "міхал", "міха", "михайло", "міша", "місю",
    "misko", "mikhal", "mikha", "mykhailo", "misha", "misyu",
    "бот", "bot", "грок", "grok"
];

// Gaming keywords that trigger Grok responses
const GAMING_KEYWORDS = [
    // English keywords
    "cs2", "cs:2", "counter-strike", "counter strike", "csgo", "cs:go",
    "faceit", "valve", "steam", "awp", "ak47", "ak-47", "m4a4", "m4a1",
    "deagle", "desert eagle", "peek", "peeking", "clutch", "clutching",
    "eco", "force buy", "full buy", "headshot", "hs", "spray", "tap",
    "rush", "rotate", "plant", "defuse", "bomb", "smoke", "flash",
    "molly", "molotov", "nade", "grenade", "dust2", "mirage", "inferno",
    "ancient", "anubis", "nuke", "vertigo", "overpass",
    "dota", "dota 2", "valorant", "apex", "apex legends",

    // Ukrainian keywords
    "калаш", "калашніков", "авп", "авпшка", "емка", "емочка",
    "пік", "пікнути", "клатч", "клатчити", "ейм", "аїм",
    "флешка", "хедшот", "спрей", "раш", "рашити",
    "дефка", "дефузити", "плант", "плантити", "смок", "моля",
    "дот", "дота", "валорант",

    // Mixed/slang
    "ez", "ggwp", "gg wp", "gl hf", "glhf", "ns", "nice shot",
    "рагає", "рофлить", "тільтує", "читер", "хакер",
];

/**
 * Check if the bot was mentioned in the message
 */
function isBotMentioned(ctx: MyContext, botUsername: string): boolean {
    if (!ctx.message || !("text" in ctx.message)) {
        return false;
    }

    const text = ctx.message.text || "";
    const entities = ctx.message.entities || [];

    // Check for @mention
    for (const entity of entities) {
        if (entity.type === "mention") {
            const mention = text.substring(entity.offset, entity.offset + entity.length);
            if (mention.toLowerCase() === `@${botUsername.toLowerCase()}`) {
                return true;
            }
        }
    }

    // Check if message starts with bot name (e.g., "Grok, ...")
    const lowerText = text.toLowerCase();
    const botNamePatterns = [
        `@${botUsername.toLowerCase()}`,
        `${botUsername.toLowerCase()},`,
        `${botUsername.toLowerCase()} `,
    ];

    for (const pattern of botNamePatterns) {
        if (lowerText.startsWith(pattern)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if the message is a reply to the bot
 */
function isReplyToBot(ctx: MyContext, botId: number): boolean {
    if (!ctx.message || !ctx.message.reply_to_message) {
        return false;
    }

    return ctx.message.reply_to_message.from?.id === botId;
}

/**
 * Check if the message contains bot name triggers
 */
function hasBotNameTrigger(text: string): boolean {
    const lowerText = text.toLowerCase();

    for (const name of BOT_NAME_TRIGGERS) {
        // Use Unicode-aware word boundaries to support Cyrillic characters
        // (?<![...]) = negative lookbehind (not preceded by word char)
        // (?![...]) = negative lookahead (not followed by word char)
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(
            `(?<![а-яА-ЯіІїЇєЄa-zA-Z0-9_])${escapedName}(?![а-яА-ЯіІїЇєЄa-zA-Z0-9_])`,
            'i'
        );
        if (regex.test(lowerText)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if the message contains gaming keywords
 */
function hasGamingKeyword(text: string): boolean {
    const lowerText = text.toLowerCase();

    for (const keyword of GAMING_KEYWORDS) {
        // Use Unicode-aware word boundaries to support Cyrillic characters
        // e.g., "cs2" should match "playing cs2" but not "awecsomeword"
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(
            `(?<![а-яА-ЯіІїЇєЄa-zA-Z0-9_])${escapedKeyword}(?![а-яА-ЯіІїЇєЄa-zA-Z0-9_])`,
            'i'
        );
        if (regex.test(lowerText)) {
            return true;
        }
    }

    return false;
}

export interface TriggerResult {
    shouldRespond: boolean;
    isDirect: boolean; // true if mentioned or replied, false if keyword-triggered
    triggerType: "mention" | "reply" | "keyword" | "none";
}

/**
 * Main function: Determine if Grok should respond to this message
 * Returns trigger information including whether it's a direct interaction
 */
export async function shouldTriggerGrok(
    ctx: MyContext,
    botUsername: string,
    botId: number
): Promise<TriggerResult> {
    // Only process text messages in groups
    if (!ctx.message || !("text" in ctx.message) || !ctx.message.text) {
        return { shouldRespond: false, isDirect: false, triggerType: "none" };
    }

    // Don't respond to other bots
    if (ctx.message.from?.is_bot) {
        return { shouldRespond: false, isDirect: false, triggerType: "none" };
    }

    // Don't respond to commands (messages starting with /)
    if (ctx.message.text.startsWith("/")) {
        return { shouldRespond: false, isDirect: false, triggerType: "none" };
    }

    const text = ctx.message.text;

    // Trigger conditions (OR logic):
    // 1. Bot is mentioned - DIRECT interaction, no cooldown
    const mentioned = isBotMentioned(ctx, botUsername);
    if (mentioned) {
        return { shouldRespond: true, isDirect: true, triggerType: "mention" };
    }

    // 2. Reply to bot - DIRECT interaction, no cooldown
    const repliedToBot = isReplyToBot(ctx, botId);
    if (repliedToBot) {
        return { shouldRespond: true, isDirect: true, triggerType: "reply" };
    }

    // 3. Message contains bot name (Місько, Міша, etc) - DIRECT interaction, no cooldown
    const hasBotName = hasBotNameTrigger(text);
    if (hasBotName) {
        return { shouldRespond: true, isDirect: true, triggerType: "mention" };
    }

    // 4. Message contains gaming keywords - INDIRECT trigger, cooldown applies
    const hasKeyword = hasGamingKeyword(text);
    if (hasKeyword) {
        return { shouldRespond: true, isDirect: false, triggerType: "keyword" };
    }

    return { shouldRespond: false, isDirect: false, triggerType: "none" };
}

/**
 * Get a list of detected keywords in a message (for logging/debugging)
 */
export function getDetectedKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    const detected: string[] = [];

    // Check bot name triggers
    for (const name of BOT_NAME_TRIGGERS) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(
            `(?<![а-яА-ЯіІїЇєЄa-zA-Z0-9_])${escapedName}(?![а-яА-ЯіІїЇєЄa-zA-Z0-9_])`,
            'i'
        );
        if (regex.test(lowerText)) {
            detected.push(name);
        }
    }

    // Check gaming keywords
    for (const keyword of GAMING_KEYWORDS) {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(
            `(?<![а-яА-ЯіІїЇєЄa-zA-Z0-9_])${escapedKeyword}(?![а-яА-ЯіІїЇєЄa-zA-Z0-9_])`,
            'i'
        );
        if (regex.test(lowerText)) {
            detected.push(keyword);
        }
    }

    return detected;
}
