// src/strategies/declarative_file_strategy.ts

import Parser from 'tree-sitter';
import type { LanguageStrategy } from './language.strategy';
import { estimateTokens } from '../tokenizer';
import type { ChunkInfo } from '../chunker.interface';
import { BaseStrategy } from './base.strategy';

/**
 * A strategy for handling declarative files (e.g., Dockerfile, prisma.schema)
 * that should not be chunked, but treated as a single, holistic unit.
 */
export class DeclarativeFileStrategy extends BaseStrategy
{
  private fileType: string;
  private code: string
  constructor( fileType: string )
  {
    super()
    this.fileType = fileType;
  }

  /**
   * "Parsing" for a declarative file is a no-op. We return a dummy tree.
   * The UniversalChunker doesn't use this tree directly, but the interface requires it.
   */
  public parse ( code: string ): Parser.Tree
  {
    // We can use a dummy parser or just return a mock object.
    // Let's use a dummy parser for correctness.
    this.code = code
    const parser = new Parser();
    return parser.parse( "" ); // Return an empty tree
  }

  shouldSkipChunk ( chunk: ChunkInfo ): string | null
  {
    return null
  }

  /**
   * For a declarative file, the only "top-level node" is the file itself.
   * We create a mock SyntaxNode that represents the entire file content.
   */
  public getTopLevelNodes ( tree: Parser.Tree, code: string ): Parser.SyntaxNode[]
  {
    const lines = code.split( '\n' );

    // Create a "pseudo-node" that represents the whole file.
    const pseudoNode: Parser.SyntaxNode = {
      type: this.fileType, // e.g., 'Dockerfile'
      text: code,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: lines.length - 1, column: lines[ lines.length - 1 ].length },
      // Add other mandatory fields with default values
      startIndex: 0,
      endIndex: code.length,
      id: 0,
      // ... and any other properties your interfaces might rely on
    } as Parser.SyntaxNode; // We cast here because it's not a real tree-sitter node

    return [ pseudoNode ];
  }

  /**
   * Declarative files are atomic. They cannot be broken down into sub-nodes.
   */
  public getSubNodes ( node: Parser.SyntaxNode ): Parser.SyntaxNode[]
  {
    return []; // Always return an empty array
  }

  /**
   * The header for a declarative file is simple: just the file path and its type.
   */
  public extractFileHeaderText ( tree: Parser.Tree, code: string): string
  {
    return `// Type: ${this.fileType}`;
  }
}