import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import { registerCommand } from "../utils/commandRegistry.js";
import { t } from "../utils/i18n.js";
import { checkAICooldown, resetAIService, getProviderChain } from "../services/aiService.js";
import { ProviderStatus, ProviderType } from "../services/ai/providers/AIProvider.js";
import { setProviderPriority, getProviderPriority } from "../services/ai/ProviderConfig.js";

/**
 * Check if user is admin
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
 * /enable_ai - Enable AI for this chat
 */
export const enableAIHandler = async (ctx: MyContext) => {
    if (!ctx.chat || ctx.chat.type === "private") {
        return ctx.reply(t(ctx, "grok.group_only"));
    }

    const admin = await isAdmin(ctx);
    if (!admin) {
        return ctx.reply(t(ctx, "grok.admin_only"));
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        await prisma.aIChatSettings.upsert({
            where: { chatId },
            update: { enabled: true },
            create: {
                chatId,
                enabled: true,
                cooldownMinutes: parseInt(process.env.GROK_DEFAULT_COOLDOWN_MINUTES || process.env.AI_DEFAULT_COOLDOWN_MINUTES || "7"),
            },
        });

        await ctx.reply(t(ctx, "grok.enabled"));
        console.log(`✅ AI enabled for chat ${chatId}`);
    } catch (error) {
        console.error("Error enabling AI:", error);
        await ctx.reply(t(ctx, "grok.error"));
    }
};

/**
 * /disable_ai - Disable AI for this chat
 */
export const disableAIHandler = async (ctx: MyContext) => {
    if (!ctx.chat || ctx.chat.type === "private") {
        return ctx.reply(t(ctx, "grok.group_only"));
    }

    const admin = await isAdmin(ctx);
    if (!admin) {
        return ctx.reply(t(ctx, "grok.admin_only"));
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        await prisma.aIChatSettings.upsert({
            where: { chatId },
            update: { enabled: false },
            create: {
                chatId,
                enabled: false,
                cooldownMinutes: parseInt(process.env.GROK_DEFAULT_COOLDOWN_MINUTES || process.env.AI_DEFAULT_COOLDOWN_MINUTES || "7"),
            },
        });

        await ctx.reply(t(ctx, "grok.disabled"));
        console.log(`❌ AI disabled for chat ${chatId}`);
    } catch (error) {
        console.error("Error disabling AI:", error);
        await ctx.reply(t(ctx, "grok.error"));
    }
};

/**
 * /set_ai_key - Set API key for a specific provider
 * Usage: /set_ai_key <provider> <api_key>
 * Example: /set_ai_key openai sk-...
 */
export const setAIKeyHandler = async (ctx: MyContext) => {
    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        return ctx.reply(
            "Usage: <code>/set_ai_key &lt;provider&gt; &lt;api_key&gt;</code>\n\n" +
            "Providers: grok, openai\n" +
            "Example: <code>/set_ai_key openai sk-...</code>\n\n" +
            "⚠️ Make sure to delete your message after setting the key for security!",
            { parse_mode: "HTML" }
        );
    }

    const parts = args.trim().split(/\s+/);
    if (parts.length !== 2) {
        return ctx.reply("❌ Invalid format. Use: /set_ai_key <provider> <api_key>");
    }

    const [provider, apiKey] = parts;
    const validProviders = ['grok', 'openai'];

    if (!validProviders.includes(provider.toLowerCase())) {
        return ctx.reply(`❌ Invalid provider. Must be one of: ${validProviders.join(', ')}`);
    }

    if (apiKey.length < 10) {
        return ctx.reply("❌ API key seems too short. Please check and try again.");
    }

    try {
        // Disable all existing keys for this provider
        await prisma.aIProviderKey.updateMany({
            where: { provider: provider.toLowerCase() },
            data: { enabled: false }
        });

        // Insert new key
        await prisma.aIProviderKey.create({
            data: {
                provider: provider.toLowerCase(),
                apiKey,
                enabled: true
            }
        });

        // Reset the AI service to pick up new key
        resetAIService();

        // Delete the user's message for security
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.warn("Could not delete message with API key");
        }

        await ctx.reply(
            `✅ <b>${provider} API key updated successfully!</b>\n\n` +
            "The new key is now active.\n" +
            "Your message with the key has been deleted for security.",
            { parse_mode: "HTML" }
        );

        console.log(`✅ ${provider} API key updated`);
    } catch (error) {
        console.error(`Error setting ${provider} API key:`, error);
        await ctx.reply("❌ Failed to update API key. Check logs.");
    }
};

/**
 * /ai_status - Show AI provider status for this chat
 */
