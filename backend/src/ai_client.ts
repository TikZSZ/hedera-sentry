// src/ai_client.ts

import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { ModelConfig,GenerationParams } from './models.config';

// Universal interfaces
export interface ChatMessage
{
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface TokenUsage
{
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

interface AIResponse
{
    content: string; // text
    usage: TokenUsage;
}

// The universal client interface
export interface AIClient
{   modelName: string;
    chatCompletion ( params: { messages: ChatMessage[], generationParams?: GenerationParams; } ): Promise<AIResponse>;
}


// --- Concrete Implementations (Adapters) ---

class OpenAIClient implements AIClient
{
    private client: OpenAI;
    public modelName: string;
    private defaultParams: GenerationParams;

    constructor( config: ModelConfig )
    {
        this.client = new OpenAI( {
            apiKey: process.env[ config.apiKeyEnvVar ],
            baseURL: config.baseURL,
        } );
        this.modelName = config.modelName;
        this.defaultParams = config.defaultParams || {};
    }

    async chatCompletion ( { messages, generationParams  }: { messages: ChatMessage[]; generationParams?: GenerationParams; } ): Promise<AIResponse>
    {   
        console.log('Running',this.modelName,this.constructor.name)
        const finalParams = { ...this.defaultParams, ...generationParams };

        const response = await this.client.chat.completions.create( {
            model: this.modelName,
            messages: messages,
            response_format: !!finalParams.jsonOutput ? { type: 'json_object' } : undefined,
        } );

        return {
            content: response.choices[ 0 ].message.content,
            usage: response.usage as TokenUsage,
        };
    }
}

class GoogleGeminiClient implements AIClient
{
    private client: GoogleGenAI;
    public modelName: string;
    private defaultParams: GenerationParams;

    constructor( config: ModelConfig )
    {
        this.client = new GoogleGenAI( { apiKey: process.env[ config.apiKeyEnvVar ]! } );
        this.modelName = config.modelName;
        this.defaultParams = config.defaultParams || {};
    }

    async chatCompletion ( { messages, generationParams  }: { messages: ChatMessage[]; generationParams?: GenerationParams; } ): Promise<AIResponse>
    {   
        console.log('Running',this.modelName,this.constructor.name)
        // const model = this.client.chats.create( {
        //     model: this.modelName,
        //     config: {
        //         responseMimeType: jsonOutput ? "application/json" : "text/plain"
        //     },
        //     history: messages.map( msg => ( {
        //         role: msg.role === 'assistant' ? 'model' : 'user',
        //         parts: [ { text: msg.content } ]
        //     } ) )
        // } );

        // Translate OpenAI message format to Gemini format
        const finalParams = { ...this.defaultParams, ...generationParams };

        const geminiMessages = messages.map( msg => ( {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [ { text: msg.content } ]
        } ) );

        const result = await this.client.models.generateContent( {
            model: this.modelName,
            config: {
                responseMimeType: !!finalParams.jsonOutput ? "application/json" : "text/plain"
            }, contents: geminiMessages
        } )
        const modelResponse = result.text;
        const {promptTokenCount,totalTokenCount } = result.usageMetadata
        // Gemini SDK doesn't give token usage directly in the response, would need another call if required.
        // For simplicity here, we'll return zeros.
        // In a real scenario, you'd make a separate `model.countTokens()` call.
        const usage: TokenUsage = { prompt_tokens: promptTokenCount, completion_tokens: totalTokenCount-promptTokenCount, total_tokens: totalTokenCount };

        return {
            content: modelResponse,
            usage,
        };
    }
}

// --- The Factory Function ---
export function createAIClient ( config: ModelConfig ): AIClient
{
    switch ( config.provider )
    {
        case 'openai':
        case 'openai-compatible':
            return new OpenAIClient( config );
        case 'google':
            return new GoogleGeminiClient( config );
        default:
            throw new Error( `Unsupported AI provider: ${config.provider}` );
    }
}