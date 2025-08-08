import type { ScoredFile } from "@/types";
import { useEffect, useRef, useState } from "react";
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { ArrowLeft, CheckCircle, Loader2, Puzzle, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { editor } from 'monaco-editor'; // Import the main monaco editor type

const MetricCard = ( { label, value, color = 'default' }: { label: string; value: string | number, color?: 'emerald' | 'amber' | 'default' } ) =>
{
  const colorClasses = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    default: 'text-white',
  };
  return (
    <Card className="glass-card-dark p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={cn( "text-3xl font-bold", colorClasses[ color ] )}>{value}</p>
    </Card>
  );
};
const FeedbackSection = ( { title, content, icon, color }: { title: string; content: string; icon: React.ReactNode, color: string } ) =>
{
  const colorClasses = {
    red: 'text-red-400',
    sky: 'text-sky-400',
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
  };
  return (
    <div className="border-t border-zinc-800 pt-4">
      <h4 className={cn( "font-semibold flex items-center gap-3", colorClasses[ color ] )}>
        {icon}
        <span>{title}</span>
      </h4>
      <p className="text-zinc-300 pl-8 mt-2">{content}</p>
    </div>
  );
};

// NEW: Dummy fetch function for file content
const fetchFileContent = async ( runId: string, filePath: string ): Promise<string> =>
{
  // In a real app, this would hit your new endpoint
  // const response = await fetch(`${API_BASE_URL}/analysis/${runId}/file-content?filePath=${encodeURIComponent(filePath)}`);
  // if (!response.ok) throw new Error("Failed to fetch file content.");
  // return await response.text();

  // For the demo, return some realistic dummy code
  await new Promise( res => setTimeout( res, 500 ) );
  return `
// Dummy content for ${filePath}
// Lines 1-10
import { HederaSDK } from 'some-lib';

// Lines 11-20
export const myFunction = () => {
  // This is a positive feedback area
  console.log("Doing something well!");
};

// Lines 21-30
function anotherFunction() {
  // This is a red flag area
  const myVar = some_insecure_function();
  return myVar;
}

// Lines 31-40
class MyClass {
  // This is an optimization suggestion area
  expensiveOperation() {
    for (let i = 0; i < 10000; i++) {
      // ...
    }
  }
}
    `.trim();
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

// The main, upgraded component
// The new, redesigned component
export const FileDetailView = ( { file, runId, onClear }: { file: ScoredFile; runId: string; onClear: () => void } ) =>
{
  const [ code, setCode ] = useState<string | null>( null );
  const [ isLoadingCode, setIsLoadingCode ] = useState( true );
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>( null );
  const monaco = useMonaco()
  useEffect( () =>
  {
    const fetchFileContent = async () =>
    {
      setIsLoadingCode( true );
      try
      {
        // Construct the full absolute path if needed, or assume file.filePath is correct
        // For this example, assuming file.filePath is what the server expects
        const response = await fetch( `${API_BASE_URL}/analysis/${runId}/file-content?filePath=${encodeURIComponent( file.filePath )}` );
        if ( !response.ok ) throw new Error( 'Failed to fetch file content' );
        const data = await response.text();
        setCode( data );
      } catch ( error )
      {
        console.error( "Error fetching file content:", error );
        setCode( "// Error: Could not load file content." );
      } finally
      {
        setIsLoadingCode( false );
      }
    };

    fetchFileContent();
  }, [ file.filePath, runId ] );

  // NEW: State to track which group is being hovered over
  const [ hoveredGroupId, setHoveredGroupId ] = useState<number | null>( null );

  // This ref will store the decoration IDs so we can remove them later
  const decorationsRef = useRef<string[]>( [] );

  const handleEditorDidMount: OnMount = ( editor, monaco ) =>
  {
    editorRef.current = editor;
    // The screenshot doesn't show complex highlights, so we can keep this simple for now.
    // We can add simple line highlights later if desired.
  };

  const getGroupLineRange = ( groupId: number, currentFile: ScoredFile ) =>
  {
    const groupData = currentFile.chunkingDetails.groupedChunks.find( g => g.groupId === groupId );
    if ( !groupData || groupData.chunks.length === 0 ) return `Chunk ${groupId}`;
    const startLine = Math.min( ...groupData.chunks.map( c => c.startLine ) );
    const endLine = Math.max( ...groupData.chunks.map( c => c.endLine ) );
    return { start: startLine, end: endLine };
  };

  useEffect( () =>
  {
    const editor = editorRef.current;
    if ( !editor || !hoveredGroupId )
    {
      // If nothing is hovered, remove all old decorations
      decorationsRef.current = editor?.deltaDecorations( decorationsRef.current, [] ) ?? [];
      return;
    }

    const newDecorations = []
    const groupData = file.chunkingDetails.groupedChunks.find( g => g.groupId === hoveredGroupId );
    if ( !groupData ) return;
    const group = file.scoredChunkGroups.find( g => g.groupId === hoveredGroupId );
    const startLine = groupData.startLine;
    const endLine = groupData.endLine;

    const highlightLength = Math.max( 1, Math.floor( ( endLine - startLine + 1 ) / 3 ) );
    if ( group && group.score.hedera_red_flag )
    {
      newDecorations.push( {
        range: new monaco.Range( startLine, 1, startLine + highlightLength, 1 ),
        options: {
          isWholeLine: true,
          className: 'highlight-red',
          hoverMessage: { value: `**Red Flag:** ${group.score.hedera_red_flag}` }
        }
      } );
    }

    if ( group && group.score.hedera_optimization_suggestion )
    {
      // Example: Highlight the middle 1/3 for Optimizations
      const start = startLine + highlightLength;
      newDecorations.push( {
        range: new monaco.Range( start, 1, start + highlightLength, 1 ),
        options: {
          isWholeLine: true,
          className: 'highlight-sky',
          hoverMessage: { value: `**Optimization:** ${group.score.hedera_optimization_suggestion}` }
        }
      } );
    }
    // Create a new decoration for the hovered range
    // const newDecorations = [
    //   {
    //     range: new monaco.Range( startLine, 1, endLine, 1 ),
    //     options: {
    //       isWholeLine: true,
    //       // Use a subtle, glowing highlight effect
    //       className: 'monaco-line-highlight',
    //     }
    //   }
    // ];

    // Apply the new decoration, replacing any old ones
    decorationsRef.current = editor.deltaDecorations( decorationsRef.current, newDecorations );

    // Automatically scroll to the highlighted area
    editor.revealRangeInCenter( {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: 1,
    }, monaco.editor.ScrollType.Smooth );

  }, [ hoveredGroupId, file.chunkingDetails.groupedChunks ] );

  return (
    <div className="flex flex-col min-h-[80%]">
      {/* --- Header --- */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-4 shrink-0">
        <button onClick={onClear} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Project Overview
        </button>
        <h2 className="text-xl font-semibold font-mono text-zinc-300 truncate">
          {file.filePath.replace( /^repo_cache\/[^\/]+\//, '' )}
        </h2>
      </div>

      {/* --- Main Content: Code + Audit --- */}
      <div className="flex-grow  grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden p-4 h-screen">
        {/* Left Panel: AI Audit List */}
        <div className="h-full overflow-y-auto space-y-4 pr-2">
          {file.scoredChunkGroups.map( group =>
          {
            const range = getGroupLineRange( group.groupId, file );

            return (
              <Card
                onMouseEnter={() => setHoveredGroupId( group.groupId )}
                // onMouseLeave={() => setHoveredGroupId( null )}
                key={group.groupId}
                className="glass-card-dark border border-zinc-800">

                <CardHeader>
                  <CardTitle className="text-xl text-zinc-200">
                    AI Audit for {range.start} - {range.end}
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    {group.score.group_summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* NEW: Hedera Red Flag - Displayed only if present */}
                  {group.score.hedera_red_flag && (
                    <FeedbackSection
                      title="Red Flag"
                      content={group.score.hedera_red_flag}
                      icon={<ShieldAlert className="h-5 w-5 text-red-400" />}
                      color="red"
                    />
                  )}

                  {/* NEW: Hedera Optimization Suggestion - Displayed only if present */}
                  {group.score.hedera_optimization_suggestion && (
                    <FeedbackSection
                      title="Optimization Suggestion"
                      content={group.score.hedera_optimization_suggestion}
                      icon={<Zap className="h-5 w-5 text-sky-400" />}
                      color="sky"
                    />
                  )}

                  {/* NEW: Web3 Pattern Identification - Displayed only if present */}
                  {group.score.web3_pattern_identification && (
                    <FeedbackSection
                      title="Pattern Identified"
                      content={group.score.web3_pattern_identification}
                      icon={<Puzzle className="h-5 w-5 text-indigo-400" />}
                      color="indigo"
                    />
                  )}

                  {/* Positive Feedback - Always shown if present */}
                  {group.score.positive_feedback && (
                    <FeedbackSection
                      title="Positive Feedback"
                      content={group.score.positive_feedback}
                      icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
                      color="emerald"
                    />
                  )}

                </CardContent>
              </Card>
            )
          } )}
        </div>

        {/* Right Panel: Code Viewer */}
        <div className="h-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          {isLoadingCode ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          ) : (
            <Editor
              height="100%"
              language={getLanguageFromFilePath( file.filePath )}
              theme="vs-dark"
              value={code || ''}
              onMount={handleEditorDidMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                contextmenu: false,
              }}
            />
          )}
        </div> 
      </div>
    </div>
  );
};

// --- Helper function to determine Monaco language from file path ---
const getLanguageFromFilePath = ( filePath: string ): string =>
{
  const ext = filePath.split( '.' ).pop()?.toLowerCase();
  switch ( ext )
  {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'sol':
      return 'typescript'; // soldity doesnt highlight stuff
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
};