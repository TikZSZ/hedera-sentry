// src/strategies/solidity_strategy.ts

import Parser, { type Language } from 'tree-sitter';
import Solidity from 'tree-sitter-solidity';
import type { ChunkInfo } from '../chunker.interface';
import { BaseStrategy } from './base.strategy';

export class SolidityStrategy extends BaseStrategy
{
  // Defines the main, top-level building blocks in a Solidity file.
  private readonly TOP_LEVEL_TYPES = new Set( [
    'contract_definition',
    'interface_definition',
    'library_definition',
    'struct_definition',
    'enum_definition',
    'function_definition', // Top-level functions are possible
  ] );

  // Defines the chunkable units found *inside* a contract or library.
  private readonly SUB_NODE_TYPES = new Set( [
    'function_definition',
    'modifier_definition',
    'event_definition',
    'struct_definition',
    'enum_definition',
    'state_variable_declaration', // Can be useful to chunk complex state variables
  ] );

  // Defines the nodes that provide file-level context.
  private readonly CONTEXT_NODE_TYPES = new Set( [
    'pragma_directive',   // e.g., pragma solidity ^0.8.0;
    'import_directive',   // e.g., import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
  ] );

  private parser: Parser;

  constructor()
  {
    super()
    this.parser = new Parser();
    this.parser.setLanguage( Solidity as Language );
  }

  public parse ( code: string ): Parser.Tree
  {
    return this.parser.parse( code );
  }

  public getTopLevelNodes ( tree: Parser.Tree ): Parser.SyntaxNode[]
  {
    // Solidity's structure is simpler than JS/TS with exports.
    // We just need to find the top-level definitions.
    return tree.rootNode.namedChildren.filter( node =>
      this.TOP_LEVEL_TYPES.has( node.type )
    );
  }

  public getSubNodes ( node: Parser.SyntaxNode ): Parser.SyntaxNode[]
  {
    const subNodes: Parser.SyntaxNode[] = [];
    // The body of a contract is the primary place to look for sub-nodes.
    const bodyNode = node.childForFieldName( 'body' );

    if ( bodyNode )
    {
      for ( const child of bodyNode.namedChildren )
      {
        if ( this.SUB_NODE_TYPES.has( child.type ) )
        {
          subNodes.push( child );
        }
      }
    }
    return subNodes.sort( ( a, b ) => a.startIndex - b.startIndex );
  }

  public extractFileHeaderText ( tree: Parser.Tree, code: string ): string
  {
    const contextLines: string[] = [];
    for ( const node of tree.rootNode.namedChildren )
    {
      // We only look for pragmas and imports for the header context.
      if ( this.CONTEXT_NODE_TYPES.has( node.type ) )
      {
        contextLines.push( node.text );
      } else
      {
        // Once we hit the first contract or function, we can stop.
        break;
      }
    }
    return contextLines.join( '\n' );
  }

  public shouldSkipChunk ( chunk: ChunkInfo ): string | null
  {
    const text = chunk.originalText || '';
    const codeTokens = chunk.codeOnlyTokens || 0;

    // Solidity-specific skipping logic:
    // Example: Skip empty contract definitions or simple interfaces.
    if ( ( chunk.type === 'contract_definition' || chunk.type === 'interface_definition' ) && text.includes( '{}' ) )
    {
      if ( codeTokens < 50 )
      {
        return 'empty_or_simple_interface';
      }
    }

    // Example: Skip simple event definitions.
    if ( chunk.type === 'event_definition' && codeTokens < 30 )
    {
      return 'simple_event_definition';
    }

    // We can reuse the generic code ratio calculation as it's often useful.
    const codeRatio = this.calculateCodeRatio( text );
    if ( codeRatio < 0.3 )
    {
      return `low_code_ratio (${codeRatio.toFixed( 2 )})`;
    }

    return null;
  }

  // This helper is fairly universal, but comment styles are important.
  // Solidity uses // and /* */, so it works perfectly here.
  private calculateCodeRatio ( text: string ): number
  {
    const lines = text.split( '\n' );
    const codeLines = lines.filter( line =>
    {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith( '//' ) && !trimmed.startsWith( '/*' ) &&
        !trimmed.startsWith( '*' );
    } );
    return codeLines.length / Math.max( lines.length, 1 );
  }
}