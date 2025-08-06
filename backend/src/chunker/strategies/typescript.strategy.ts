// src/strategies/typescript_strategy.ts

import Parser, { type Language } from 'tree-sitter';
import type { LanguageStrategy } from './language.strategy';
import type { ChunkInfo } from '../chunker.interface';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import { BaseStrategy } from './base.strategy';

// Define the dialects this strategy can handle
export type TypeScriptDialect = 'typescript' | 'tsx' | 'javascript' | 'jsx';
export class TypeScriptStrategy extends BaseStrategy
{
  private readonly TOP_LEVEL_TYPES = new Set( [
    'function_declaration',
    'class_declaration',
    'lexical_declaration', // Catches 'const MyComponent = () => ...'
    'variable_declaration',
    'if_statement',
    'for_statement',
    'switch_statement',
    'try_statement',
    'export_statement',
  ] );

  private readonly SUB_NODE_TYPES = new Set( [
    'method_definition',
    'public_field_definition',
    'function_declaration',
    'lexical_declaration',
    'variable_declaration',
    'expression_statement',
    'return_statement',
    'if_statement',
    'for_statement',
    'try_statement',
    'switch_statement',
  ] );

  private readonly CONTEXT_NODE_TYPES = new Set( [
    'import_statement',
    'import_declaration',
    'type_alias_declaration',
    'interface_declaration',
    'enum_declaration',
  ] );

  private parser: Parser;
  private dialect: TypeScriptDialect;

  constructor( dialect: TypeScriptDialect = 'typescript' )
  {
    super()
    this.dialect = dialect;
    this.parser = new Parser();

    // Load the correct grammar based on the dialect.
    switch ( dialect )
    {
      case 'typescript':
        this.parser.setLanguage( TypeScript.typescript as Language );
        break;
      case 'tsx':
        this.parser.setLanguage( TypeScript.tsx as Language );
        break;
      case 'javascript':
        this.parser.setLanguage( JavaScript as Language );
        break;
      case 'jsx':
        // Note: The tree-sitter-javascript library often handles JSX by default.
        // Depending on the library version, you might just use JavaScript here.
        this.parser.setLanguage( JavaScript as Language );
        break;
    }
  }

  public parse ( code: string ): Parser.Tree
  {
    return this.parser.parse( code );
  }

  public getTopLevelNodes ( tree: Parser.Tree ): Parser.SyntaxNode[]
  {
    const nodes: Parser.SyntaxNode[] = [];
    for ( const topNode of tree.rootNode.namedChildren )
    {
      const node = this.unwrapExport( topNode );
      if ( this.TOP_LEVEL_TYPES.has( topNode.type ) )
      {
        // Filter out simple, non-function variable declarations at the top level.
        if ( ( node.type === 'lexical_declaration' || node.type === 'variable_declaration' ) && !this.isFunctionDeclaration( node ) )
        {
          continue;
        }
        nodes.push( topNode );
      }
    }
    return nodes.sort( ( a, b ) => a.startIndex - b.startIndex );
  }

  public getSubNodes ( node: Parser.SyntaxNode ): Parser.SyntaxNode[]
  {
    const subNodes: Parser.SyntaxNode[] = [];
    // Find the main body of code within the node we are trying to split.
    const bodyNode = node.descendantsOfType( [ 'statement_block', 'class_body', 'object' ] )[ 0 ];

    if ( bodyNode )
    {
      for ( const statementNode of bodyNode.namedChildren )
      {
        if ( this.SUB_NODE_TYPES.has( statementNode.type ) )
        {
          subNodes.push( statementNode );
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
      if ( this.CONTEXT_NODE_TYPES.has( node.type ) )
      {
        contextLines.push( node.text );
      }
      // Add a simple const variable if it's not a function
      if ( ( node.type === 'lexical_declaration' || node.type === 'variable_declaration' ) && !this.isFunctionDeclaration( node ) )
      {
        if ( node.text.length < 200 )
        { // Heuristic to keep context small
          contextLines.push( node.text );
        }
      }
    }
    return contextLines.join( '\n' );
  }

  /**
     * A helper to determine if a declaration is likely a function.
     */
  private isFunctionDeclaration ( node: Parser.SyntaxNode ): boolean
  {
    // A simple AST-based check is more robust than regex.
    // Look for arrow_function or function nodes within the declaration.
    return node.descendantsOfType( [ 'arrow_function', 'function' ] ).length > 0;
  }

  /**
   * A helper specific to JS/TS to handle the `export` keyword wrapper.
   */
  private unwrapExport ( node: Parser.SyntaxNode ): Parser.SyntaxNode
  {
    if ( node.type === 'export_statement' && node.namedChild( 0 ) )
    {
      return node.namedChild( 0 );
    }
    return node;
  }

  public shouldSkipChunk ( chunk: ChunkInfo ): string | null
  {
    const text = chunk.originalText || '';
    const codeTokens = chunk.codeOnlyTokens || 0;

    if ( this.isSimpleTypeDefinition( text, chunk.type ) && codeTokens > 100 )
    {
      return 'simple_type_definition';
    }

    const codeRatio = this.calculateCodeRatio( text );
    if ( codeRatio < 0.3 )
    {
      return `low_code_ratio (${codeRatio.toFixed( 2 )})`;
    }

    // We can keep a boilerplate threshold in the main config if it's universal,
    // or let the strategy define its own. For now, let's assume it's universal.
    // To do this, the chunker would need to pass the config to this method,
    // or we pass the threshold value itself. Let's simplify for now.
    const BOILERPLATE_THRESHOLD = 0.6;
    if ( codeTokens > 1200 )
    {
      const boilerplateScore = this.calculateBoilerplateScore( text );
      if ( boilerplateScore > BOILERPLATE_THRESHOLD )
      {
        return `boilerplate_large (score: ${boilerplateScore.toFixed( 2 )})`;
      }
    }

    return null;
  }

  // --- Private helpers for the TypeScript-specific skipping logic ---

  private isSimpleTypeDefinition ( text: string, type: string ): boolean
  {
    // This regex logic is highly specific to TypeScript/JavaScript syntax.
    if ( type === 'variable_declaration' && text.includes( '=>' ) )
    {
      return false;
    }
    const typePatterns = [
      /^\s*(?:export\s+)?(?:interface|type)\s+\w+/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*:\s*[\w\s|&<>[\]{}'"`]+\s*=\s*(?!.*=>)/
    ];
    return typePatterns.some( pattern => pattern.test( text ) );
  }

  private calculateBoilerplateScore ( text: string ): number
  {
    // These patterns are somewhat generic but more tuned for JS-like syntax.
    const patterns = [
      /(?:export|import)\s+/g,
      /{\s*[\w\s:'"`,;\[\]]*\s*}/g,
      /(?:interface|type)\s+\w+/g,
      /(\w+):\s*\1/g // e.g., { foo: foo }
    ];
    let boilerplateChars = 0;
    patterns.forEach( pattern =>
    {
      const matches = text.match( pattern ) || [];
      boilerplateChars += matches.join( '' ).length;
    } );
    return Math.min( boilerplateChars / ( text.length || 1 ), 1 );
  }

  private calculateCodeRatio ( text: string ): number
  {
    // This is fairly language-agnostic, but comment styles can vary.
    const lines = text.split( '\n' );
    const codeLines = lines.filter( line =>
    {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith( '//' ) && !trimmed.startsWith( '/*' ) &&
        !trimmed.startsWith( '*' ) && trimmed !== '{' && trimmed !== '}';
    } );
    return codeLines.length / Math.max( lines.length, 1 );
  }
}