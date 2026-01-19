import OpenAI from "openai";
import { AIProvider, ProviderType, ProviderConfig, AIMessage, ProviderResponse, ProviderError, ProviderStatus } from "./AIProvider.js";

export class OpenAIProvider extends AIProvider {
    private openaiClient: OpenAI | null = null;

    getType(): ProviderType {
        return ProviderType.OPENAI;
    }

    async initialize(): Promise<boolean> {
        const apiKey = this.config.apiKey;

        if (!apiKey) {
            console.warn("⚠️  OpenAI API key not set");
            return false;
        }

        // Reset client if API key changed
        if (this.currentApiKey && this.currentApiKey !== apiKey) {
            this.reset();
        }

        if (!this.openaiClient) {
            this.openaiClient = new OpenAI({
                apiKey: apiKey,
                // baseURL defaults to https://api.openai.com/v1
            });
            this.currentApiKey = apiKey;
            console.log("✅ OpenAI provider initialized");
        }

        this.client = this.openaiClient;
        return true;
    }

    async isReady(): Promise<ProviderStatus> {
        if (!this.config.enabled) {
            return ProviderStatus.NOT_CONFIGURED;
        }

        if (!this.config.apiKey) {
            return ProviderStatus.NOT_CONFIGURED;
        }

        if (!this.openaiClient) {
            const initialized = await this.initialize();
            if (!initialized) {
                return ProviderStatus.ERROR;
            }
        }

        return ProviderStatus.READY;
    }

    async generateResponse(
        messages: AIMessage[],
        options?: Partial<ProviderConfig>
    ): Promise<ProviderResponse> {
        const status = await this.isReady();
        if (status !== ProviderStatus.READY) {
            return {
                success: false,
                error: {
                    code: 'NO_API_KEY',
                    message: 'OpenAI provider not ready',
                    retryable: true
                },
                provider: this.getType(),
                model: this.config.model
            };
        }

        try {
            const completion = await this.openaiClient!.chat.completions.create({
                model: options?.model || this.config.model,
                messages: messages as any,
                max_tokens: options?.maxTokens || this.config.maxTokens,
                temperature: options?.temperature || this.config.temperature,
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) {
                return {
                    success: false,
                    error: {
                        code: 'API_ERROR',
                        message: 'OpenAI returned empty response',
                        retryable: true
                    },
                    provider: this.getType(),
                    model: this.config.model
                };
            }

            return {
                success: true,
                content: content.trim(),
                provider: this.getType(),
                model: this.config.model,
                tokensUsed: completion.usage?.total_tokens
            };

        } catch (error: any) {
            return {
                success: false,
                error: this.handleError(error),
                provider: this.getType(),
                model: this.config.model
            };
        }
    }

    reset(): void {
        this.openaiClient = null;
        this.currentApiKey = null;
        this.client = null;
        console.log("🔄 OpenAI provider reset");
    }

    protected handleError(error: any): ProviderError {
        // Rate limiting
        if (error?.status === 429) {
            console.warn("⚠️  OpenAI API rate limit hit");
            return {
                code: 'RATE_LIMIT',
                message: 'OpenAI API rate limit exceeded',
                statusCode: 429,
                retryable: true
            };
        }

        // Authentication errors
        if (error?.status === 401) {
            console.error("❌ OpenAI API authentication failed");
            return {
                code: 'AUTH_FAILED',
                message: 'OpenAI API authentication failed',
                statusCode: 401,
                retryable: true
            };
        }

        // Quota exceeded (specific to OpenAI)
        if (error?.status === 402 || error?.status === 403) {
            console.error("❌ OpenAI quota exceeded or billing issue");
            return {
                code: 'AUTH_FAILED',
                message: 'OpenAI quota exceeded or billing issue',
                statusCode: error.status,
                retryable: true
            };
        }

        // Server errors
        if (error?.status >= 500) {
            console.error("❌ OpenAI API server error");
            return {
                code: 'API_ERROR',
                message: 'OpenAI API server error',
                statusCode: error.status,
                retryable: true
            };
        }

        // Generic error
        console.error("❌ OpenAI provider error:", error);
        return {
            code: 'API_ERROR',
            message: error?.message || 'Unknown error',
            statusCode: error?.status,
            retryable: true
        };
    }
}
