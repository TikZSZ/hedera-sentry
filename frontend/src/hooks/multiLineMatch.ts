interface MatchLocation
{
  startLine: number;
  endLine: number;
}

/**
 * A highly robust function to find a multi-line code snippet within a larger
 * source code file, ignoring differences in formatting and whitespace.
 *
 * @param fullCode The complete string content of the source file.
 * @param snippet The (potentially differently formatted) code snippet from the AI.
 * @returns An object with start and end line numbers, or null if no match is found.
 */
export function findMultiLineMatch ( fullCode: string, snippet: string ): MatchLocation | null
{
  if ( !snippet || !fullCode ) return null;

  // 1. "Normalize" both the snippet and the full code by removing all whitespace and newlines.
  // We also remove trailing commas and semicolons which are often formatting-dependent.
  const normalize = ( str: string ) => str.replace( /[\s\n,;]/g, '' );

  const normalizedSnippet = normalize( snippet );
  const normalizedFullCode = normalize( fullCode );

  // 2. Perform a simple, fast indexOf search on the normalized strings.
  const startIndexInNormalized = normalizedFullCode.indexOf( normalizedSnippet );

  if ( startIndexInNormalized === -1 )
  {
    // No match found at all.
    return null;
  }

  const endIndexInNormalized = startIndexInNormalized + normalizedSnippet.length;

  // 3. Map the character indices from the normalized string back to the original source code.
  // This is the clever part. We'll build a map of [normalized_index -> original_index].
  const indexMap: number[] = [];
  for ( let i = 0; i < fullCode.length; i++ )
  {
    const char = fullCode[ i ];
    if ( !/[\s\n,;]/.test( char ) )
    {
      indexMap.push( i );
    }
  }

  if ( endIndexInNormalized >= indexMap.length )
  {
    // This can happen if the snippet is at the very end. Handle gracefully.
    return null;
  }

  const startIndexInOriginal = indexMap[ startIndexInNormalized ];
  const endIndexInOriginal = indexMap[ endIndexInNormalized ];

  // 4. Convert the original character indices to line numbers.
  const codeUpToStart = fullCode.substring( 0, startIndexInOriginal );
  const codeUpToEnd = fullCode.substring( 0, endIndexInOriginal );

  const startLine = ( codeUpToStart.match( /\n/g ) || [] ).length + 1;
  const endLine = ( codeUpToEnd.match( /\n/g ) || [] ).length + 1;

  return { startLine, endLine };
}