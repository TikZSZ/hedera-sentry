import type { ScoredFile } from "@/types";
import { useEffect, useRef, useState } from "react";
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { ArrowLeft, CheckCircle, Loader2, Puzzle, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { editor } from 'monaco-editor'; // Import the main monaco editor type
import { useMonacoDecorations } from "@/hooks/useMonacoDecorations";

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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

// The main, upgraded component
// The new, redesigned component
export const FileDetailView = ( { file, runId, onClear }: { file: ScoredFile; runId: string; onClear: () => void } ) =>
{
  const [ code, setCode ] = useState<string | null>( null );
  const [ isLoadingCode, setIsLoadingCode ] = useState( true );
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>( null );

  // NEW: All the complex effect logic is now handled by this single hook
  const [ hoveredGroupId, setHoveredGroupId ] = useState<number | null>( null );
  useMonacoDecorations( editorRef, file, code,hoveredGroupId );

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


  const handleEditorDidMount: OnMount = ( editor ) =>
  {
    editorRef.current = editor;
  };

  const getGroupLineRange = ( groupId: number, currentFile: ScoredFile ) =>
  {
    const groupData = currentFile.chunkingDetails.groupedChunks.find( g => g.groupId === groupId );
    if ( !groupData || groupData.chunks.length === 0 ) return `Chunk ${groupId}`;
    const startLine = Math.min( ...groupData.chunks.map( c => c.startLine ) );
    const endLine = Math.max( ...groupData.chunks.map( c => c.endLine ) );
    return { start: startLine, end: endLine };
  };


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
      {/* --- Top-Level Metrics --- */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <MetricCard label="Impact Score" value={file.impactScore.toFixed( 1 )} color="emerald" />
        <MetricCard label="Complexity" value={file.averageComplexity.toFixed( 1 )} />
        <MetricCard label="Quality" value={file.averageQuality.toFixed( 1 )} />
        <MetricCard label="Retries" value={file.retries} color={file.retries > 0 ? "amber" : "default"} />
      </div>

      {/* --- Main Content: Code + Audit --- */}
      <div className="flex-grow  grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden py-4 h-screen">
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
                  {group.score.hedera_red_flag.description && (
                    <FeedbackSection
                      title="Red Flag"
                      content={group.score.hedera_red_flag.description}
                      icon={<ShieldAlert className="h-5 w-5 text-red-400" />}
                      color="red"
                    />
                  )}

                  {/* NEW: Hedera Optimization Suggestion - Displayed only if present */}
                  {group.score.hedera_optimization_suggestion.description && (
                    <FeedbackSection
                      title="Optimization Suggestion"
                      content={group.score.hedera_optimization_suggestion.description}
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