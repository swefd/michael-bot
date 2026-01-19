import { ProviderChain, ChainResult } from "./ai/ProviderChain.js";
import { AIProvider, ProviderType, AIMessage } from "./ai/providers/AIProvider.js";
import { GrokProvider } from "./ai/providers/GrokProvider.js";
import { OpenAIProvider } from "./ai/providers/OpenAIProvider.js";
import { loadProviderConfig, getProviderPriority } from "./ai/ProviderConfig.js";
import { getUserFactsForContext } from "./factExtraction.js";
import { prisma } from "../db.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

// Get current file directory (ESM compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const MESSAGE_HISTORY_LIMIT = parseInt(process.env.GROK_MESSAGE_HISTORY_LIMIT || process.env.AI_MESSAGE_HISTORY_LIMIT || "25");
const AI_PROMPT = process.env.GROK_PROMPT || process.env.AI_PROMPT || "toxic-western-ukraine";

// Provider chain singleton
let providerChain: ProviderChain | null = null;
let isInitialized = false;

/**
 * Load system prompt from external file
 */
function loadSystemPrompt(): string {
    const promptPath = join(__dirname, "../prompts", `${AI_PROMPT}.txt`);

    try {
        const prompt = readFileSync(promptPath, "utf-8").trim();
        console.log(`✅ Loaded prompt: ${AI_PROMPT}`);
        return prompt;
    } catch (error) {
        console.warn(`⚠️  Failed to load prompt "${AI_PROMPT}", using default`);

        try {
            const defaultPath = join(__dirname, "../prompts/default.txt");
            return readFileSync(defaultPath, "utf-8").trim();
        } catch (fallbackError) {
            console.error("❌ Failed to load default prompt, using minimal fallback");
            return "You are a helpful assistant in a gaming community chat. Keep responses brief and relevant.";
        }
    }
}

const SYSTEM_PROMPT = loadSystemPrompt();

/**
 * Initialize the AI provider chain
 */
export async function initializeAIService(): Promise<void> {
    if (isInitialized) {
        console.log("ℹ️  AI service already initialized");
        return;
    }

    console.log("🚀 Initializing AI service...");

    providerChain = new ProviderChain({
        stopOnFirstSuccess: true,
        logAttempts: true
    });

    // Load providers based on priority
    const priorityOrder = await getProviderPriority();
    console.log(`📋 Provider priority: ${priorityOrder.join(' → ')}`);

    for (const providerType of priorityOrder) {
        const config = await loadProviderConfig(providerType);

        if (!config) {
            console.log(`⏭️  Skipping ${providerType} - not configured`);
            continue;
        }

        let provider: AIProvider | null = null;

        switch (providerType) {
            case ProviderType.GROK:
                provider = new GrokProvider(config);
                break;
            case ProviderType.OPENAI:
                provider = new OpenAIProvider(config);
                break;
            default:
                console.warn(`⚠️  Unknown provider type: ${providerType}`);
                continue;
        }

        if (provider) {
            providerChain.addProvider(provider);
            console.log(`✅ Added ${providerType} to chain (priority: ${config.priority})`);
        }
    }

    isInitialized = true;
    console.log("✅ AI service initialized");
}

/**
 * Reset the AI service (e.g., when configuration changes)
 */
export function resetAIService(): void {
    providerChain = null;
    isInitialized = false;
    console.log("🔄 AI service reset");
}

/**
 * Build conversation context from message history
 */
async function buildConversationContext(
    chatId: bigint,
    limit: number = MESSAGE_HISTORY_LIMIT
): Promise<AIMessage[]> {
    try {
        const messages = await prisma.chatMessage.findMany({
            where: { chatId },
            orderBy: { timestamp: "desc" },
            take: limit,
        });

        messages.reverse();

        return messages.map(msg => ({
            role: "user" as const,
            content: `${msg.username || "User"}: ${msg.content}`,
        }));
    } catch (error) {
        console.error("Error building conversation context:", error);
        return [];
    }
}

/**
 * Generate an AI response using the provider chain
 */
