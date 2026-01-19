import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { registerCommand } from "../utils/commandRegistry.js";
import { t } from "../utils/i18n.js";
import { checkCooldown, resetGrokClient } from "../services/grok.js";

/**
 * Check if user is admin in the chat
 */
async function isAdmin(ctx: MyContext): Promise<boolean> {
    if (!ctx.chat || !ctx.from) return false;

    try {
        const member = await ctx.getChatMember(ctx.from.id);
        return ["creator", "administrator"].includes(member.status);
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

/**
 * /enable_grok - Enable Grok AI for this chat
 */
export const enableGrokHandler = async (ctx: MyContext) => {
    // Check if used in group
    if (!ctx.chat || ctx.chat.type === "private") {
        return ctx.reply(t(ctx, "grok.group_only"));
    }

    // Check if user is admin
    const admin = await isAdmin(ctx);
    if (!admin) {
        return ctx.reply(t(ctx, "grok.admin_only"));
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        // Upsert settings
        await prisma.grokChatSettings.upsert({
            where: { chatId },
            update: { enabled: true },
            create: {
                chatId,
                enabled: true,
                cooldownMinutes: parseInt(process.env.GROK_DEFAULT_COOLDOWN_MINUTES || "7"),
            },
        });

        await ctx.reply(t(ctx, "grok.enabled"));
        console.log(`✅ Grok enabled for chat ${chatId}`);
    } catch (error) {
        console.error("Error enabling Grok:", error);
        await ctx.reply(t(ctx, "grok.error"));
    }
};

/**
 * /disable_grok - Disable Grok AI for this chat
 */
export const disableGrokHandler = async (ctx: MyContext) => {
    // Check if used in group
    if (!ctx.chat || ctx.chat.type === "private") {
        return ctx.reply(t(ctx, "grok.group_only"));
    }

    // Check if user is admin
    const admin = await isAdmin(ctx);
    if (!admin) {
        return ctx.reply(t(ctx, "grok.admin_only"));
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        // Update or create settings with enabled=false
        await prisma.grokChatSettings.upsert({
            where: { chatId },
            update: { enabled: false },
            create: {
                chatId,
                enabled: false,
                cooldownMinutes: parseInt(process.env.GROK_DEFAULT_COOLDOWN_MINUTES || "7"),
            },
        });

        await ctx.reply(t(ctx, "grok.disabled"));
        console.log(`❌ Grok disabled for chat ${chatId}`);
    } catch (error) {
        console.error("Error disabling Grok:", error);
        await ctx.reply(t(ctx, "grok.error"));
    }
};

/**
 * /set_grok_key - Update the Grok API key
 */
export const setGrokKeyHandler = async (ctx: MyContext) => {
    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        return ctx.reply(
            "Usage: <code>/set_grok_key &lt;api_key&gt;</code>\n\n" +
            "This will update the Grok API key used by the bot.\n" +
            "⚠️ Make sure to delete your message after setting the key for security!",
            { parse_mode: "HTML" }
        );
    }

    const apiKey = args.trim();

    // Basic validation
    if (apiKey.length < 10) {
        return ctx.reply("❌ API key seems too short. Please check and try again.");
    }

    try {
        // Delete all existing keys and insert the new one
        await prisma.grokApiKey.deleteMany({});
        await prisma.grokApiKey.create({
            data: { apiKey }
        });

        // Reset the client so it picks up the new key
        resetGrokClient();

        // Delete the user's message containing the API key for security
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.warn("Could not delete message with API key");
        }

        await ctx.reply(
            "✅ <b>Grok API key updated successfully!</b>\n\n" +
            "The new key is now active and will be used for all Grok requests.\n" +
            "Your message with the key has been deleted for security.",
            { parse_mode: "HTML" }
        );

        console.log("✅ Grok API key updated");
    } catch (error) {
        console.error("Error setting Grok API key:", error);
        await ctx.reply("❌ Failed to update API key. Check logs.");
    }
};

/**
 * /grok_status - Show Grok settings and status for this chat
 */
export const grokStatusHandler = async (ctx: MyContext) => {
    // Check if used in group
    if (!ctx.chat || ctx.chat.type === "private") {
        return ctx.reply(t(ctx, "grok.group_only"));
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        const settings = await prisma.grokChatSettings.findUnique({
            where: { chatId },
        });

        if (!settings) {
            return ctx.reply(t(ctx, "grok.status_not_configured"));
        }

        const cooldownStatus = await checkCooldown(chatId);

        let statusMessage = `<b>${t(ctx, "grok.status_title")}</b>\n\n`;
        statusMessage += `${t(ctx, "grok.status_enabled")}: ${settings.enabled ? "✅" : "❌"}\n`;
        statusMessage += `${t(ctx, "grok.status_cooldown")}: ${settings.cooldownMinutes} ${t(ctx, "grok.minutes")}\n`;

        if (settings.enabled) {
            if (cooldownStatus.onCooldown) {
                statusMessage += `\n⏰ ${t(ctx, "grok.on_cooldown", { minutes: cooldownStatus.minutesRemaining.toString() })}`;
            } else {
                statusMessage += `\n✅ ${t(ctx, "grok.ready")}`;
            }
        }

        await ctx.reply(statusMessage, { parse_mode: "HTML" });
    } catch (error) {
        console.error("Error getting Grok status:", error);
        await ctx.reply(t(ctx, "grok.error"));
    }
};

// Register commands
registerCommand({
    name: "enable_grok",
    description: "[Admin] Enable Grok AI responses",
    handler: enableGrokHandler,
    adminOnly: true,
});

registerCommand({
    name: "disable_grok",
    description: "[Admin] Disable Grok AI responses",
    handler: disableGrokHandler,
    adminOnly: true,
});

registerCommand({
    name: "grok_status",
    description: "Show Grok AI status for this chat",
    handler: grokStatusHandler,
    adminOnly: false,
});

registerCommand({
    name: "set_grok_key",
    description: "[Admin] Update the Grok API key",
    handler: setGrokKeyHandler,
    adminOnly: true,
});
