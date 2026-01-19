import { MyContext } from "../context.js";
import { registerCommand } from "../utils/commandRegistry.js";
import {
    getUserFacts,
    clearUserFacts,
    analyzeAndExtractFacts,
    analyzeEntireHistory,
    isFactExtractionEnabled
} from "../services/factExtraction.js";

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
 * /my_facts - View facts the AI has learned about you
 */
export const myFactsHandler = async (ctx: MyContext) => {
    if (!ctx.chat || !ctx.from) {
        return ctx.reply("This command can only be used in a chat.");
    }

    if (!isFactExtractionEnabled()) {
        return ctx.reply("❌ Fact extraction is currently disabled.");
    }

    const chatId = BigInt(ctx.chat.id);
    const userId = BigInt(ctx.from.id);

    try {
        const facts = await getUserFacts(userId, chatId);

        if (facts.length === 0) {
            return ctx.reply(
                "📝 I haven't learned any facts about you yet!\n\n" +
                "Keep chatting and I'll pick up on your interests, preferences, and more."
            );
        }

        // Group facts by type
        const factsByType = new Map<string, string[]>();
        for (const fact of facts) {
            if (!factsByType.has(fact.factType)) {
                factsByType.set(fact.factType, []);
            }
            const confidence = Math.round(fact.confidence * 100);
            factsByType.get(fact.factType)!.push(`• ${fact.fact} (${confidence}% confidence)`);
        }

        // Build response
        let response = `📝 <b>Facts I've learned about you:</b>\n\n`;

        for (const [type, factList] of factsByType) {
            const emoji = getEmojiForFactType(type);
            response += `${emoji} <b>${capitalizeFirstLetter(type)}:</b>\n`;
            factList.forEach(f => {
                response += `${f}\n`;
            });
            response += '\n';
        }

        response += `<i>Total: ${facts.length} fact(s)</i>\n`;
        response += `\nUse /clear_my_facts to reset this information.`;

        await ctx.reply(response, { parse_mode: "HTML" });

    } catch (error) {
        console.error("Error retrieving user facts:", error);
        await ctx.reply("❌ Failed to retrieve facts. Check logs.");
    }
};

/**
 * /clear_my_facts - Clear all facts about yourself
 */
export const clearMyFactsHandler = async (ctx: MyContext) => {
    if (!ctx.chat || !ctx.from) {
        return ctx.reply("This command can only be used in a chat.");
    }

    if (!isFactExtractionEnabled()) {
        return ctx.reply("❌ Fact extraction is currently disabled.");
    }

    const chatId = BigInt(ctx.chat.id);
    const userId = BigInt(ctx.from.id);

    try {
        const count = await clearUserFacts(userId, chatId);

        if (count === 0) {
            return ctx.reply("📝 I don't have any facts about you to clear.");
        }

        await ctx.reply(
            `✅ Cleared ${count} fact(s) about you.\n\n` +
            `I'll start learning about you again from our future conversations.`
        );

    } catch (error) {
        console.error("Error clearing user facts:", error);
        await ctx.reply("❌ Failed to clear facts. Check logs.");
    }
};

/**
 * /analyze_facts - Manually trigger fact extraction (admin only)
 */
export const analyzeFactsHandler = async (ctx: MyContext) => {
    if (!ctx.chat) {
        return ctx.reply("This command can only be used in a chat.");
    }

    if (!isFactExtractionEnabled()) {
        return ctx.reply("❌ Fact extraction is currently disabled.");
    }

    const admin = await isAdmin(ctx);
    if (!admin) {
        return ctx.reply("❌ This command is only available to administrators.");
    }

    const chatId = BigInt(ctx.chat.id);

    await ctx.reply("🔄 Analyzing recent messages and extracting facts...");

    try {
        const count = await analyzeAndExtractFacts(chatId);

        if (count === 0) {
            await ctx.reply(
                "📝 Analysis complete, but no new facts were extracted.\n\n" +
                "This could mean:\n" +
                "• Recent messages don't contain factual information\n" +
                "• Similar facts were already known\n" +
                "• Not enough messages to analyze"
            );
        } else {
            await ctx.reply(
                `✅ Analysis complete!\n\n` +
                `Extracted ${count} new fact(s) from recent messages.`
            );
        }

    } catch (error) {
        console.error("Error analyzing facts:", error);
        await ctx.reply("❌ Failed to analyze facts. Check logs.");
    }
};

/**
 * /analyze_history - Analyze entire chat history (admin only)
 * Usage: /analyze_history [max_messages]
 */
