// src/chunker.ts

import Parser from 'tree-sitter';
import type { LanguageStrategy } from './strategies/language.strategy';
import type { ChunkingConfig, FileChunkGroup, ChunkGroup, ChunkInfo, SkippedContent, TokenBreakdown } from './chunker.interface';

export class UniversalChunker
{
  private config: ChunkingConfig;
  private strategy: LanguageStrategy;

  constructor( strategy: LanguageStrategy, public estimateTokens: ( text: string ) => number, config: ChunkingConfig )
  {
    this.strategy = strategy;
    this.config = config;
  }

  public chunkFileWithGrouping ( code: string, filePath: string ): FileChunkGroup
  {
    // The strategy handles the parsing. The chunker just gets the result.
    const tree = this.strategy.parse( code );

    // Step 1: The strategy extracts ALL potential context header text.
    const potentialHeaderText = this.strategy.extractFileHeaderText( tree, code );

    // Step 2: The chunker builds the final header, respecting token limits.
    const contextHeader = this.buildContextHeader( filePath, potentialHeaderText );

    // Step 3: The strategy gets all top-level chunkable nodes.
    const topLevelNodes = this.strategy.getTopLevelNodes( tree,code );

    // Step 4: The chunker iterates through nodes to create initial chunks.
    let allChunks: ChunkInfo[] = [];
    for ( const node of topLevelNodes )
    {
      const nodeText = node.text;
      const codeOnlyTokens = this.estimateTokens( nodeText );

      if ( codeOnlyTokens > this.config.maxTokensPerChunk )
      {
        allChunks.push( ...this.trySubChunk( node, code ) );
      } else
      {
        allChunks.push( {
          originalText: nodeText,
          codeOnlyTokens,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          type: node.type,
          isOversized: false,
        } );
      }
    }
    allChunks.sort( ( a, b ) => a.startLine - b.startLine );

    // --- This is the logic from the non-existent `processAndGroupChunks` ---
    // It's brought back directly into the main function for clarity.

    // Step 5: Identify and mark skippable chunks.
    const skippedContent: SkippedContent[] = [];
    for ( const chunk of allChunks )
    {
      if ( chunk.isOversized || chunk.type.endsWith( '_shell' ) ) continue;
      const skipReason = this.strategy.shouldSkipChunk( chunk ); // This method is language-agnostic
      if ( skipReason )
      {
        chunk.skipReason = skipReason;
        skippedContent.push( {
          reason: skipReason,
          lines: `${chunk.startLine}-${chunk.endLine}`,
          tokens: chunk.codeOnlyTokens,
          type: chunk.type,
          content: ( chunk.originalText || '' ).substring( 0, 100 ) + '...',
        } );
      }
    }

    // Step 6: Determine send strategy and group the active chunks.
    const oversizedChunks = allChunks.filter( c => c.isOversized );
    const activeChunks = allChunks.filter( c => !c.isOversized && !c.skipReason );

    const { sendStrategy, finalGroups } = this.determineStrategyAndGroup(
      activeChunks, oversizedChunks, this.estimateTokens( code ), contextHeader, filePath
    );

    // Step 7: Calculate the final, detailed token breakdown.
    const tokenBreakdown = this.calculateTokenBreakdown( allChunks, finalGroups, this.estimateTokens( code ), contextHeader );

    return {
      filePath,
      totalFileTokens: this.estimateTokens( code ),
      chunks: allChunks,
      groupedChunks: finalGroups,
      oversizedChunks,
      sendStrategy,
      finalTokenCount: tokenBreakdown.finalSent,
      skippedContent,
      contextHeader,
      tokenBreakdown,
    };
  }
  /**
     * A helper to determine the final send strategy and create chunk groups.
     * This encapsulates the logic that comes after initial chunk creation.
     */
  private determineStrategyAndGroup (
    activeChunks: ChunkInfo[],
    oversizedChunks: ChunkInfo[],
    totalFileTokens: number,
    contextHeader: string,
    filePath: string
  ): { sendStrategy: FileChunkGroup[ 'sendStrategy' ], finalGroups: ChunkGroup[] }
  {
    let sendStrategy: FileChunkGroup[ 'sendStrategy' ];
    let finalGroups: ChunkGroup[];

    const fullFileCost = totalFileTokens + this.estimateTokens( contextHeader );
    if ( fullFileCost <= this.config.maxTokensPerGroup && oversizedChunks.length === 0 )
    {
      sendStrategy = 'full_file';
      const code = activeChunks.map( c => c.originalText ).join( '\n' ); // Reassemble code for full_file
      finalGroups = [ {
        combinedText: contextHeader + code,
        totalTokens: fullFileCost,
        chunks: [ {
          originalText: code,
          codeOnlyTokens: totalFileTokens,
          startLine: 1, endLine: code.split( '\n' ).length,
          type: 'full_file', isOversized: false,
        } ],
        startLine: 1, endLine: code.split( '\n' ).length,
        groupId: 1,
      } ];
    } else
    {
      if ( activeChunks.length === 0 && oversizedChunks.length > 0 )
      {
        sendStrategy = 'unprocessed';
        finalGroups = [];
      } else
      {
        finalGroups = this.groupChunks( activeChunks, contextHeader, filePath );
        if ( finalGroups.length === 0 && oversizedChunks.length > 0 )
        {
          sendStrategy = 'unprocessed';
        } else if ( finalGroups.length <= 1 )
        {
          sendStrategy = 'single_group';
        } else
        {
          sendStrategy = 'multiple_groups';
        }
      }
    }
    return { sendStrategy, finalGroups };
  }

