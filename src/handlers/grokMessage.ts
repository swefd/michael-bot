import { NextFunction } from "grammy";
import { MyContext } from "../context.js";
import { prisma } from "../db.js";
import {
    generateGrokResponse,
    isGrokEnabled,
    checkCooldown,
    updateLastResponseTime,
} from "../services/grok.js";
import { shouldTriggerGrok, getDetectedKeywords } from "../utils/grokTriggers.js";
import { analyzeAndExtractFacts, isFactExtractionEnabled } from "../services/factExtraction.js";

// Maximum number of messages to keep per chat
const MAX_MESSAGES_PER_CHAT = 30;

// Rate limiting for message storage (prevent spam)
const storageRateLimit = new Map<string, number>();
const STORAGE_RATE_LIMIT_MS = 1000; // 1 second between storage operations per chat

// Rate limiting for fact extraction (prevent excessive AI calls)
const factExtractionRateLimit = new Map<string, number>();
const FACT_EXTRACTION_RATE_LIMIT_MS = parseInt(process.env.FACT_EXTRACTION_INTERVAL_MS || '300000'); // 5 minutes default
const factExtractionMessageCount = new Map<string, number>(); // Track message count per chat

/**
 * Store a message to the database and cleanup old messages
 */
async function storeMessage(
    chatId: bigint,
    messageId: number,
    userId: bigint,
    username: string | undefined,
    content: string
): Promise<void> {
    try {
        const chatKey = chatId.toString();
        const now = Date.now();
        const lastStorage = storageRateLimit.get(chatKey) || 0;

        // Rate limiting
        if (now - lastStorage < STORAGE_RATE_LIMIT_MS) {
            return;
        }

        // Store message
        await prisma.chatMessage.create({
            data: {
                chatId,
                messageId,
                userId,
                username: username || null,
                content,
            },
        });

        // Cleanup old messages - keep only last MAX_MESSAGES_PER_CHAT
        const messages = await prisma.chatMessage.findMany({
            where: { chatId },
            orderBy: { timestamp: "desc" },
            select: { id: true },
        });

        if (messages.length > MAX_MESSAGES_PER_CHAT) {
            const messagesToDelete = messages.slice(MAX_MESSAGES_PER_CHAT);
            const idsToDelete = messagesToDelete.map(m => m.id);

            await prisma.chatMessage.deleteMany({
                where: { id: { in: idsToDelete } },
            });
        }

        storageRateLimit.set(chatKey, now);

        // Trigger fact extraction periodically
        triggerFactExtraction(chatId, chatKey, now);

    } catch (error) {
        console.error("Error storing message:", error);
    }
}

/**
 * Trigger fact extraction if rate limit allows
 */
function triggerFactExtraction(chatId: bigint, chatKey: string, now: number): void {
    if (!isFactExtractionEnabled()) {
        return;
    }

    // Increment message count
    const currentCount = factExtractionMessageCount.get(chatKey) || 0;
    factExtractionMessageCount.set(chatKey, currentCount + 1);

    const lastExtraction = factExtractionRateLimit.get(chatKey) || 0;
    const timeSinceLastExtraction = now - lastExtraction;
    const messagesSinceLastExtraction = currentCount;

    // Trigger extraction if:
    // 1. Enough time has passed (5 minutes default), OR
    // 2. Enough messages accumulated (10 messages default)
    const MESSAGES_THRESHOLD = parseInt(process.env.FACT_EXTRACTION_MESSAGE_THRESHOLD || '10');

    if (timeSinceLastExtraction >= FACT_EXTRACTION_RATE_LIMIT_MS ||
        messagesSinceLastExtraction >= MESSAGES_THRESHOLD) {

        // Reset counters
        factExtractionRateLimit.set(chatKey, now);
        factExtractionMessageCount.set(chatKey, 0);

        // Run extraction in background (non-blocking)
        analyzeAndExtractFacts(chatId)
            .then(count => {
                if (count > 0) {
                    console.log(`📝 Extracted ${count} new facts from chat ${chatId}`);
                }
            })
            .catch(err => {
                console.error("Error in fact extraction:", err);
            });
    }
}

/**
 * Main middleware function for Grok message handling
 */
export async function grokMessageMiddleware(
    ctx: MyContext,
    next: NextFunction
): Promise<void> {
    // Only process messages in groups
    if (!ctx.chat || ctx.chat.type === "private") {
        return next();
    }

    // Only process text messages
    if (!ctx.message || !("text" in ctx.message) || !ctx.message.text) {
        return next();
    }

    const chatId = BigInt(ctx.chat.id);
    const messageId = ctx.message.message_id;
    const userId = BigInt(ctx.message.from.id);
    const username = ctx.message.from.username || ctx.message.from.first_name;
    const text = ctx.message.text;

    // Store message to database (async, non-blocking)
    storeMessage(chatId, messageId, userId, username, text).catch(err => {
        console.error("Error in storeMessage:", err);
    });

    // Get bot info
    const botInfo = await ctx.api.getMe();
    const botUsername = botInfo.username || "";
    const botId = botInfo.id;

    // Check if this message should trigger Grok
    const triggerResult = await shouldTriggerGrok(ctx, botUsername, botId);

    if (!triggerResult.shouldRespond) {
        return next();
    }

    // Log detected triggers for debugging
    console.log(`🎮 Grok triggered by: ${triggerResult.triggerType}`);
    if (triggerResult.triggerType === "keyword") {
        const detectedKeywords = getDetectedKeywords(text);
        console.log(`   Keywords: ${detectedKeywords.join(", ")}`);
    }

    try {
        // Check if Grok is enabled for this chat
        const enabled = await isGrokEnabled(chatId);
        if (!enabled) {
            console.log(`⏭️  Grok not enabled for chat ${chatId}`);
            return next();
        }

        // Check cooldown ONLY for keyword-triggered messages (not direct mentions/replies)
        if (!triggerResult.isDirect) {
            const cooldownStatus = await checkCooldown(chatId);
            if (cooldownStatus.onCooldown) {
                console.log(
                    `⏰ Grok on cooldown for chat ${chatId} (${cooldownStatus.minutesRemaining}m remaining)`
                );
                return next();
            }
        } else {
            console.log(`💬 Direct interaction (${triggerResult.triggerType}), skipping cooldown check`);
        }

        // Generate response
        console.log(`🤖 Generating Grok response for chat ${chatId}`);
        const response = await generateGrokResponse(chatId, text, username);

        if (!response) {
            console.warn("⚠️  Grok returned null response");
            return next();
        }

        // Send response
        await ctx.reply(response, {
            reply_to_message_id: messageId,
        });

        // Update cooldown ONLY for keyword-triggered messages
        if (!triggerResult.isDirect) {
            await updateLastResponseTime(chatId);
            console.log(`✅ Grok responded in chat ${chatId} (cooldown updated)`);
        } else {
            console.log(`✅ Grok responded in chat ${chatId} (no cooldown applied)`);
        }
    } catch (error) {
        console.error("Error in Grok message handler:", error);
    }

    return next();
}