export const analyzeHistoryHandler = async (ctx: MyContext) => {
    if (!ctx.chat) {
        return ctx.reply("This command can only be used in a chat.");
    }

    if (!isFactExtractionEnabled()) {
        return ctx.reply("❌ Fact extraction is currently disabled.");
    }

    const admin = await isAdmin(ctx);
    if (!admin) {
        return ctx.reply("❌ This command is only available to administrators.");
    }

    const chatId = BigInt(ctx.chat.id);

    // Parse optional max messages parameter
    const args = ctx.match;
    let maxMessages = 10000; // Default limit
    if (typeof args === "string" && args.trim()) {
        const parsed = parseInt(args.trim());
        if (!isNaN(parsed) && parsed > 0) {
            maxMessages = Math.min(parsed, 10000); // Cap at 10,000
        }
    }

    // Send initial message
    const initialMsg = await ctx.reply(
        `🔄 <b>Analyzing chat history...</b>\n\n` +
        `This will process up to ${maxMessages} messages.\n` +
        `⏳ This may take several minutes. I'll update you on progress.`,
        { parse_mode: "HTML" }
    );

    try {
        let lastUpdateTime = Date.now();
        const progressCallback = async (processed: number, total: number, newFacts: number) => {
            const now = Date.now();
            // Update every 10 seconds to avoid rate limits
            if (now - lastUpdateTime > 10000) {
                try {
                    const progress = Math.round((processed / total) * 100);
                    await ctx.api.editMessageText(
                        ctx.chat!.id,
                        initialMsg.message_id,
                        `🔄 <b>Analyzing chat history...</b>\n\n` +
                        `Progress: ${processed}/${total} messages (${progress}%)\n` +
                        `Facts extracted: ${newFacts}\n\n` +
                        `⏳ Please wait...`,
                        { parse_mode: "HTML" }
                    );
                    lastUpdateTime = now;
                } catch (error) {
                    // Ignore edit errors (rate limit, etc.)
                }
            }
        };

        const result = await analyzeEntireHistory(chatId, {
            batchSize: 20,
            maxMessages: maxMessages,
            onProgress: progressCallback
        });

        // Send final result
        await ctx.api.editMessageText(
            ctx.chat.id,
            initialMsg.message_id,
            `✅ <b>History analysis complete!</b>\n\n` +
            `📊 <b>Results:</b>\n` +
            `• Messages processed: ${result.totalProcessed}\n` +
            `• New facts extracted: ${result.totalFacts}\n` +
            `• Batches processed: ${result.batches}\n\n` +
            `<i>Facts are now available for personalized responses!</i>`,
            { parse_mode: "HTML" }
        );

    } catch (error) {
        console.error("Error analyzing history:", error);
        await ctx.api.editMessageText(
            ctx.chat.id,
            initialMsg.message_id,
            `❌ <b>Analysis failed</b>\n\n` +
            `An error occurred during analysis. Check logs for details.`,
            { parse_mode: "HTML" }
        );
    }
};

/**
 * /fact_status - Show fact extraction status
 */
export const factStatusHandler = async (ctx: MyContext) => {
    if (!ctx.chat) {
        return ctx.reply("This command can only be used in a chat.");
    }

    const chatId = BigInt(ctx.chat.id);

    try {
        const { prisma } = await import("../db.js");

        // Count total facts in this chat
        const totalFacts = await prisma.userFact.count({
            where: {
                chatId: chatId,
                isActive: true
            }
        });

        // Count unique users with facts
        const uniqueUsers = await prisma.userFact.groupBy({
            by: ['userId'],
            where: {
                chatId: chatId,
                isActive: true
            }
        });

        // Count facts by type
        const factsByType = await prisma.userFact.groupBy({
            by: ['factType'],
            where: {
                chatId: chatId,
                isActive: true
            },
            _count: {
                factType: true
            }
        });

        let response = `📊 <b>Fact Extraction Status</b>\n\n`;
        response += `Status: ${isFactExtractionEnabled() ? '✅ Enabled' : '❌ Disabled'}\n\n`;

        if (isFactExtractionEnabled()) {
            response += `📝 <b>Statistics for this chat:</b>\n`;
            response += `• Total facts: ${totalFacts}\n`;
            response += `• Users tracked: ${uniqueUsers.length}\n\n`;

            if (factsByType.length > 0) {
                response += `<b>Facts by type:</b>\n`;
                factsByType.forEach(type => {
                    const emoji = getEmojiForFactType(type.factType);
                    response += `${emoji} ${capitalizeFirstLetter(type.factType)}: ${type._count.factType}\n`;
                });
            }

            response += `\n<i>Facts help me remember your preferences and interests!</i>`;
        }

        await ctx.reply(response, { parse_mode: "HTML" });

    } catch (error) {
        console.error("Error getting fact status:", error);
        await ctx.reply("❌ Failed to get status. Check logs.");
    }
};

/**
 * Helper: Get emoji for fact type
 */
function getEmojiForFactType(type: string): string {
    const emojiMap: Record<string, string> = {
        'interest': '🎯',
        'preference': '⭐',
        'personal_info': 'ℹ️',
        'skill': '🏆',
        'opinion': '💭',
        'game': '🎮'
    };
    return emojiMap[type] || '📌';
}

/**
 * Helper: Capitalize first letter
 */
function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

// Register commands
registerCommand({
    name: "my_facts",
    description: "View facts the AI has learned about you",
    handler: myFactsHandler,
    adminOnly: false,
});

registerCommand({
    name: "clear_my_facts",
    description: "Clear all facts about yourself",
    handler: clearMyFactsHandler,
    adminOnly: false,
});

registerCommand({
    name: "analyze_facts",
    description: "[Admin] Manually trigger fact extraction",
    handler: analyzeFactsHandler,
    adminOnly: true,
});

registerCommand({
    name: "fact_status",
    description: "Show fact extraction statistics",
    handler: factStatusHandler,
    adminOnly: false,
});

registerCommand({
    name: "analyze_history",
    description: "[Admin] Analyze entire chat history for facts",
    handler: analyzeHistoryHandler,
    adminOnly: true,
});