  private groupChunks ( activeChunks: ChunkInfo[], contextHeader: string, filePath: string ): ChunkGroup[]
  {
    if ( activeChunks.length === 0 ) return [];

    const groups: ChunkGroup[] = [];
    let currentGroup: ChunkInfo[] = [];
    let currentTokens = 0;
    let groupId = 1;
    const contextTokens = this.estimateTokens( contextHeader );
    const maxGroupTokens = this.config.maxTokensPerGroup - contextTokens;

    for ( const chunk of activeChunks )
    {
      const chunkTokensOnly = chunk.codeOnlyTokens;
      if ( currentTokens + chunkTokensOnly > maxGroupTokens && currentGroup.length > 0 )
      {
        groups.push( this.finalizeGroup( currentGroup, contextHeader, filePath, groupId++ ) );
        currentGroup = [ chunk ];
        currentTokens = chunkTokensOnly;
      } else
      {
        currentGroup.push( chunk );
        currentTokens += chunkTokensOnly;
      }
    }

    if ( currentGroup.length > 0 )
    {
      groups.push( this.finalizeGroup( currentGroup, contextHeader, filePath, groupId ) );
    }
    return groups;
  }



  // THE NEW, IMPORTANT FUNCTION
  private finalizeGroup ( chunksInGroup: ChunkInfo[], contextHeader: string, filePath: string, groupId: number ): ChunkGroup
  {
    let combinedText = contextHeader; // Start with the file-level header ONCE per group.
    let lastShellContext: string | undefined = undefined;

    const separator = '\n\n// --- Next chunk ---\n\n';

    for ( const chunk of chunksInGroup )
    {
      // If this chunk has a shell context AND it's a new one, print it.
      if ( chunk.shellContext && chunk.shellContext.text !== lastShellContext )
      {
        combinedText += `\n${chunk.shellContext.text}\n`;
        lastShellContext = chunk.shellContext.text;
      }
      // If we transition from a sub-chunk back to a top-level chunk, clear the context.
      else if ( !chunk.shellContext && lastShellContext )
      {
        combinedText += `\n// --- End of sub-chunks ---\n`;
        lastShellContext = undefined;
      }

      const chunkPreamble = `// Lines ${chunk.startLine}-${chunk.endLine} (${chunk.type})`;
      combinedText += `${separator}${chunkPreamble}\n${chunk.originalText}`;
    }

    const totalTokens = this.estimateTokens( combinedText );

    return {
      combinedText,
      totalTokens,
      chunks: chunksInGroup,
      startLine: Math.min( ...chunksInGroup.map( c => c.startLine ) ),
      endLine: Math.max( ...chunksInGroup.map( c => c.endLine ) ),
      groupId: groupId,
    };
  }

