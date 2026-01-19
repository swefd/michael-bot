import { prisma } from "../db.js";
import { getProviderChain } from "./aiService.js";
import { AIMessage } from "./ai/providers/AIProvider.js";

const FACT_EXTRACTION_ENABLED = process.env.FACT_EXTRACTION_ENABLED !== 'false';
const FACT_EXTRACTION_BATCH_SIZE = parseInt(process.env.FACT_EXTRACTION_BATCH_SIZE || '10');
const FACT_EXTRACTION_MIN_MESSAGES = parseInt(process.env.FACT_EXTRACTION_MIN_MESSAGES || '5');

// System prompt for fact extraction
const FACT_EXTRACTION_PROMPT = `You are a fact extraction assistant. Analyze the following chat messages and extract FACTUAL information about each user.

IMPORTANT RULES:
1. Only extract CONCRETE, FACTUAL information (not assumptions or interpretations)
2. Focus on: interests, hobbies, skills, games they play, preferences, personal info they share
3. Be specific and accurate
4. Ignore casual conversation without factual content
5. Each fact should be a clear, standalone statement
6. MULTILINGUAL SUPPORT: Messages may be in any language (English, Ukrainian, Russian, etc.). Extract facts in the SAME language as the original message.

Extract facts in this JSON format:
{
  "facts": [
    {
      "username": "user123",
      "factType": "interest|preference|personal_info|skill|opinion|game",
      "fact": "clear, specific fact about the user",
      "confidence": 0.0-1.0
    }
  ]
}

FACT TYPES:
- interest: hobbies, things they like (e.g., "enjoys anime")
- preference: specific preferences (e.g., "prefers AWP over AK in CS2")
- personal_info: background info they share (e.g., "lives in Kyiv", "studies computer science")
- skill: abilities they have (e.g., "good at headshots", "plays piano")
- opinion: strong viewpoints (e.g., "thinks Valorant is better than CS2")
- game: games they play (e.g., "plays CS2", "mains Dota 2")

Examples:
- "I play CS2 every day" → {"username": "user", "factType": "game", "fact": "plays CS2 daily", "confidence": 1.0}
- "I'm from Lviv" → {"username": "user", "factType": "personal_info", "fact": "from Lviv", "confidence": 1.0}
- "I love the AWP, best weapon" → {"username": "user", "factType": "preference", "fact": "favorite CS2 weapon is AWP", "confidence": 0.9}

Now analyze these messages:`;

interface ExtractedFact {
    username: string;
    factType: string;
    fact: string;
    confidence: number;
}

interface FactExtractionResult {
    facts: ExtractedFact[];
}

/**
 * Check if fact extraction is enabled
 */
export function isFactExtractionEnabled(): boolean {
    return FACT_EXTRACTION_ENABLED;
}

/**
 * Extract facts from a batch of messages using AI
 */
async function extractFactsFromMessages(
    messages: Array<{ username: string; content: string }>
): Promise<ExtractedFact[]> {
    if (!FACT_EXTRACTION_ENABLED) {
        return [];
    }

    const chain = getProviderChain();
    if (!chain) {
        console.warn("⚠️  Provider chain not available for fact extraction");
        return [];
    }

    try {
        // Build message summary for analysis
        const messageSummary = messages
            .map(m => `${m.username}: ${m.content}`)
            .join('\n');

        const aiMessages: AIMessage[] = [
            { role: "system", content: FACT_EXTRACTION_PROMPT },
            { role: "user", content: messageSummary }
        ];

        // Execute AI analysis
        const result = await chain.execute(aiMessages);

        if (!result.success || !result.content) {
            console.warn("⚠️  Fact extraction failed:", result.error?.message);
            return [];
        }

        // Parse JSON response
        try {
            // Extract JSON from response (might be wrapped in markdown code blocks)
            let jsonContent = result.content.trim();

            // Remove markdown code blocks if present
            if (jsonContent.startsWith('```json')) {
                jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonContent.startsWith('```')) {
                jsonContent = jsonContent.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }

            const parsed: FactExtractionResult = JSON.parse(jsonContent);

            if (!parsed.facts || !Array.isArray(parsed.facts)) {
                console.warn("⚠️  Invalid fact extraction response format");
                return [];
            }

            console.log(`✅ Extracted ${parsed.facts.length} facts from ${messages.length} messages`);
            return parsed.facts;

        } catch (parseError) {
            console.error("❌ Failed to parse fact extraction response:", parseError);
            console.log("Raw response:", result.content);
            return [];
        }

    } catch (error) {
        console.error("❌ Error during fact extraction:", error);
        return [];
    }
}

/**
 * Process recent messages and extract facts
 */
