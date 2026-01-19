import { describe, it, expect, vi } from 'vitest';
import { shouldTriggerGrok, getDetectedKeywords } from '../src/utils/grokTriggers.js';
import type { MyContext } from '../src/context.js';

/**
 * Helper function to create a mock context for testing
 */
function createMockContext(text: string, options: {
    isBot?: boolean;
    isCommand?: boolean;
    replyToMessage?: { from?: { id: number } };
    entities?: Array<{ type: string; offset: number; length: number }>;
} = {}): MyContext {
    return {
        message: {
            text: options.isCommand ? `/${text}` : text,
            from: {
                is_bot: options.isBot || false,
                id: 456,
                first_name: 'TestUser'
            },
            entities: options.entities || [],
            reply_to_message: options.replyToMessage,
            message_id: 1,
            date: Date.now(),
            chat: { id: 123, type: 'group' }
        },
        chat: {
            id: 123,
            type: 'group'
        },
        api: {
            getMe: vi.fn().mockResolvedValue({ username: 'testbot', id: 789 })
        }
    } as any;
}

describe('grokTriggers - Cyrillic Support', () => {
    const BOT_USERNAME = 'testbot';
    const BOT_ID = 789;

    describe('Bot Name Triggers (Ukrainian)', () => {
        it('should trigger on "Міша"', async () => {
            const ctx = createMockContext('Міша, як справи?');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on "Місько"', async () => {
            const ctx = createMockContext('Гей Місько, що нового?');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on "Міхал"', async () => {
            const ctx = createMockContext('Міхал допоможи');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on "Михайло"', async () => {
            const ctx = createMockContext('Михайло, дай пораду');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on "бот"', async () => {
            const ctx = createMockContext('Ей бот, привіт');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });
    });

    describe('Bot Name Triggers (English)', () => {
        it('should trigger on "misha"', async () => {
            const ctx = createMockContext('Hey misha, what\'s up?');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on "misko"', async () => {
            const ctx = createMockContext('misko help me');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on "bot"', async () => {
            const ctx = createMockContext('hey bot, hello');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });
    });

    describe('Gaming Keywords (Ukrainian)', () => {
        it('should trigger on "cs2"', async () => {
            const ctx = createMockContext('Грав cs2 вчора');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
            expect(result.triggerType).toBe('keyword');
        });

        it('should trigger on "хедшот"', async () => {
            const ctx = createMockContext('Зробив хедшот');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
            expect(result.triggerType).toBe('keyword');
        });

        it('should trigger on "калаш"', async () => {
            const ctx = createMockContext('Калаш найкращий');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
            expect(result.triggerType).toBe('keyword');
        });

        it('should trigger on "дота"', async () => {
            const ctx = createMockContext('Граємо в дота');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
            expect(result.triggerType).toBe('keyword');
        });
    });

    describe('Gaming Keywords (English)', () => {
        it('should trigger on "counter-strike"', async () => {
            const ctx = createMockContext('Playing counter-strike tonight');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
            expect(result.triggerType).toBe('keyword');
        });

        it('should trigger on "faceit"', async () => {
            const ctx = createMockContext('Got faceit rank 10');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
            expect(result.triggerType).toBe('keyword');
        });
    });

    describe('Mention and Reply Triggers', () => {
        it('should trigger on @mention', async () => {
            const ctx = createMockContext('testbot what do you think?', {
                entities: [{ type: 'mention', offset: 0, length: 7 }]
            });
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('mention');
        });

        it('should trigger on reply to bot', async () => {
            const ctx = createMockContext('I agree with this', {
                replyToMessage: { from: { id: BOT_ID } }
            });
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
            expect(result.triggerType).toBe('reply');
        });
    });

    describe('Word Boundary Detection', () => {
        it('should NOT trigger when bot name is embedded in another word', async () => {
            const ctx = createMockContext('dmishaword test');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(false);
            expect(result.triggerType).toBe('none');
        });

        it('should NOT trigger when keyword is embedded', async () => {
            const ctx = createMockContext('somecs2word');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(false);
            expect(result.triggerType).toBe('none');
        });

        it('should trigger when bot name is at the start', async () => {
            const ctx = createMockContext('Міша привіт');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
        });

        it('should trigger when bot name is at the end', async () => {
            const ctx = createMockContext('Привіт Міша');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
        });

        it('should trigger when bot name is surrounded by punctuation', async () => {
            const ctx = createMockContext('Привіт, Міша!');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
        });
    });

    describe('Negative Cases', () => {
        it('should NOT trigger on normal message without keywords', async () => {
            const ctx = createMockContext('Просто звичайне повідомлення');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(false);
            expect(result.triggerType).toBe('none');
        });

        it('should NOT trigger on bot messages', async () => {
            const ctx = createMockContext('Міша привіт', { isBot: true });
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(false);
            expect(result.triggerType).toBe('none');
        });

        it('should NOT trigger on commands', async () => {
            const ctx = createMockContext('start', { isCommand: true });
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(false);
            expect(result.triggerType).toBe('none');
        });

        it('should NOT trigger on reply to other users', async () => {
            const ctx = createMockContext('I agree', {
                replyToMessage: { from: { id: 999 } } // Different from BOT_ID
            });
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(false);
            expect(result.triggerType).toBe('none');
        });
    });

    describe('getDetectedKeywords', () => {
        it('should detect Ukrainian bot name', () => {
            const keywords = getDetectedKeywords('Міша, як справи?');
            expect(keywords).toContain('міша');
        });

        it('should detect English bot name', () => {
            const keywords = getDetectedKeywords('Hey misha, what\'s up?');
            expect(keywords).toContain('misha');
        });

        it('should detect multiple keywords', () => {
            const keywords = getDetectedKeywords('Міша грав cs2 і зробив хедшот');
            expect(keywords).toContain('міша');
            expect(keywords).toContain('cs2');
            expect(keywords).toContain('хедшот');
        });

        it('should return empty array for normal text', () => {
            const keywords = getDetectedKeywords('Просто звичайне повідомлення');
            expect(keywords).toEqual([]);
        });

        it('should be case insensitive', () => {
            const keywords = getDetectedKeywords('МІША ГРАВ CS2');
            expect(keywords).toContain('міша');
            expect(keywords).toContain('cs2');
        });
    });

    describe('Case Insensitivity', () => {
        it('should trigger on uppercase Ukrainian bot name', async () => {
            const ctx = createMockContext('МІША ПРИВІТ');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(true);
        });

        it('should trigger on mixed case keyword', async () => {
            const ctx = createMockContext('ГрАв Cs2 ВчОрА');
            const result = await shouldTriggerGrok(ctx, BOT_USERNAME, BOT_ID);

            expect(result.shouldRespond).toBe(true);
            expect(result.isDirect).toBe(false);
        });
    });
});