  // 7. IMPROVED: `calculateTokenBreakdown` is simpler and more accurate.
  private calculateTokenBreakdown (
    allChunks: ChunkInfo[], // Still needed for skipped/oversized
    finalGroups: ChunkGroup[],
    originalFileTokens: number,
    contextHeader: string // Pass the header text in
  ): TokenBreakdown
  {

    // --- Calculate Totals (as before) ---
    const finalSent = finalGroups.reduce( ( sum, g ) => sum + g.totalTokens, 0 );
    const codeTokensInGroups = finalGroups.reduce( ( sum, g ) =>
      sum + g.chunks.reduce( ( chunkSum, c ) => chunkSum + c.codeOnlyTokens, 0 ), 0 );

    // --- NEW: Calculate Detailed Breakdown for Overhead ---

    // 1. File Headers
    const fileHeaderCount = finalGroups.length;
    const fileHeaderAvgSize = this.estimateTokens( contextHeader );
    const fileHeaderTokensInGroups = fileHeaderCount * fileHeaderAvgSize;

    // 2. Shell Contexts
    const uniqueShells = new Map<string, number>(); // Map<shellText, tokenSize>
    finalGroups.forEach( g => g.chunks.forEach( c =>
    {
      if ( c.shellContext && !uniqueShells.has( c.shellContext.text ) )
      {
        uniqueShells.set( c.shellContext.text, c.shellContext.tokens );
      }
    } ) );
    const shellContextCount = uniqueShells.size;
    const shellContextTokensInGroups = Array.from( uniqueShells.values() ).reduce( ( sum, val ) => sum + val, 0 );
    const shellContextAvgSize = shellContextCount > 0 ? Math.round( shellContextTokensInGroups / shellContextCount ) : 0;

    // 3. Separators & Preambles (calculated by remainder for 100% accuracy)
    const separatorTokensInGroups = finalSent - ( codeTokensInGroups + fileHeaderTokensInGroups + shellContextTokensInGroups );
    const separatorCount = finalGroups.reduce( ( sum, g ) => sum + g.chunks.length, 0 );
    // We derive the average size from the accurate total
    const separatorAvgSize = separatorCount > 0 ? Math.round( separatorTokensInGroups / separatorCount ) : 0;

    // --- Calculate Savings (as before) ---
    const skippedCodeTokens = allChunks
      .filter( c => c.skipReason )
      .reduce( ( sum, c ) => sum + c.codeOnlyTokens, 0 );
    const unprocessedOversizedTokens = allChunks
      .filter( c => c.isOversized && !finalGroups.some( g => g.chunks.includes( c ) ) )
      .reduce( ( sum, c ) => sum + c.codeOnlyTokens, 0 );
    const totalSavings = originalFileTokens - finalSent;

    return {
      originalFile: originalFileTokens,
      finalSent,
      codeTokensInGroups,
      fileHeaderTokensInGroups,
      shellContextTokensInGroups,
      separatorTokensInGroups,
      skippedCodeTokens,
      unprocessedOversizedTokens,
      totalSavings,
      savingsPercentage: originalFileTokens > 0 ? ( totalSavings / originalFileTokens ) * 100 : 0,
      // Add the new detailed fields
      fileHeaderCount,
      fileHeaderAvgSize,
      shellContextCount,
      shellContextAvgSize,
      separatorCount,
      separatorAvgSize,
    };
  }

  /**
   * CORRECTED: Assembles the final context header from the text provided
   * by the strategy, enforcing the maxContextTokens limit.
   */
  private buildContextHeader ( filePath: string, headerText: string ): string
  {
    const lines = headerText.split( '\n' );
    const headerLines = [
      `// File: ${filePath}`,
      `// Relevant file context:`,
      ...lines.slice( 0, this.config.contextItemLimit ) // Also limit by number of items
    ];

    let header = headerLines.join( '\n' );
    let currentTokens = this.estimateTokens( header );

    // Truncate by removing lines from the bottom up if it's too long
    while ( currentTokens > this.config.maxContextTokens && headerLines.length > 3 )
    {
      headerLines.pop();
      header = headerLines.join( '\n' );
      currentTokens = this.estimateTokens( header );
    }

    return header + '\n';
  }

  private trySubChunk ( node: Parser.SyntaxNode, code: string ): ChunkInfo[]
  {
    const subNodes = this.strategy.getSubNodes( node );

    if ( subNodes.length > 0 )
    {
      const shellContext = this.createShellContext( node, subNodes, code );
      return subNodes.map( subNode =>
      {
        const subText = subNode.text;
        const subTokens = this.estimateTokens( subText );
        return {
          originalText: subText,
          codeOnlyTokens: subTokens,
          startLine: subNode.startPosition.row + 1,
          endLine: subNode.endPosition.row + 1,
          type: subNode.type,
          shellContext: shellContext,
          isOversized: subTokens > this.config.maxTokensPerChunk,
        };
      } );
    }

    // fallback to recursive text splitting
    return this.strategy.fallbackSplitter(node, node.text, this.config.maxTokensPerChunk,this.estimateTokens);

    // Indivisible node
    // return [ {
    //   originalText: node.text,
    //   codeOnlyTokens: this.estimateTokens( node.text ),
    //   startLine: node.startPosition.row + 1,
    //   endLine: node.endPosition.row + 1,
    //   type: node.type + '_indivisible',
    //   isOversized: true,
    // } ];
  }

  private createShellContext ( parentNode: Parser.SyntaxNode, subNodes: Parser.SyntaxNode[], code: string )
  {
    // This captures everything from the start of the parent to the start of the first sub-chunk,
    // and from the end of the last sub-chunk to the end of the parent.
    const firstSub = subNodes[ 0 ];
    const lastSub = subNodes[ subNodes.length - 1 ];

    // A more robust way to get the shell:
    const openingShell = code.slice( parentNode.startIndex, firstSub.startIndex );
    const closingShell = code.slice( lastSub.endIndex, parentNode.endIndex );
    const shellText = `${openingShell.trimEnd()}\n  // ... [sub-chunks] ...\n${closingShell.trimStart()}`;

    const shellContext = {
      text: `// The following chunks are parts of this parent:\n${shellText}`,
      tokens: this.estimateTokens( shellText ),
    };
    return shellContext
  }
}