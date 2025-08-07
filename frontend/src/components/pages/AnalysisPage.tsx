import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Github, ArrowLeft, CheckCircle, Wrench, Sparkles, Loader2, NotebookText, ListOrdered, ShieldAlert, Zap, Puzzle } from 'lucide-react';
import type { ProjectScorecard, ScoredFile } from '@/types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAnalysisPolling } from '@/hooks/useAnalysisPolling';
import ErrorComponent from '../ErrorComponent';
import { AnalysisLoader } from '../AnalysisLoader';
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner";
import { ProjectOverview } from '../ProjectOverview';

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
  const unscoredFiles = useMemo( () =>
  {
    if ( !allFiles || !report?.scoredFiles ) return [];
    const scoredFilePaths = new Set( report.scoredFiles.map( sf => sf.filePath.replace( /^repo_cache\/[^\/]+\//, '' ) ) );
    return allFiles.filter( filePath => !scoredFilePaths.has( filePath ) );
  }, [ allFiles, report?.scoredFiles ] );

  // NEW: Handler for the on-demand scoring click
  const handleScoreFileClick = useCallback( async ( filePath: string ) =>
  {
    toast( "🚀 Scoring initiated...", { description: `AI is now analyzing ${filePath}.` } );

    const newScoredFile = await scoreFile( filePath ); // The hook now returns the new file

    if ( newScoredFile )
    {
      toast.success( "✅ Analysis Complete!", {
        description: `${filePath}-${newScoredFile.totalOriginalTokens} has been scored and added to the report. `,
      } );
      // CRITICAL: Automatically select the newly scored file to show its details
      setSelectedFile( newScoredFile );
    } else
    {
      toast.error( "❌ Scoring Failed", {
        description: "An error occurred while scoring the file.",
      } );
    }
  }, [ scoreFile, toast ] );


  if ( !repoUrl ) return <ErrorComponent message="No repository URL provided." />;
  if ( isLoading ) return <AnalysisLoader logHistory={logHistory} isLoading={isLoading} error={error} />; // Simplified for clarity
  if ( error ) return <ErrorComponent message={error} />;
  if ( !report && !error ) return <AnalysisLoader logHistory={logHistory} isLoading={isLoading} error={"Waiting for report..."} />;// Initial state

  return (
    <>
      <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-900/50 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-900/50 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-900/50 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        {/* --- LEFT SIDEBAR: With Scored and Unscored Sections --- */}
        <aside className="w-1/3 max-w-sm h-full flex flex-col border-r border-zinc-800">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold">Analyzed Files</h2>
            <p className="text-sm text-zinc-400">{report.scoredFiles.length} files selected for scoring</p>
          </div>
          <div className="flex-grow overflow-y-auto">
            {/* AI-Selected Scored Files */}
            <div className="px-2 py-2">
              <h3 className="px-2 text-xs font-semibold uppercase text-zinc-500">AI Selected Files</h3>
              {report.scoredFiles.map( file => (
                <FileListItem
                  key={file.filePath}
                  file={file}
                  isSelected={selectedFile?.filePath === file.filePath}
                  onClick={() => setSelectedFile( file )}
                />
              ) )}
            </div>

            {/* Unscored Files */}
            {unscoredFiles.length > 0 && (
              <div className="px-2 py-2 border-t border-zinc-800">
                <h3 className="px-2 text-xs font-semibold uppercase text-zinc-500">Other Project Files</h3>
                {unscoredFiles.map( filePath => (
                  <UnscoredFileListItem
                    key={filePath}
                    filePath={filePath}
                    isLoading={!!isScoringFile}
                    onClick={() => handleScoreFileClick( filePath )}
                  />
                ) )}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-zinc-800 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
              <ArrowLeft className="h-4 w-4" />
              Analyze Another Project
            </Link>
          </div>
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 h-full overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedFile ? selectedFile.filePath : 'project-overview'}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {selectedFile ? (
                <FileDetailView file={selectedFile} onClear={() => setSelectedFile( null )} />
              ) : (
                <ProjectOverview report={report!} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster />
    </>
  );
}

// --- NEW Sub-components for the Sidebar ---

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

const UnscoredFileListItem = ( { filePath, isLoading, onClick }: { filePath: string, isLoading: boolean, onClick: () => void } ) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className="w-full text-left p-2 rounded-md hover:bg-zinc-900 transition-colors text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center"
  >
    <p className="font-mono text-sm truncate">{filePath}</p>
    {isLoading ?
      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> :
      <Badge variant="outline" className="border-zinc-700 text-zinc-500">
        <Sparkles className="h-3 w-3 mr-1" />
        Score
      </Badge>
    }
  </button>
);

const FileDetailView = ( { file, onClear }: { file: ScoredFile; onClear: () => void } ) =>
{
  // Helper to find the line range for a group
  const getGroupLineRange = ( groupId: number ) =>
  {
    const groupData = file.chunkingDetails.groupedChunks.find( g => g.groupId === groupId );
    if ( !groupData || groupData.chunks.length === 0 ) return `Chunk ${groupId}`;
    const startLine = Math.min( ...groupData.chunks.map( c => c.startLine ) );
    const endLine = Math.max( ...groupData.chunks.map( c => c.endLine ) );
    return `Lines ${startLine}-${endLine}`;
  };

  return (
    <div>
      {/* --- Header --- */}
      <button onClick={onClear} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Project Overview
      </button>
      <h2 className="text-3xl font-bold font-mono break-all">{file.filePath.replace( /^repo_cache\/[^\/]+\//, '' )}</h2>

      {/* --- Top-Level Metrics --- */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <MetricCard label="Impact Score" value={file.impactScore.toFixed( 1 )} color="emerald" />
        <MetricCard label="Complexity" value={file.averageComplexity.toFixed( 1 )} />
        <MetricCard label="Quality" value={file.averageQuality.toFixed( 1 )} />
        <MetricCard label="Retries" value={file.retries} color={file.retries > 0 ? "amber" : "default"} />
      </div>

      {/* --- Granular AI Feedback Cards --- */}
      <div className="mt-8 space-y-6">
        {file.scoredChunkGroups.map( group => (
          <Card key={group.groupId} className="glass-card-dark border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-200">
                AI Audit for {getGroupLineRange( group.groupId )}
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
        ) )}
      </div>
    </div>
  );
};

// --- NEW Helper Sub-components for a cleaner, more modular view ---

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
      <h4 className={cn( "font-semibold flex items-center gap-3", colorClasses[ color] )}>
        {icon}
        <span>{title}</span>
      </h4>
      <p className="text-zinc-300 pl-8 mt-2">{content}</p>
    </div>
  );
};