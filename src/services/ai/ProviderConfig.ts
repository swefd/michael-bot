import { ProviderType, ProviderConfig } from "./providers/AIProvider.js";
import { prisma } from "../../db.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Load provider configuration from environment variables and database
 */
export async function loadProviderConfig(type: ProviderType): Promise<ProviderConfig | null> {
    switch (type) {
        case ProviderType.GROK:
            return await loadGrokConfig();
        case ProviderType.OPENAI:
            return await loadOpenAIConfig();
        default:
            console.warn(`⚠️  Unknown provider type: ${type}`);
            return null;
    }
}

/**
 * Load Grok configuration (backward compatible)
 */
async function loadGrokConfig(): Promise<ProviderConfig | null> {
    // Try database first
    let apiKey: string | null = null;

    try {
        const keyRecord = await prisma.aIProviderKey.findFirst({
            where: {
                provider: 'grok',
                enabled: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (keyRecord?.apiKey) {
            apiKey = keyRecord.apiKey;
        }
    } catch (error) {
        console.error("Error fetching Grok API key from database:", error);
    }

    // Fallback to environment
    if (!apiKey) {
        const envKey = process.env.GROK_API_KEY;
        if (envKey && envKey !== "your_grok_api_key_here" && envKey !== "your_xai_api_key_here") {
            apiKey = envKey;
        }
    }

    // Check if enabled (default to true for backward compatibility)
    const enabled = process.env.GROK_ENABLED !== 'false';

    if (!apiKey) {
        console.warn("⚠️  GROK_API_KEY not configured");
        return null;
    }

    return {
        type: ProviderType.GROK,
        enabled,
        priority: parseInt(process.env.GROK_PRIORITY || '1'),
        apiKey,
        model: process.env.GROK_MODEL || 'grok-beta',
        maxTokens: parseInt(process.env.GROK_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.GROK_TEMPERATURE || '0.9'),
        baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
        messageHistoryLimit: parseInt(process.env.GROK_MESSAGE_HISTORY_LIMIT || '25')
    };
}

/**
 * Load OpenAI configuration
 */
async function loadOpenAIConfig(): Promise<ProviderConfig | null> {
    // Try database first
    let apiKey: string | null = null;

    try {
        const keyRecord = await prisma.aIProviderKey.findFirst({
            where: {
                provider: 'openai',
                enabled: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (keyRecord?.apiKey) {
            apiKey = keyRecord.apiKey;
        }
    } catch (error) {
        console.error("Error fetching OpenAI API key from database:", error);
    }

    // Fallback to environment
    if (!apiKey) {
        const envKey = process.env.OPENAI_API_KEY;
        if (envKey && envKey !== "your_openai_api_key_here") {
            apiKey = envKey;
        }
    }

    // Check if enabled
    const enabled = process.env.OPENAI_ENABLED === 'true';

    if (!apiKey) {
        console.warn("⚠️  OPENAI_API_KEY not configured");
        return null;
    }

    return {
        type: ProviderType.OPENAI,
        enabled,
        priority: parseInt(process.env.OPENAI_PRIORITY || '2'),
        apiKey,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.9'),
        messageHistoryLimit: parseInt(process.env.OPENAI_MESSAGE_HISTORY_LIMIT || '25')
    };
}

/**
 * Load provider priority order from database or environment
 */
export async function getProviderPriority(): Promise<ProviderType[]> {
    // Try database first
    try {
        const config = await prisma.aIProviderConfig.findUnique({
            where: { key: 'provider_priority' }
        });

        if (config?.value) {
            console.log(`📋 Using provider priority from database: ${config.value}`);
            const providers = config.value.split(',').map(p => p.trim());
            return providers.filter(p =>
                Object.values(ProviderType).includes(p as ProviderType)
            ) as ProviderType[];
        }
    } catch (error) {
        console.error("Error loading provider priority from database:", error);
    }

    // Fallback to environment
    const priorityString = process.env.AI_PROVIDER_PRIORITY || 'grok,openai';
    console.log(`📋 Using provider priority from environment: ${priorityString}`);
    const providers = priorityString.split(',').map(p => p.trim());

    return providers.filter(p =>
        Object.values(ProviderType).includes(p as ProviderType)
    ) as ProviderType[];
}

/**
 * Set provider priority order in database
 */
export async function setProviderPriority(providers: ProviderType[]): Promise<void> {
    const priorityString = providers.join(',');

    await prisma.aIProviderConfig.upsert({
        where: { key: 'provider_priority' },
        update: { value: priorityString },
        create: {
            key: 'provider_priority',
            value: priorityString
        }
    });

    console.log(`✅ Provider priority updated: ${priorityString}`);
}
