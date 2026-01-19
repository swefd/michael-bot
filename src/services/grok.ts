/**
 * BACKWARD COMPATIBILITY WRAPPER
 *
 * This file maintains the existing Grok API while delegating to the new AI service.
 * All functions now use the multi-provider AI system with Chain of Responsibility pattern.
 *
 * The existing imports and function signatures are preserved to ensure backward compatibility
 * with code that depends on this module.
 */

import {
    initializeAIService,
    generateAIResponse,
    isAIEnabled,
    checkAICooldown,
    updateLastResponseTime,
    resetAIService
} from "./aiService.js";

/**
 * Initialize Grok client (now initializes the AI service)
 * @deprecated Use initializeAIService() directly
 */
export async function initializeGrokClient() {
    await initializeAIService();
    return null; // Legacy signature compatibility
}

/**
 * Reset Grok client (now resets the AI service)
 * @deprecated Use resetAIService() directly
 */
export function resetGrokClient(): void {
    resetAIService();
}

/**
 * Generate Grok response (now uses AI service with provider chain)
 * @deprecated Use generateAIResponse() directly
 */
export async function generateGrokResponse(
    chatId: bigint,
    currentMessage: string,
    username?: string
): Promise<string | null> {
    return generateAIResponse(chatId, currentMessage, username);
}

/**
 * Check if Grok is enabled for a chat (now checks AI settings)
 * @deprecated Use isAIEnabled() directly
 */
export async function isGrokEnabled(chatId: bigint): Promise<boolean> {
    return isAIEnabled(chatId);
}

/**
 * Check cooldown for Grok responses (now checks AI cooldown)
 * @deprecated Use checkAICooldown() directly
 */
export async function checkCooldown(chatId: bigint): Promise<{ onCooldown: boolean; minutesRemaining: number }> {
    return checkAICooldown(chatId);
}

// Re-export updateLastResponseTime as-is
export { updateLastResponseTime };
