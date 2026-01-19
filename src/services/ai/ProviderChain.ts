import { AIProvider, ProviderResponse, AIMessage, ProviderStatus } from "./providers/AIProvider.js";

export interface ChainOptions {
    stopOnFirstSuccess: boolean;   // Default: true
    logAttempts: boolean;           // Default: true
}

export interface ChainResult extends ProviderResponse {
    attemptedProviders: string[];   // Track which providers were tried
    totalAttempts: number;
}

export class ProviderChain {
    private providers: AIProvider[] = [];
    private options: ChainOptions;

    constructor(options: Partial<ChainOptions> = {}) {
        this.options = {
            stopOnFirstSuccess: options.stopOnFirstSuccess ?? true,
            logAttempts: options.logAttempts ?? true
        };
    }

    /**
     * Add a provider to the chain
     */
    addProvider(provider: AIProvider): void {
        this.providers.push(provider);
        // Sort by priority (lower number = higher priority)
        this.providers.sort((a, b) => a.getConfig().priority - b.getConfig().priority);
    }

    /**
     * Remove a provider from the chain
     */
    removeProvider(providerType: string): void {
        this.providers = this.providers.filter(p => p.getType() !== providerType);
    }

    /**
     * Get all providers in the chain
     */
    getProviders(): AIProvider[] {
        return [...this.providers];
    }

    /**
     * Execute the chain - try providers in order until success
     */
    async execute(messages: AIMessage[]): Promise<ChainResult> {
        const attemptedProviders: string[] = [];
        let totalAttempts = 0;
        let lastError: any = null;

        if (this.providers.length === 0) {
            return {
                success: false,
                error: {
                    code: 'API_ERROR',
                    message: 'No AI providers configured',
                    retryable: false
                },
                provider: 'none' as any,
                model: 'none',
                attemptedProviders: [],
                totalAttempts: 0
            };
        }

        for (const provider of this.providers) {
            const providerType = provider.getType();
            const config = provider.getConfig();

            // Skip disabled providers
            if (!config.enabled) {
                if (this.options.logAttempts) {
                    console.log(`⏭️  Skipping disabled provider: ${providerType}`);
                }
                continue;
            }

            // Check if provider is ready
            const status = await provider.isReady();
            if (status !== ProviderStatus.READY) {
                if (this.options.logAttempts) {
                    console.log(`⏭️  Skipping not-ready provider: ${providerType} (status: ${status})`);
                }
                continue;
            }

            totalAttempts++;
            attemptedProviders.push(providerType);

            if (this.options.logAttempts) {
                console.log(`🔄 Attempting provider: ${providerType} (attempt ${totalAttempts})`);
            }

            try {
                const response = await provider.generateResponse(messages);

                if (response.success) {
                    if (this.options.logAttempts) {
                        console.log(`✅ Provider succeeded: ${providerType}`);
                    }

                    return {
                        ...response,
                        attemptedProviders,
                        totalAttempts
                    };
                }

                // Provider failed, check if error is retryable
                lastError = response.error;

                if (this.options.logAttempts) {
                    console.warn(`⚠️  Provider failed: ${providerType} - ${response.error?.message}`);
                }

                // If error is not retryable, stop the chain
                if (response.error && !response.error.retryable) {
                    if (this.options.logAttempts) {
                        console.log(`🛑 Non-retryable error, stopping chain`);
                    }
                    break;
                }

                // Continue to next provider
            } catch (error) {
                console.error(`❌ Unexpected error in provider ${providerType}:`, error);
                lastError = error;
                // Continue to next provider
            }
        }

        // All providers failed
        return {
            success: false,
            error: lastError || {
                code: 'API_ERROR',
                message: 'All AI providers failed',
                retryable: false
            },
            provider: 'none' as any,
            model: 'none',
            attemptedProviders,
            totalAttempts
        };
    }

    /**
     * Clear all providers from the chain
     */
    clear(): void {
        this.providers = [];
    }
}
