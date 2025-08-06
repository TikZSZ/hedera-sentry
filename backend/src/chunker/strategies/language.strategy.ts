import Parser from "tree-sitter";
import type { ChunkInfo } from "../chunker.interface";
export interface LanguageStrategy
{

    parse ( code: string ): Parser.Tree;

    /**
     * PURPOSE: To identify the main, independent, chunkable blocks in a file.
     * The "nouns" of the codebase.
     */
    getTopLevelNodes ( tree: Parser.Tree, code: string ): Parser.SyntaxNode[];

    /**
     * PURPOSE: To break down a large block into its constituent logical parts.
     * The "verbs" inside the nouns.
     */
    getSubNodes ( node: Parser.SyntaxNode ): Parser.SyntaxNode[];

    /**
     * PURPOSE: To extract all the necessary contextual information (imports, global types)
     * that a chunk from this file would need to be understood in isolation.
     * Returns the raw text for the context header.
     */
    extractFileHeaderText ( tree: Parser.Tree, code: string ): string;

    /**
     * NEW: Determines if a given chunk should be skipped based on
     * language-specific heuristics (e.g., simple type definitions, boilerplate).
     * @param chunk The chunk to evaluate.
     * @returns A string reason for skipping, or null if it should be kept.
     */
    shouldSkipChunk ( chunk: ChunkInfo ): string | null;

    /**
    * Provides a fallback mechanism for splitting a node's content when an AST-based
    * breakdown is not possible or desirable. For most languages, this will be a
    * simple line-by-line text split. For others (like JSON), it could be smarter.
    * @returns An array of ChunkInfo objects representing the split parts.
    */
    fallbackSplitter ( node: Parser.SyntaxNode, code: string, maxTokens: number, estimateTokens: ( text: string ) => number ): ChunkInfo[];
}