export async function analyzeAndExtractFacts(chatId: bigint): Promise<number> {
    if (!FACT_EXTRACTION_ENABLED) {
        return 0;
    }

    try {
        // Get recent unanalyzed messages
        const recentMessages = await prisma.chatMessage.findMany({
            where: { chatId },
            orderBy: { timestamp: "desc" },
            take: FACT_EXTRACTION_BATCH_SIZE,
        });

        if (recentMessages.length < FACT_EXTRACTION_MIN_MESSAGES) {
            // Not enough messages to analyze
            return 0;
        }

        // Reverse to chronological order
        recentMessages.reverse();

        // Format for analysis
        const messagesToAnalyze = recentMessages.map(m => ({
            username: m.username || "Unknown",
            content: m.content,
            userId: m.userId,
            messageId: m.messageId
        }));

        // Extract facts using AI
        const extractedFacts = await extractFactsFromMessages(messagesToAnalyze);

        if (extractedFacts.length === 0) {
            return 0;
        }

        // Store facts in database
        let storedCount = 0;
        for (const extractedFact of extractedFacts) {
            try {
                // Find the user ID from username
                const matchingMessage = messagesToAnalyze.find(
                    m => m.username === extractedFact.username
                );

                if (!matchingMessage) {
                    console.warn(`⚠️  Could not find user for username: ${extractedFact.username}`);
                    continue;
                }

                // Check if similar fact already exists (avoid duplicates)
                const existingFact = await prisma.userFact.findFirst({
                    where: {
                        userId: matchingMessage.userId,
                        chatId: chatId,
                        factType: extractedFact.factType,
                        fact: {
                            contains: extractedFact.fact.substring(0, 20) // Fuzzy match
                        },
                        isActive: true
                    }
                });

                if (existingFact) {
                    // Update confidence if this is a reinforcement
                    await prisma.userFact.update({
                        where: { id: existingFact.id },
                        data: {
                            confidence: Math.min(1.0, existingFact.confidence + 0.1),
                            updatedAt: new Date()
                        }
                    });
                    console.log(`🔄 Reinforced fact for ${extractedFact.username}: ${extractedFact.fact}`);
                } else {
                    // Store new fact
                    await prisma.userFact.create({
                        data: {
                            userId: matchingMessage.userId,
                            chatId: chatId,
                            username: extractedFact.username,
                            factType: extractedFact.factType,
                            fact: extractedFact.fact,
                            extractedFrom: messagesToAnalyze
                                .filter(m => m.username === extractedFact.username)
                                .map(m => m.content)
                                .join(' | ')
                                .substring(0, 500),
                            confidence: extractedFact.confidence
                        }
                    });
                    storedCount++;
                    console.log(`✅ Stored fact for ${extractedFact.username}: ${extractedFact.fact}`);
                }

            } catch (error) {
                console.error("❌ Error storing fact:", error);
            }
        }

        return storedCount;

    } catch (error) {
        console.error("❌ Error analyzing facts:", error);
        return 0;
    }
}

/**
 * Get facts about users in a chat for context building
 */
