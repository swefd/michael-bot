export enum ProviderType {
    GROK = 'grok',
    OPENAI = 'openai'
}

export enum ProviderStatus {
    READY = 'ready',
    NOT_CONFIGURED = 'not_configured',
    ERROR = 'error'
}

export interface ProviderConfig {
    type: ProviderType;
    enabled: boolean;
    priority: number;              // Lower = higher priority (1, 2, 3...)
    apiKey?: string;
    model: string;
    maxTokens: number;
    temperature: number;
    baseURL?: string;
    messageHistoryLimit: number;
}

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ProviderResponse {
    success: boolean;
    content?: string;
    error?: ProviderError;
    provider: ProviderType;
    model: string;
    tokensUsed?: number;
}

export interface ProviderError {
    code: 'AUTH_FAILED' | 'RATE_LIMIT' | 'API_ERROR' | 'NO_API_KEY' | 'NETWORK_ERROR';
    message: string;
    statusCode?: number;
    retryable: boolean;            // Can we try next provider?
}

export abstract class AIProvider {
    protected config: ProviderConfig;
    protected client: any | null = null;
    protected currentApiKey: string | null = null;

    constructor(config: ProviderConfig) {
        this.config = config;
    }

    /**
     * Get provider type
     */
    abstract getType(): ProviderType;

    /**
     * Initialize the provider's client
     */
    abstract initialize(): Promise<boolean>;

    /**
     * Check if provider is ready (has API key, initialized, etc.)
     */
    abstract isReady(): Promise<ProviderStatus>;

    /**
     * Generate a response using this provider
     */
    abstract generateResponse(
        messages: AIMessage[],
        options?: Partial<ProviderConfig>
    ): Promise<ProviderResponse>;

    /**
     * Reset/reinitialize client (e.g., when API key changes)
     */
    abstract reset(): void;

    /**
     * Get provider configuration
     */
    getConfig(): ProviderConfig {
        return { ...this.config };
    }

    /**
     * Update provider configuration
     */
    updateConfig(updates: Partial<ProviderConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Handle provider-specific errors and convert to ProviderError
     */
    protected abstract handleError(error: any): ProviderError;
}
