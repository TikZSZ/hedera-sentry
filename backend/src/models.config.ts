// src/models.config.ts

/**
 * NEW: Defines the common generation parameters we want to control.
 */
export interface GenerationParams {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    jsonOutput?:boolean
}

export interface ModelConfig {
    id: string;
    provider: 'openai' | 'google' | 'openai-compatible';
    modelName: string;
    apiKeyEnvVar: string;
    baseURL?: string;
    // NEW: Add a field for default generation parameters
    defaultParams?: GenerationParams;
}

// Update the model definitions to include these new parameters
export const ALL_MODELS: Record<string, ModelConfig> = {
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        defaultParams: {
            temperature: 0.1, // Low temp for deterministic, factual output
            maxTokens: 4096,
        },
    },
    'gpt-5-nano': {
        id: 'gpt-5-nano',
        provider: 'openai',
        modelName: 'gpt-5-nano',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        defaultParams: {
            temperature: 0.1, // Low temp for deterministic, factual output
            maxTokens: 4096,
        },
    },
    'gpt-5-mini': {
        id: 'gpt-5-mini',
        provider: 'openai',
        modelName: 'gpt-5-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        defaultParams: {
            temperature: 0.1, // Low temp for deterministic, factual output
            maxTokens: 4096,
        },
    },
    'gpt-5': {
        id: 'gpt-5',
        provider: 'openai',
        modelName: 'gpt-5',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        defaultParams: {
            temperature: 0.1, // Low temp for deterministic, factual output
            maxTokens: 4096,
        },
    },
    'o4-mini': {
        id: 'o4-mini',
        provider: 'openai',
        modelName: 'o4-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        defaultParams: {
            temperature: 0.1, // Low temp for deterministic, factual output
            maxTokens: 4096,
        },
    },
    'gpt-4.1-mini': {
        id: 'gpt-4.1-mini',
        provider: 'openai',
        modelName: 'gpt-4.1-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        defaultParams: {
            temperature: 0.1, // Low temp for deterministic, factual output
            maxTokens: 4096,
        },
    },
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        provider: 'google',
        modelName: 'gemini-2.5-flash',
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultParams: {
            temperature: 0.1,
            topP: 0.95,
        },
    },
    'gemini-2.5-pro':{
        id: 'gemini-2.5-pro',
        provider: 'google',
        modelName: 'gemini-2.5-pro',
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultParams: {
            temperature: 0.1,
            topP: 0.95,
        },
    },
    'creative-llama3': { // Example of a different "personality"
        id: 'creative-llama3',
        provider: 'openai-compatible',
        modelName: 'llama3-70b-8192',
        apiKeyEnvVar: 'GROQ_API_KEY',
        baseURL: 'https://api.groq.com/openai/v1',
        defaultParams: {
            temperature: 0.7, // Higher temp for more "creative" feedback
        },
    },
};


// This is the array that will control which models are run in a test.
export const MODELS_TO_TEST: ModelConfig[] = [
    ALL_MODELS['gpt-4o-mini'],
    ALL_MODELS['gemini-1.5-flash'],
];