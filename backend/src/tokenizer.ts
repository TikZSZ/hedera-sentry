// src/tokenizer.ts

import { get_encoding, Tiktoken } from 'tiktoken';

let encoding: Tiktoken | null = null;

/**
 * Initializes the tokenizer singleton. This should be called once when the application starts.
 * It's an async function because loading the WASM model is an async operation.
 */
export function initializeTokenizer() {
    if (!encoding) {
        console.log("Initializing tokenizer...");
        // "o200k_base" is the encoding used by gpt-4o
        // It's a good default.
        encoding = get_encoding("o200k_base");
        console.log("Tokenizer initialized.");
    }
}

/**
 * Estimates the number of tokens in a given text using the initialized tiktoken encoder.
 * Throws an error if the tokenizer has not been initialized.
 * @param text The string to encode.
 * @returns The number of tokens.
 */
export function estimateTokens(text: string): number {
    if (!encoding) {
        throw new Error("Tokenizer has not been initialized. Please call initializeTokenizer() first.");
    }
    return encoding.encode(text).length;
}

/**
 * Optional: A function to free the tokenizer's memory if the application is shutting down.
 * Not strictly necessary for most server-side scripts but good practice.
 */
export function closeTokenizer(): void {
    if (encoding) {
        encoding.free();
        encoding = null;
        console.log("Tokenizer closed.");
    }
}