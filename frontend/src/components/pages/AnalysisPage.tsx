import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Github, ArrowLeft, Menu, File, CheckCircle, Wrench } from 'lucide-react';
import { DUMMY_PROJECT_SCORECARD } from '@/lib/dummy-data';
import type { ProjectScorecard, ScoredFile } from '@/types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@radix-ui/react-accordion';
import { useAnalysisPolling } from '@/hooks/useAnalysisPolling';
import ErrorComponent from '../ErrorComponent';
import { AnalysisLoader } from '../AnalysisLoader';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

interface AnalysisState
{
  isLoading: boolean;
  progressMessage: string;
  error: string | null;
  report: ProjectScorecard | null;
}

const fetchAnalysisReport = async ( repoUrl: string ): Promise<ProjectScorecard> =>
{
  console.log( "Fetching analysis for:", repoUrl );
  // Simulate network delay
  await new Promise( resolve => setTimeout( resolve, 100 ) );
  // In a real app, this would be an actual fetch call to your Appwrite function.
  // For now, we return our dummy data.
  return DUMMY_PROJECT_SCORECARD;
};

export default function AnalysisPage ()
{
  const [ searchParams ] = useSearchParams();
  const repoUrl = searchParams.get( 'repo' );
  // const [ report, setReport ] = useState<ProjectScorecard | null>( null );
  // const [ isLoading, setIsLoading ] = useState( true );
  // const [ error, setError ] = useState( '' );
  const [ selectedFile, setSelectedFile ] = useState<ScoredFile | null>( null );

  const { isLoading, logHistory, error, report, startAnalysis } = useAnalysisPolling( repoUrl );

  useEffect( () =>
  {
    // Automatically start the analysis when the component mounts with a valid repoUrl
    if ( repoUrl )
    {
      startAnalysis();
    }
  }, [ repoUrl, startAnalysis ] );

  if ( !repoUrl )
  {
    return <ErrorComponent message="No repository URL provided. Please go back and enter a URL." />;
  }

  if ( isLoading )
  {
    return <AnalysisLoader logHistory={logHistory} isLoading={isLoading} error={error} />
  }


  // if ( error )
  // {
  //   return <ErrorComponent message={`Server Error Occurred${error}`} />;
  // }

  // if(!report){
  //   return <ErrorComponent message='Something went wrong'  />;
  // }

  return report && !isLoading && !error &&
    (
      <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden">

        {/* --- LEFT SIDEBAR: File Breakdown --- */}
        <aside className="w-1/3 max-w-sm h-full flex flex-col border-r border-zinc-800">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold">Analyzed Files</h2>
            <p className="text-sm text-zinc-400">{report.scoredFiles.length} files selected for scoring</p>
          </div>
          <div className="flex-grow overflow-y-auto">
            {report.scoredFiles.map( file => (
              <button
                key={file.filePath}
                onClick={() => setSelectedFile( file )}
                className={cn(
                  "w-full text-left p-4 border-b border-zinc-800 hover:bg-zinc-900 transition-colors",
                  selectedFile?.filePath === file.filePath && "bg-emerald-900/50"
                )}
              >
                <div className="flex justify-between items-center">
                  <p className="font-mono text-sm text-zinc-300 truncate">{file.filePath.replace( /^repo_cache\/[^\/]+\//, '' )}</p>
                  <Badge className={cn(
                    "bg-zinc-700 text-zinc-300",
                    file.impactScore > 60 && "bg-emerald-800 text-emerald-200",
                    file.impactScore < 30 && "bg-amber-800 text-amber-200",
                  )}>
                    {file.impactScore.toFixed( 0 )}
                  </Badge>
                </div>
              </button>
            ) )}
          </div>
          <div className="p-4 border-t border-zinc-800">
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
                <ProjectOverview report={report} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    )
}

// --- Sub-components for Main Content Area ---

const ProjectOverview = ( { report }: { report: ProjectScorecard } ) =>
{
  // const radarData = [ /* ... define radar data for project ... */ ];
  const radarData = report ? [
    { subject: 'Complexity', value: report.profile.complexity },
    { subject: 'Quality', value: report.profile.quality },
    { subject: 'Maintainability', value: report.profile.maintainability },
    { subject: 'Best Practices', value: report.profile.best_practices },
  ] : [];

  return (
    <div>


      <div className="mt-8 grid grid-cols-2 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-4">
            <Github className="h-8 w-8 text-zinc-500" />
            <h1 className="text-4xl font-bold">{report.repoName}</h1>
          </div>
          <p className="mt-3 text-lg text-zinc-400 max-w-3xl">{report.projectEssence}</p>
        </div>
        <Card className="glass-card-dark grid-">
          <CardHeader>
            <CardTitle className="text-zinc-100">Architectural Profile</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 14 }} />
                <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>


        {/* Radar Chart for Project Profile */}

      </div>
      <Card className="glass-card-dark border-emerald-500/30 mt-5">
        <CardHeader>
          <CardTitle className="text-zinc-300">Final Project Score</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-7xl font-bold text-emerald-400">{report.finalProjectScore?.toFixed( 2 )}</div>
          <p className="text-sm text-zinc-400 mt-2">
            (Multiplier: {report.finalReview.multiplier}x)
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card-dark mt-6">
        <CardHeader>
          <CardTitle className="text-xl text-white">CTO's Final Review</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion defaultValue="audit" type="single" collapsible>
            <AccordionItem value="audit">
              <AccordionTrigger className="text-emerald-400 hover:no-underline">Show Detailed Audit Notes</AccordionTrigger>
              <AccordionContent className="pt-4 text-sm text-zinc-400 space-y-4">
                {Object.entries( report.finalReview.reasoning ).map( ( [ title, val ] ) => (
                  <div key={title}>
                    <h4 className="font-semibold text-zinc-200 capitalize">{title.replace( /_/g, ' ' )}</h4>
                    <p>{val as string}</p>
                  </div>
                ) )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};


const FileDetailView = ( { file, onClear }: { file: ScoredFile; onClear: () => void } ) =>
{
  return (
    <div>
      <button onClick={onClear} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Project Overview
      </button>
      <h2 className="text-3xl font-bold font-mono">{file.filePath.replace( /^repo_cache\/[^\/]+\//, '' )}</h2>

      <div className="mt-6 grid grid-cols-4 gap-4 text-center">
        <Card className="glass-card-dark p-4">
          <p className="text-sm text-zinc-400">Impact Score</p>
          <p className="text-3xl font-bold text-emerald-400">{file.impactScore.toFixed( 1 )}</p>
        </Card>
        <Card className="glass-card-dark p-4">
          <p className="text-sm text-zinc-400">Complexity</p>
          <p className="text-3xl font-bold text-emerald-400">{file.averageComplexity.toFixed( 1 )}</p>
        </Card>
        <Card className="glass-card-dark p-4">
          <p className="text-sm text-zinc-400">Quality</p>
          <p className="text-3xl font-bold text-emerald-400">{file.averageQuality.toFixed( 1 )}</p>
        </Card>
        <Card className="glass-card-dark p-4">
          <p className="text-sm text-zinc-400">Retries</p>
          <p className="text-3xl font-bold  text-amber-400">{file.retries}</p>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        {file.scoredChunkGroups.map( group => (
          <Card key={group.groupId} className="glass-card-dark">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-300">AI Feedback (Chunk {group.groupId})</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-400 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Positive Feedback</h4>
                <p className="text-zinc-300 pl-6">{group.score.positive_feedback}</p>
              </div>
              <div>
                <h4 className="font-semibold text-amber-400 flex items-center gap-2"><Wrench className="h-4 w-4" /> Improvement Suggestion</h4>
                <p className="text-zinc-300 pl-6">{group.score.improvement_suggestion}</p>
              </div>
            </CardContent>
          </Card>
        ) )}
      </div>
    </div>
  );
};

// Simple display block for metric
function Metric ( { label, value }: { label: string; value: string } )
{
  return (
    <div className="text-center bg-zinc-800/50 p-4 rounded-lg shadow-inner">
      <p className="text-zinc-400 text-sm">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
