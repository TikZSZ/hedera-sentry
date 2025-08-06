// src/strategies/base_strategy.ts

import type Parser from "tree-sitter";
import type { LanguageStrategy } from "./language.strategy";
import type { ChunkInfo } from "../chunker.interface";

export abstract class BaseStrategy implements LanguageStrategy
{
    // All strategies need to implement these
    abstract parse ( code: string ): Parser.Tree;
    abstract getTopLevelNodes ( tree: Parser.Tree, code: string ): Parser.SyntaxNode[];
    abstract getSubNodes ( node: Parser.SyntaxNode ): Parser.SyntaxNode[];
    abstract extractFileHeaderText ( tree: Parser.Tree, code: string ): string;
    abstract shouldSkipChunk ( chunk: ChunkInfo ): string | null;

    // Provide a default, reusable implementation for the fallback
    fallbackSplitter ( node: Parser.SyntaxNode, code: string, maxTokens: number, estimateTokens: ( text: string ) => number ): ChunkInfo[]
    {
        console.warn( `[INFO] Node type '${node.type}' is indivisible or has no sub-nodes. Performing text-based split.`,code.length );

        const chunks: ChunkInfo[] = [];
        const nodeText = node.text;
        const lines = nodeText.split( '\n' );
        let currentChunkLines: string[] = [];
        let part = 1;

        for ( let i = 0; i < lines.length; i++ )
        {
            currentChunkLines.push( lines[ i ] );
            const currentChunkText = currentChunkLines.join( '\n' );

            if ( estimateTokens( currentChunkText ) >= maxTokens || i === lines.length - 1 )
            {
                const startLineOffset = i - currentChunkLines.length + 1;
                chunks.push( {
                    originalText: currentChunkText,
                    codeOnlyTokens: estimateTokens( currentChunkText ),
                    startLine: node.startPosition.row + 1 + startLineOffset,
                    endLine: node.startPosition.row + 1 + i,
                    type: `${node.type}_part_${part++}`,
                    isOversized: false, // It has been split to fit.
                } );
                currentChunkLines = [];
            }
        }
        return chunks;
    }
}