export const aiStatusHandler = async (ctx: MyContext) => {
    if (!ctx.chat || ctx.chat.type === "private") {
        return ctx.reply(t(ctx, "grok.group_only"));
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        const settings = await prisma.aIChatSettings.findUnique({
            where: { chatId },
        });

        if (!settings) {
            return ctx.reply(t(ctx, "grok.status_not_configured"));
        }

        const cooldownStatus = await checkAICooldown(chatId);
        const chain = getProviderChain();
        const currentPriority = await getProviderPriority();

        let statusMessage = `<b>${t(ctx, "grok.status_title")}</b>\n\n`;
        statusMessage += `${t(ctx, "grok.status_enabled")}: ${settings.enabled ? "✅" : "❌"}\n`;
        statusMessage += `${t(ctx, "grok.status_cooldown")}: ${settings.cooldownMinutes} ${t(ctx, "grok.minutes")}\n`;

        if (settings.lastUsedProvider) {
            statusMessage += `Last Provider: ${settings.lastUsedProvider}\n`;
        }

        // Show provider priority order
        statusMessage += `\n<b>Provider Priority:</b> ${currentPriority.join(' → ')}\n`;

        // Show available providers
        if (chain) {
            const providers = chain.getProviders();
            statusMessage += `\n<b>Available Providers:</b>\n`;

            for (const provider of providers) {
                const config = provider.getConfig();
                const status = await provider.isReady();
                const statusEmoji = status === ProviderStatus.READY ? '✅' :
                                  status === ProviderStatus.NOT_CONFIGURED ? '⚠️' : '❌';
                statusMessage += `${statusEmoji} ${config.type} (priority: ${config.priority})\n`;
            }
        }

        if (settings.enabled) {
            if (cooldownStatus.onCooldown) {
                statusMessage += `\n⏰ ${t(ctx, "grok.on_cooldown", { minutes: cooldownStatus.minutesRemaining.toString() })}`;
            } else {
                statusMessage += `\n✅ ${t(ctx, "grok.ready")}`;
            }
        }

        await ctx.reply(statusMessage, { parse_mode: "HTML" });
    } catch (error) {
        console.error("Error getting AI status:", error);
        await ctx.reply(t(ctx, "grok.error"));
    }
};

/**
 * /set_ai_priority - Configure provider priority order
 * Usage: /set_ai_priority <provider1>,<provider2>
 * Example: /set_ai_priority openai,grok
 */
export const setAIPriorityHandler = async (ctx: MyContext) => {
    const args = ctx.match;
    if (typeof args !== "string" || !args) {
        const validProviders = Object.values(ProviderType).join(', ');
        return ctx.reply(
            "Usage: <code>/set_ai_priority &lt;provider1&gt;,&lt;provider2&gt;</code>\n\n" +
            `Available providers: ${validProviders}\n\n` +
            "Examples:\n" +
            "<code>/set_ai_priority grok,openai</code> - Try Grok first, then OpenAI\n" +
            "<code>/set_ai_priority openai,grok</code> - Try OpenAI first, then Grok\n" +
            "<code>/set_ai_priority openai</code> - Use only OpenAI",
            { parse_mode: "HTML" }
        );
    }

    const providersInput = args.trim().split(',').map(p => p.trim().toLowerCase());
    const validProviders = Object.values(ProviderType);

    // Validate all providers
    const invalidProviders = providersInput.filter(p => !validProviders.includes(p as ProviderType));
    if (invalidProviders.length > 0) {
        return ctx.reply(`❌ Invalid provider(s): ${invalidProviders.join(', ')}\n\nValid providers: ${validProviders.join(', ')}`);
    }

    // Remove duplicates
    const uniqueProviders = [...new Set(providersInput)] as ProviderType[];

    try {
        await setProviderPriority(uniqueProviders);

        // Reset AI service to apply new priority
        resetAIService();

        await ctx.reply(
            `✅ <b>Provider priority updated!</b>\n\n` +
            `New order: ${uniqueProviders.join(' → ')}\n\n` +
            `The AI service will now try providers in this order.\n` +
            `Restart the bot to fully apply changes.`,
            { parse_mode: "HTML" }
        );

        console.log(`✅ Provider priority set to: ${uniqueProviders.join(',')}`);
    } catch (error) {
        console.error("Error setting provider priority:", error);
        await ctx.reply("❌ Failed to update provider priority. Check logs.");
    }
};

// Register new commands
registerCommand({
    name: "enable_ai",
    description: "[Admin] Enable AI responses",
    handler: enableAIHandler,
    adminOnly: true,
});

registerCommand({
    name: "disable_ai",
    description: "[Admin] Disable AI responses",
    handler: disableAIHandler,
    adminOnly: true,
});

registerCommand({
    name: "ai_status",
    description: "Show AI provider status",
    handler: aiStatusHandler,
    adminOnly: false,
});

registerCommand({
    name: "set_ai_key",
    description: "[Admin] Set API key for AI provider",
    handler: setAIKeyHandler,
    adminOnly: true,
});

registerCommand({
    name: "set_ai_priority",
    description: "[Admin] Configure AI provider priority order",
    handler: setAIPriorityHandler,
    adminOnly: true,
});

// Backward compatibility aliases
registerCommand({
    name: "enable_grok",
    description: "[Admin] Enable AI responses (alias)",
    handler: enableAIHandler,
    adminOnly: true,
});

registerCommand({
    name: "disable_grok",
    description: "[Admin] Disable AI responses (alias)",
    handler: disableAIHandler,
    adminOnly: true,
});

registerCommand({
    name: "grok_status",
    description: "Show AI status (alias)",
    handler: aiStatusHandler,
    adminOnly: false,
});
