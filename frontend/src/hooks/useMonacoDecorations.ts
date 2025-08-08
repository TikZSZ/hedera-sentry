// src/hooks/useMonacoDecorations.ts

import { useRef, useEffect } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import type { ScoredFile } from '@/types';

// A simple helper function to perform the search
function findLineNumber ( fullCode: string, snippet: string ): number | null
{
  if ( !snippet || !fullCode ) return null;
  const trimmedSnippet = snippet.trim();
  const lines = fullCode.split( '\n' );
  // Find the index of the line that contains the exact trimmed snippet.
  // This is simple but effective for single-line quotes.
  const lineIndex = lines.findIndex( line => line.trim() === trimmedSnippet );
  console.log( trimmedSnippet, lineIndex, trimmedSnippet === lines[ 39 ] )
  // If a match is found, return the line number (1-indexed).
  return lineIndex !== -1 ? lineIndex + 1 : null;
}
function findBestMatchLineNumber ( fullCode: string, snippet: string ): number | null
{
  if ( !snippet || !fullCode ) return null;

  const lines = fullCode.split( '\n' );

  // 1. Clean the AI's snippet for matching
  // Removes whitespace, semicolons, and common leading characters like '.'
  const cleanedSnippet = snippet.replace( /[\s;.]/g, '' );
  if ( cleanedSnippet.length < 5 ) return null; // Avoid matching tiny, common snippets like `})`

  let bestMatch = {
    lineNumber: -1,
    similarity: 0, // We'll use a simple length match as a similarity score
  };

  // 2. Iterate through each line of the source code
  for ( let i = 0; i < lines.length; i++ )
  {
    const line = lines[ i ];

    // 3. Clean the source code line in the same way
    const cleanedLine = line.replace( /[\s;.]/g, '' );

    // 4. Check if the cleaned line CONTAINS the cleaned snippet
    if ( cleanedLine.includes( cleanedSnippet ) )
    {
      // This is a potential match. Is it the best one so far?
      // We prefer matches where the snippet makes up a larger percentage of the line,
      // which helps avoid matching a small part of a very long line.
      const similarity = cleanedSnippet.length / cleanedLine.length;

      if ( similarity > bestMatch.similarity )
      {
        bestMatch = {
          lineNumber: i + 1, // Line numbers are 1-indexed
          similarity: similarity,
        };
      }
    }
  }

  // 5. Return the line number of the best match found (if any)
  return bestMatch.lineNumber !== -1 ? bestMatch.lineNumber : null;
}
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
function findMultiLineMatch ( fullCode: string, snippet: string ): MatchLocation | null
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
export function useMonacoDecorations (
  editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>,
  file: ScoredFile | null,
  code: string | null, // The hook now needs the full code content
  hoveredGroupId: number | null
)
{
  const monaco = useMonaco();
  const decorationsRef = useRef<string[]>( [] );

  useEffect( () =>
  {
    const editor = editorRef.current;
    if ( !editor || !monaco || !file || !code ) return; // Guard against null code

    // This function now does the search and creates the decoration
    const createDecorationsForGroup = ( groupId: number ): editor.IModelDeltaDecoration[] =>
    {
      const group = file.scoredChunkGroups.find( g => g.groupId === groupId );
      if ( !group ) return [];

      const decorations: editor.IModelDeltaDecoration[] = [];
      const { hedera_red_flag, hedera_optimization_suggestion } = group.score;
      console.log( group.score )
      // --- Real-time Reconciliation for Red Flag ---
      // if (hedera_red_flag?.exact_code_snippet) {
      //     const lineNumber = findBestMatchLineNumber(code, hedera_red_flag.exact_code_snippet);

      //     if (lineNumber) {
      //         decorations.push({
      //             range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      //             options: {
      //                 isWholeLine: true,
      //                 className: 'monaco-highlight-red',
      //                 hoverMessage: { value: `**Red Flag:** ${hedera_red_flag.description}` }
      //             }
      //         });
      //     }
      // }

      // // --- Real-time Reconciliation for Optimization ---
      // if (hedera_optimization_suggestion?.exact_code_snippet) {
      //      const lineNumber = findBestMatchLineNumber(code, hedera_optimization_suggestion.exact_code_snippet);
      //      if (lineNumber) {
      //         decorations.push({
      //             range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      //             options: {
      //                 isWholeLine: true,
      //                 className: 'monaco-highlight-sky',
      //                 hoverMessage: { value: `**Optimization:** ${hedera_optimization_suggestion.description}` }
      //             }
      //         });
      //      }
      // }
      if ( hedera_red_flag?.exact_code_snippet )
      {
        // USE THE NEW, MULTI-LINE FUNCTION
        const location = findMultiLineMatch( code, hedera_red_flag.exact_code_snippet );
        if ( location )
        {
          console.log(location)
          decorations.push( {
            // Use the start and end lines from the location object
            range: new monaco.Range( location.startLine, 1, location.endLine, 1 ),
            options: {
              isWholeLine: true,
              className: 'monaco-highlight-red',
              hoverMessage: { value: `**Red Flag:** ${hedera_red_flag.description}` }
            }
          } );
        }
      }

      if ( hedera_optimization_suggestion?.exact_code_snippet )
      {
        // USE THE NEW, MULTI-LINE FUNCTION
        const location = findMultiLineMatch( code, hedera_optimization_suggestion.exact_code_snippet );
        if ( location )
        {
          console.log(location)
          decorations.push( {
            // Use the start and end lines from the location object
            range: new monaco.Range( location.startLine, 1, location.endLine, 1 ),
            options: {
              isWholeLine: true,
              className: 'monaco-highlight-sky',
              hoverMessage: { value: `**Optimization:** ${hedera_optimization_suggestion.description}` }
            }
          } );
        }
      }
      return decorations;
    };

    // --- Main Effect Logic ---
    let newDecorations: editor.IModelDeltaDecoration[] = [];

    if ( hoveredGroupId )
    {
      // If a specific group is hovered, highlight it and scroll to it
      const groupData = file.chunkingDetails.groupedChunks.find( g => g.groupId === hoveredGroupId );
      if ( groupData )
      {
        const startLine = groupData.startLine;
        const endLine = groupData.endLine;

        // Add a subtle highlight for the whole hovered chunk
        newDecorations.push( {
          range: new monaco.Range( startLine, 1, endLine, 1 ),
          options: { isWholeLine: true, className: 'monaco-line-highlight-subtle' }
        } );

        // Add the specific feedback highlights for this chunk
        newDecorations.push( ...createDecorationsForGroup( hoveredGroupId ) );

        editor.revealRangeInCenter( {
          startLineNumber: startLine, startColumn: 1,
          endLineNumber: endLine, endColumn: 1,
        }, monaco.editor.ScrollType.Smooth );
      }
    } else
    {
      // If nothing is hovered, show ALL feedback highlights for the whole file
      file.scoredChunkGroups.forEach( group =>
      {
        newDecorations.push( ...createDecorationsForGroup( group.groupId ) );
      } );
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations( decorationsRef.current, newDecorations );

  }, [ file, hoveredGroupId, monaco, editorRef ] );
}