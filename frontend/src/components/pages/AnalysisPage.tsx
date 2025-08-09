import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Github, ArrowLeft, CheckCircle, Wrench, Sparkles, Loader2, ShieldAlert, Zap, Puzzle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ScoredFile } from '@/types';
import { useAnalysisPolling } from '@/hooks/useAnalysisPolling';
import ErrorComponent from '../ErrorComponent';
import { AnalysisLoader } from '../AnalysisLoader';
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner";
import { ProjectOverview } from '../ProjectOverview';
import { cn } from '@/lib/utils';
import { FileDetailView } from '../FileDetailView';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"; // NEW import
import { Button } from '../ui/button';
import { ScrollArea } from '@radix-ui/react-scroll-area';


const SCORABLE_EXTENSIONS = new Set( [
  '.ts', '.tsx', '.js', '.jsx', '.json',
  '.html', '.css', '.scss',
  '.md', '.yml', '.yaml',
  '.py', '.java', '.go', '.rs',
  '.sh', '.c', '.cpp', '.h', '.hpp', '.sol'
] );

export default function AnalysisPage ()
{
  const [ searchParams ] = useSearchParams();
  const repoUrl = searchParams.get( 'repo' );

  // The custom hook now manages all data fetching and state for the analysis
  const {
    report,
    allFiles,
    isLoading,
    error,
    startAnalysis,
    scoreFile,
    logHistory,
    isScoringFile // NEW: Get the loading state for on-demand scoring,
  } = useAnalysisPolling( repoUrl );

  const [ isSidebarCollapsed, setIsSidebarCollapsed ] = useState( false );

  // This state now ONLY controls which file is being viewed in the main panel
  const [ selectedFile, setSelectedFile ] = useState<ScoredFile | null>( null );

  useEffect( () =>
  {
    if ( repoUrl && !report && !isLoading )
    {
      startAnalysis();
    }
  }, [ repoUrl, startAnalysis, report ] );

  // This memoized calculation is critical for performance
  const { scorableUnscoredFiles, unscorableFiles } = useMemo( () =>
  {
    if ( !allFiles || !report?.scoredFiles ) return { scorableUnscoredFiles: [], unscorableFiles: [] };

    const scoredFilePaths = new Set(
      report.scoredFiles.map( sf => sf.filePath.replace( /^repo_cache\/[^/]+\//, '' ) )
    );

    const unscored = allFiles.filter( filePath => !scoredFilePaths.has( filePath ) );

    const scorableUnscoredFiles: string[] = [];
    const unscorableFiles: string[] = [];

    for ( const filePath of unscored )
    {
      const ext = filePath.slice( filePath.lastIndexOf( '.' ) ).toLowerCase();
      if ( SCORABLE_EXTENSIONS.has( ext ) )
      {
        scorableUnscoredFiles.push( filePath );
      } else
      {
        unscorableFiles.push( filePath );
      }
    }

    return { scorableUnscoredFiles, unscorableFiles };
  }, [ allFiles, report?.scoredFiles ] );

 


  // NEW: Handler for the on-demand scoring click
  const handleScoreFileClick = useCallback( async ( filePath: string ) =>
  {
    toast( "🚀 Scoring initiated...", { description: `AI is now analyzing ${filePath}.` } );

    const newScoredFile = await scoreFile( filePath ); // The hook now returns the new file

    if ( typeof newScoredFile === "object" )
    {
      toast.success( "✅ Analysis Complete!", {
        description: `${filePath}-${newScoredFile.totalOriginalTokens} has been scored and added to the report. `,
      } );
      // CRITICAL: Automatically select the newly scored file to show its details
      setSelectedFile( newScoredFile );
    } else
    {
      toast.error( "❌ Scoring Failed", {
        description: "An error occurred while scoring the file." + newScoredFile,
      } );
    }
  }, [ scoreFile, toast ] );


  if ( !repoUrl ) return <ErrorComponent message="No repository URL provided." />;
  if ( isLoading ) return <AnalysisLoader logHistory={logHistory} isLoading={isLoading} error={error} />; // Simplified for clarity
  if ( error ) return <ErrorComponent message={error} />;
  if ( !report && !error ) return <AnalysisLoader logHistory={logHistory} isLoading={isLoading} error={"Waiting for report..."} />;// Initial state

  return (
    <>
      <div className="h-screen w-full bg-black text-white font-sans overflow-hidden">
        <PanelGroup
          direction="horizontal"
        >
          {/* Sidebar Panel */}
          <Panel collapsible collapsedSize={0} defaultSize={20} minSize={10} maxSize={40}>
            <aside className="h-full flex flex-col border-r border-zinc-800">
              {/* Header */}
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">Project Files</h2>
                  <p className="text-sm text-zinc-400">
                    {report.scoredFiles.length} files scored
                  </p>
                </div>
                {/* <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLayout( [ 0, 100 ] )} // Collapse
                >
                  <PanelLeftClose className="h-5 w-5 text-zinc-400" />
                </Button> */}
              </div>

              {/* Scrollable file list */}
              <div className="flex-1 overflow-y-auto">
                {/* AI-Selected Scored Files */}
                <div className="px-2 py-2">
                  <h3 className="px-2 text-xs font-semibold uppercase text-zinc-500">
                    Scored Files
                  </h3>
                  {report.scoredFiles.map( ( file ) => (
                    <FileListItem
                      key={file.filePath}
                      file={file}
                      isSelected={selectedFile?.filePath === file.filePath}
                      onClick={() => setSelectedFile( file )}
                    />
                  ) )}
                </div>

                {/* Other Scorable Files */}
                {scorableUnscoredFiles.length > 0 && (
                  <div className="px-2 py-2 border-t border-zinc-800">
                    <h3 className="px-2 text-xs font-semibold uppercase text-zinc-500">
                      Files to score
                    </h3>
                    {scorableUnscoredFiles.map( ( filePath ) => (
                      <UnscoredFileListItem
                        key={filePath}
                        filePath={filePath}
                        isLoading={isScoringFile}
                        onClick={() => handleScoreFileClick( filePath )}
                        disabled={false}
                      />
                    ) )}
                  </div>
                )}

                {/* Unscorable Files */}
                {unscorableFiles.length > 0 && (
                  <div className="px-2 py-2 border-t border-zinc-800">
                    <h3 className="px-2 text-xs font-semibold uppercase text-zinc-500">
                      Unscorable Files
                    </h3>
                    {unscorableFiles.map( ( filePath ) => (
                      <UnscoredFileListItem
                        key={filePath}
                        filePath={filePath}
                        isLoading={false}
                        onClick={() => { }}
                        disabled={true}
                      />
                    ) )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-800 shrink-0">
                <Link
                  to="/"
                  className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Analyze Another Project
                </Link>
              </div>
            </aside>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-2 bg-zinc-900/50 hover:bg-emerald-800/50 transition-colors flex items-center justify-center group">
            <div className="w-1 h-10 bg-zinc-700 rounded-full group-hover:bg-emerald-400 transition-colors" />
          </PanelResizeHandle>

          {/* Main Content */}
          <Panel>
            {/* Show open button if collapsed */}
            {/* {layout[0] === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 left-4 z-50"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLayout( [ defaultSidebarSize, 100 - defaultSidebarSize ] )} // Open
                >
                  <PanelLeftOpen className="h-5 w-5 text-zinc-400" />
                </Button>
              </motion.div>
            )} */}

            <main className="h-full overflow-y-auto p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedFile ? selectedFile.filePath : "project-overview"}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {selectedFile ? (
                    <FileDetailView
                      file={selectedFile}
                      onClear={() => setSelectedFile( null )}
                      runId={report.runId!}
                    />
                  ) : (
                    <ProjectOverview report={report} />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </Panel>
        </PanelGroup>
      </div>
      <Toaster />
    </>
  );
}
const FileListItem = ( { file, isSelected, onClick }: { file: ScoredFile, isSelected: boolean, onClick: () => void } ) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left p-2 rounded-md hover:bg-zinc-900 transition-colors flex justify-between items-center",
      isSelected && "bg-emerald-900/50"
    )}
  >
    <p className="font-mono text-sm text-zinc-300 truncate">{file.filePath}</p>
    <Badge className={cn(
      "bg-zinc-700 text-zinc-300",
      file.impactScore > 60 && "bg-emerald-800 text-emerald-200",
      file.impactScore < 30 && "bg-amber-800 text-amber-200",
    )}>
      {file.impactScore.toFixed( 0 )}
    </Badge>
  </button>
);

const UnscoredFileListItem = ( { filePath, isLoading, onClick, disabled = false }: { filePath: string, isLoading: boolean, onClick: () => void, disabled: boolean } ) => (
  <button
    onClick={onClick}
    disabled={isLoading || disabled}
    className="w-full text-left p-2 rounded-md hover:bg-zinc-900 transition-colors text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center"
  >
    <p className="font-mono text-sm truncate">{filePath}</p>
    {isLoading ?
      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : !disabled ?
        <Badge variant="outline" className="border-zinc-700 text-zinc-500">
          <Sparkles className="h-3 w-3 mr-1" />
          Score
        </Badge> : <></>
    }
  </button>
);