export async function generateAIResponse(
    chatId: bigint,
    currentMessage: string,
    username?: string
): Promise<string | null> {
    if (!isInitialized) {
        await initializeAIService();
    }

    if (!providerChain) {
        console.error("❌ Provider chain not initialized");
        return null;
    }

    try {
        // Build conversation context
        const context = await buildConversationContext(chatId);

        // Get user IDs from recent context for fact retrieval
        const recentMessages = await prisma.chatMessage.findMany({
            where: { chatId },
            orderBy: { timestamp: "desc" },
            take: 10,
            select: { userId: true }
        });
        const recentUserIds = [...new Set(recentMessages.map(m => m.userId))];

        // Get user facts for context
        const userFactsContext = await getUserFactsForContext(chatId, recentUserIds);

        // Prepare system prompt with user facts
        const enhancedSystemPrompt = SYSTEM_PROMPT + userFactsContext;

        // Prepare messages
        const messages: AIMessage[] = [
            { role: "system", content: enhancedSystemPrompt },
            ...context,
            { role: "user", content: `${username || "User"}: ${currentMessage}` },
        ];

        // Execute the chain
        const result: ChainResult = await providerChain.execute(messages);

        if (!result.success) {
            console.error("❌ All AI providers failed:", result.error?.message);

            // Return user-friendly error based on attempts
            if (result.totalAttempts === 0) {
                return null; // No providers available
            }

            if (result.error?.code === 'RATE_LIMIT') {
                return "Easy there, I'm being rate limited. Give me a minute.";
            }

            return null;
        }

        // Track which provider was used
        try {
            await prisma.aIChatSettings.upsert({
                where: { chatId },
                update: { lastUsedProvider: result.provider },
                create: {
                    chatId,
                    enabled: false,
                    cooldownMinutes: parseInt(process.env.GROK_DEFAULT_COOLDOWN_MINUTES || process.env.AI_DEFAULT_COOLDOWN_MINUTES || "7"),
                    lastUsedProvider: result.provider
                }
            });
        } catch (error) {
            // Non-critical error
            console.warn("⚠️  Failed to update last used provider:", error);
        }

        console.log(`✅ Response generated by ${result.provider} (${result.attemptedProviders.length} provider(s) tried)`);

        return result.content || null;

    } catch (error: any) {
        console.error("Error generating AI response:", error);
        return null;
    }
}

/**
 * Check if AI is enabled for a specific chat
 */
export async function isAIEnabled(chatId: bigint): Promise<boolean> {
    try {
        // Try new table first
        const settings = await prisma.aIChatSettings.findUnique({
            where: { chatId },
        });

        if (settings) {
            return settings.enabled;
        }

        // Fallback to old table for backward compatibility
        const oldSettings = await prisma.grokChatSettings.findUnique({
            where: { chatId },
        });

        return oldSettings?.enabled || false;
    } catch (error) {
        console.error("Error checking if AI is enabled:", error);
        return false;
    }
}

/**
 * Check if AI is on cooldown for a chat
 */
export async function checkAICooldown(chatId: bigint): Promise<{ onCooldown: boolean; minutesRemaining: number }> {
    try {
        // Try new table first
        let settings = await prisma.aIChatSettings.findUnique({
            where: { chatId },
        });

        // Fallback to old table
        if (!settings) {
            const oldSettings = await prisma.grokChatSettings.findUnique({
                where: { chatId },
            });

            if (oldSettings) {
                settings = {
                    ...oldSettings,
                    lastUsedProvider: null
                };
            }
        }

        if (!settings || !settings.lastResponseTime) {
            return { onCooldown: false, minutesRemaining: 0 };
        }

        const now = new Date();
        const lastResponse = settings.lastResponseTime;
        const cooldownMs = settings.cooldownMinutes * 60 * 1000;
        const timeSinceLastResponse = now.getTime() - lastResponse.getTime();

        if (timeSinceLastResponse < cooldownMs) {
            const remainingMs = cooldownMs - timeSinceLastResponse;
            const minutesRemaining = Math.ceil(remainingMs / 60000);
            return { onCooldown: true, minutesRemaining };
        }

        return { onCooldown: false, minutesRemaining: 0 };
    } catch (error) {
        console.error("Error checking cooldown:", error);
        return { onCooldown: false, minutesRemaining: 0 };
    }
}

/**
 * Update the last response time for cooldown tracking
 */
export async function updateLastResponseTime(chatId: bigint): Promise<void> {
    try {
        await prisma.aIChatSettings.upsert({
            where: { chatId },
            update: { lastResponseTime: new Date() },
            create: {
                chatId,
                enabled: false,
                cooldownMinutes: parseInt(process.env.GROK_DEFAULT_COOLDOWN_MINUTES || process.env.AI_DEFAULT_COOLDOWN_MINUTES || "7"),
                lastResponseTime: new Date()
            }
        });
    } catch (error) {
        console.error("Error updating last response time:", error);
    }
}

/**
 * Get the provider chain (for testing/debugging)
 */
export function getProviderChain(): ProviderChain | null {
    return providerChain;
}