export async function getUserFactsForContext(chatId: bigint, userIds: bigint[]): Promise<string> {
    if (!FACT_EXTRACTION_ENABLED || userIds.length === 0) {
        return "";
    }

    try {
        const facts = await prisma.userFact.findMany({
            where: {
                chatId: chatId,
                userId: { in: userIds },
                isActive: true,
                confidence: { gte: 0.5 } // Only include confident facts
            },
            orderBy: [
                { confidence: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        if (facts.length === 0) {
            return "";
        }

        // Group facts by user
        const factsByUser = new Map<string, string[]>();
        for (const fact of facts) {
            const username = fact.username || `User${fact.userId}`;
            if (!factsByUser.has(username)) {
                factsByUser.set(username, []);
            }
            factsByUser.get(username)!.push(`${fact.fact}`);
        }

        // Build context string
        let context = "\n\n=== KNOWN FACTS ABOUT USERS ===\n";
        for (const [username, userFacts] of factsByUser) {
            if (userFacts.length > 0) {
                context += `\n${username}:\n`;
                // Limit to top 5 facts per user to avoid context bloat
                userFacts.slice(0, 5).forEach(fact => {
                    context += `  - ${fact}\n`;
                });
            }
        }
        context += "=== END OF USER FACTS ===\n\n";

        return context;

    } catch (error) {
        console.error("❌ Error retrieving user facts:", error);
        return "";
    }
}

/**
 * Get all facts about a specific user
 */
export async function getUserFacts(userId: bigint, chatId: bigint): Promise<Array<{
    factType: string;
    fact: string;
    confidence: number;
    createdAt: Date;
}>> {
    try {
        const facts = await prisma.userFact.findMany({
            where: {
                userId: userId,
                chatId: chatId,
                isActive: true
            },
            orderBy: [
                { confidence: 'desc' },
                { createdAt: 'desc' }
            ],
            select: {
                factType: true,
                fact: true,
                confidence: true,
                createdAt: true
            }
        });

        return facts;
    } catch (error) {
        console.error("❌ Error retrieving user facts:", error);
        return [];
    }
}

/**
 * Delete a specific fact
 */
export async function deleteUserFact(userId: bigint, chatId: bigint, factText: string): Promise<boolean> {
    try {
        const result = await prisma.userFact.updateMany({
            where: {
                userId: userId,
                chatId: chatId,
                fact: {
                    contains: factText
                },
                isActive: true
            },
            data: {
                isActive: false
            }
        });

        return result.count > 0;
    } catch (error) {
        console.error("❌ Error deleting user fact:", error);
        return false;
    }
}

/**
 * Clear all facts about a user in a chat
 */
export async function clearUserFacts(userId: bigint, chatId: bigint): Promise<number> {
    try {
        const result = await prisma.userFact.updateMany({
            where: {
                userId: userId,
                chatId: chatId,
                isActive: true
            },
            data: {
                isActive: false
            }
        });

        return result.count;
    } catch (error) {
        console.error("❌ Error clearing user facts:", error);
        return 0;
    }
}

/**
 * Analyze entire chat history in batches
 * Returns progress updates via callback
 */
export async function analyzeEntireHistory(
    chatId: bigint,
    options: {
        batchSize?: number;
        maxMessages?: number;
        onProgress?: (processed: number, total: number, newFacts: number) => void;
    } = {}
): Promise<{ totalProcessed: number; totalFacts: number; batches: number }> {
    if (!FACT_EXTRACTION_ENABLED) {
        throw new Error("Fact extraction is disabled");
    }

    const batchSize = options.batchSize || 20; // Process 20 messages at a time
    const maxMessages = options.maxMessages || 10000; // Safety limit
    const onProgress = options.onProgress;

    try {
        // Get total message count
        const totalMessages = await prisma.chatMessage.count({
            where: { chatId }
        });

        const messagesToProcess = Math.min(totalMessages, maxMessages);
        console.log(`📊 Starting full history analysis: ${messagesToProcess} messages in chat ${chatId}`);

        let processedCount = 0;
        let totalNewFacts = 0;
        let batchesProcessed = 0;
        let offset = 0;

        // Process in batches from oldest to newest
        while (offset < messagesToProcess) {
            const messages = await prisma.chatMessage.findMany({
                where: { chatId },
                orderBy: { timestamp: "asc" },
                skip: offset,
                take: batchSize,
            });

            if (messages.length === 0) {
                break;
            }

            // Format for analysis
            const messagesToAnalyze = messages.map(m => ({
                username: m.username || "Unknown",
                content: m.content,
                userId: m.userId,
                messageId: m.messageId
            }));

            // Extract facts using AI
            const extractedFacts = await extractFactsFromMessages(messagesToAnalyze);

            // Store facts
            if (extractedFacts.length > 0) {
                for (const extractedFact of extractedFacts) {
                    try {
                        // Find the user ID from username
                        const matchingMessage = messagesToAnalyze.find(
                            m => m.username === extractedFact.username
                        );

                        if (!matchingMessage) {
                            continue;
                        }

                        // Check if similar fact already exists
                        const existingFact = await prisma.userFact.findFirst({
                            where: {
                                userId: matchingMessage.userId,
                                chatId: chatId,
                                factType: extractedFact.factType,
                                fact: {
                                    contains: extractedFact.fact.substring(0, Math.min(20, extractedFact.fact.length))
                                },
                                isActive: true
                            }
                        });

                        if (existingFact) {
                            // Reinforce existing fact
                            await prisma.userFact.update({
                                where: { id: existingFact.id },
                                data: {
                                    confidence: Math.min(1.0, existingFact.confidence + 0.05),
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            // Store new fact
                            await prisma.userFact.create({
                                data: {
                                    userId: matchingMessage.userId,
                                    chatId: chatId,
                                    username: extractedFact.username,
                                    factType: extractedFact.factType,
                                    fact: extractedFact.fact,
                                    extractedFrom: messagesToAnalyze
                                        .filter(m => m.username === extractedFact.username)
                                        .map(m => m.content)
                                        .join(' | ')
                                        .substring(0, 500),
                                    confidence: extractedFact.confidence
                                }
                            });
                            totalNewFacts++;
                        }

                    } catch (error) {
                        console.error("❌ Error storing fact during history analysis:", error);
                    }
                }
            }

            processedCount += messages.length;
            batchesProcessed++;
            offset += batchSize;

            // Report progress
            if (onProgress) {
                onProgress(processedCount, messagesToProcess, totalNewFacts);
            }

            console.log(`📝 Batch ${batchesProcessed}: Processed ${processedCount}/${messagesToProcess} messages, ${totalNewFacts} facts extracted`);

            // Small delay between batches to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`✅ History analysis complete: ${processedCount} messages processed, ${totalNewFacts} new facts extracted`);

        return {
            totalProcessed: processedCount,
            totalFacts: totalNewFacts,
            batches: batchesProcessed
        };

    } catch (error) {
        console.error("❌ Error analyzing entire history:", error);
        throw error;
    }
}
