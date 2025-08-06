// src/main.ts
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Import our modularized code
import { APP_CONFIG, CHUNKER_CONFIG, AI_CONFIG, type DossierStrategy, DOSSIER_BUDGET } from './config';
import { cloneRepo, walkFileTree, getParser, saveReport, promptUser } from './utils';
import { UniversalChunker } from './chunker/chunker';

import { DOMAIN_IDENTIFICATION_PROMPT } from "./prompts"
import { FILE_SELECTION_PROMPT_TEMPLATE } from "./prompts.v2"

import { ScoringEngine } from './scorer'; // Import the new engine
import type { ProjectScorecard } from './scoring.interfaces';
import { createAIClient, type AIClient } from './ai_client';
import { ALL_MODELS } from './models.config';
import { initializeTokenizer, closeTokenizer, estimateTokens } from './tokenizer'; // Import the new initializer
import type { FileChunkGroup } from './chunker/chunker.interface';
import { getStrategyForExtension } from './chunker/strategy.manager';

interface ProjectContext
{
  project_essence: string,
  primary_domain: Vals;
  primary_stack: Vals[];
  core_concepts: Vals[];
}

interface Vals
{
  value: string;
  confidence: number;
}
interface Report
{
  runId: string
  summary: {
    repo: string;
    timestamp: string;
    aiFileSelection: {
      promptTokens: number | undefined;
      completionTokens: number | undefined;
      totalFilesFound: number;
      filesSelectedByAI: number;
    };
    strategySummary: {
      totalSelectedFiles: number;
      full_file: number;
      single_group: number;
      multiple_groups: number;
      unprocessed: number;
      has_oversized_chunks: number;
    };
    tokenSummary: {
      originalTokens_AllProjectFiles: number;
      originalTokens_SelectedFiles: number;
      finalTokens_SentToAI: number;
      breakdown: {
        codeTokens: number;
        contextHeaderTokens: number;
        skippedTokens: number;
        shellContextTokens: number;
        separatorTokens: number;
      };
      savings?: {
        totalSaved: number;
        fromSkipping: number;
        netSavingsPercentage: string;
      };
      contextOverheadPercentage?: string;
    };
    skippedSummary: {
      totalSkippedChunks: number;
      totalSkippedTokens: number;
      byReason: Record<string, number>;
    };
    oversizedSummary: {
      totalOversizedChunks: number;
      totalOversizedTokens: number;
      files: string[];
    };
  };
  projectContext: {
    primary_domain: string;
    project_essence: string;
    primary_stack: string[];
    core_concepts: string[];
  }
  flaggedForReview: {
    path: string,
    reason: string
  }[]
  details: FileChunkGroup[];
}
config();

// --- AI Interaction Logic ---

function sanitizeJson ( json: string ): string
{
  // First, remove block comments
  json = json.replace( /\/\*[\s\S]*?\*\//g, '' );

  // Now strip inline comments from lines inside "files": [ ... ]
  let inFilesArray = false;
  const lines = json.split( '\n' ).map( ( line ) =>
  {
    const trimmed = line.trim();

    if ( trimmed.startsWith( '"files"' ) )
    {
      inFilesArray = true;
      return line;
    }

    if ( inFilesArray )
    {
      if ( trimmed.startsWith( ']' ) )
      {
        inFilesArray = false;
      }

      // Remove inline comments, only for files array entries
      return line.replace( /\/\/.*$/, '' ).trimEnd();
    }

    return line;
  } );

  return lines.join( '\n' ).trim();
}

export function extractJson<T = any> ( text: string ): T | null
{
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```|({[\s\S]*})|(\[[\s\S]*\])/gm;
  let match: RegExpExecArray | null;

  while ( ( match = jsonRegex.exec( text ) ) !== null )
  {
    const candidate = match[ 1 ] || match[ 2 ] || match[ 3 ];
    try
    {
      const cleaned = sanitizeJson( candidate );
      return JSON.parse( cleaned );
    } catch ( e )
    {
      continue; // Try next match
    }
  }

  return null;
}

/**
 * Performs a two-step AI analysis to select the most relevant files for evaluating a candidate's project.
 * Caches the final selection to ensure stable and repeatable runs.
 *
 * @param repoName - The name of the repository, used as a cache key.
 * @param readmeOrDescription - The content of the project's README or a description.
 * @param fileTreeStr - A string representing the project's file structure.
 * @returns A promise resolving to the cached result object, including selections and usage stats.
 */
export async function getRelevantFiles (
  repoName: string,
  readmeOrDescription: string,
  fileTreeStr: string,
  client: AIClient // Dependency Injection
)
{
  const cachePath = path.join( APP_CONFIG.CACHE_DIR, `${repoName}-file-selection.json` );

  console.log( '--- Step 1: Identifying Project Domain and Concepts ---' );
  const projDescription = readmeOrDescription.split( " " ).slice( 0, 2000 ).join( " " )


  // --- STEP 1: DOMAIN IDENTIFICATION CALL ---
  const domainPrompt = DOMAIN_IDENTIFICATION_PROMPT
    .replace( '{{readme}}', projDescription )
    .replace( '{{fileTreeStr}}', fileTreeStr );

  // console.log({projDescription:projDescription.length,projDescriptionTokens:estimateTokens(projDescription),fileTreeStr:fileTreeStr.length,domainPrompt:domainPrompt.length,domainPromptTokens:estimateTokens(domainPrompt)})

  const domainRes = await client.chatCompletion( {
    messages: [ { role: 'user', content: domainPrompt } ],
    generationParams: {
      jsonOutput: true // Use JSON mode for reliability
    },
  } );
  const domainInfo: ProjectContext = JSON.parse( domainRes.content ?? '{}' );
  console.log( 'Project Context Identified:', domainInfo );


  console.log( '--- Step 2: Performing Domain-Aware File Selection ---' );

  // --- STEP 2: FILE SELECTION CALL (using info from Step 1) ---
  const fileSelectionPrompt = FILE_SELECTION_PROMPT_TEMPLATE
    .replace( '{{readme}}', projDescription )
    .replace( '{{fileTreeStr}}', fileTreeStr )
    // @ts-ignore
    .replace( '{{primary_domain}}', domainInfo.primary_domain || 'Unknown' )
    .replace( '{{primary_stack}}', ( domainInfo.primary_stack || [] ).join( ', ' ) )
    .replace( '{{core_concepts}}', ( domainInfo.core_concepts || [] ).join( ', ' ) )
    .replace( '{{{{project_essence}}}}', ( domainInfo.project_essence || '' ) )
  // console.log(fileSelectionPrompt)
  const selectionRes = await client.chatCompletion( { messages: [ { role: 'user', content: fileSelectionPrompt } ], generationParams: { jsonOutput: false } } );
  // const rawSelections = ( selectionRes.content ?? '' ).split( '\n' ).map( l => l.trim() ).filter( Boolean );
  console.log( selectionRes.content )
  const { reasoning, files: rawSelections } = extractJson<{ reasoning: string, files: string[] }>( selectionRes.content )
  console.log( reasoning )
  if ( rawSelections.length < 1 )
  {
    console.log( { aiResp: selectionRes.content, fileSelectionPrompt } )
    throw new Error( "no files were selected" )
  }
  // Post-process the selections to handle comments about vended code
  const selections: string[] = [];
  const flaggedForReview: { path: string; reason: string }[] = [];
  for ( const line of rawSelections )
  {
    if ( line.includes( '#' ) )
    {
      const parts = line.split( '#' );
      flaggedForReview.push( { path: parts[ 0 ].trim(), reason: parts[ 1 ].trim() } );
    } else
    {
      selections.push( line );
    }
  }

  // --- Final Result Assembly and Caching ---
  const totalUsage = {
    prompt_tokens: ( domainRes.usage?.prompt_tokens ?? 0 ) + ( selectionRes.usage?.prompt_tokens ?? 0 ),
    completion_tokens: ( domainRes.usage?.completion_tokens ?? 0 ) + ( selectionRes.usage?.completion_tokens ?? 0 ),
    total_tokens: ( domainRes.usage?.total_tokens ?? 0 ) + ( selectionRes.usage?.total_tokens ?? 0 ),
  };

  const result = {
    model: client.modelName,
    usage: totalUsage,
    selections,
    flaggedForReview,
    totalFiles: fileTreeStr.split( "\n" ).length,
    aiSelectedFiles: selections.length,
    projectContext: domainInfo // Include the identified context in the cache/result
  };

  console.log( 'Final AI Selections:', result.selections );
  if ( result.flaggedForReview.length > 0 )
  {
    console.warn( 'Flagged for Review (Potential Vended Code):', result.flaggedForReview );
  }

  return result;
}

/**
 * Prints a detailed, human-readable analysis report to the console.
 * @param report The final, aggregated report object.
 */
function printAnalysisReport ( report: Report ): void
{
  if ( report.summary.oversizedSummary.totalOversizedChunks > 0 )
  {
    console.log( `\n--- 🚨 Problem Files ---` );
    console.log( `Found ${report.summary.oversizedSummary.totalOversizedChunks} oversized (un-chunkable) items in ${report.summary.oversizedSummary.files.length} files.` );
    console.log( `Files with oversized chunks: ${report.summary.oversizedSummary.files.join( ', ' )}` );
  }

  console.log( `\n\n--- 📄 File-by-File Analysis ---` );
  for ( const detail of report.details )
  {
    const {
      filePath, sendStrategy, totalFileTokens, finalTokenCount,
      groupedChunks, skippedContent, oversizedChunks, tokenBreakdown
    } = detail;

    const savingsPercentage = tokenBreakdown.savingsPercentage.toFixed( 1 );

    console.log( `\n▶ File: ${filePath}` );
    console.log( `  └─ Strategy: ${sendStrategy} | Tokens: ${totalFileTokens} -> ${finalTokenCount} | Savings: ${savingsPercentage}%` );

    // --- NEW: Detailed Token Breakdown Print ---
    console.log( `\n  Token Breakdown for this file:` );
    console.log( `    ├─ Original File Tokens          : ${tokenBreakdown.originalFile}` );
    console.log( `    ├─ Final Sent Tokens             : ${tokenBreakdown.finalSent}` );
    console.log( `    │  ├─ Code                       : ${tokenBreakdown.codeTokensInGroups}` );
    console.log( `    │  ├─ Overhead (Total)           : ${tokenBreakdown.fileHeaderTokensInGroups + tokenBreakdown.shellContextTokensInGroups + tokenBreakdown.separatorTokensInGroups}` );
    const headerReport = `${tokenBreakdown.fileHeaderCount} x ${tokenBreakdown.fileHeaderAvgSize} tokens/header`;
    console.log( `    │     ├─ File Headers          : ${tokenBreakdown.fileHeaderTokensInGroups.toString().padEnd( 5 )} (${headerReport})` );

    const shellReport = `${tokenBreakdown.shellContextCount} x ${tokenBreakdown.shellContextAvgSize} tokens/shell`;
    console.log( `    │     ├─ Shell Contexts        : ${tokenBreakdown.shellContextTokensInGroups.toString().padEnd( 5 )} (${shellReport})` );

    const separatorReport = `${tokenBreakdown.separatorCount} x ${tokenBreakdown.separatorAvgSize} tokens/chunk`;
    console.log( `    │     └─ Separators & Preamble : ${tokenBreakdown.separatorTokensInGroups.toString().padEnd( 5 )} (${separatorReport})` );
    console.log( `    └─ Savings (Total)               : ${tokenBreakdown.totalSavings}` );
    console.log( `       ├─ From Skipped Chunks        : ${tokenBreakdown.skippedCodeTokens}` );
    console.log( `       └─ From Unprocessed/Oversized : ${tokenBreakdown.unprocessedOversizedTokens}` );


    if ( groupedChunks.length > 0 )
    {
      console.log( `\n  ✅ Sent Groups (${groupedChunks.length}):` );
      for ( const group of groupedChunks )
      {
        console.log( `    - Group #${group.groupId} (Lines ${group.startLine}-${group.endLine}, ${group.totalTokens} tokens)` );
        for ( const chunk of group.chunks )
        {
          // --- NEW: Indicate if a chunk has a shell context ---
          const contextIndicator = chunk.shellContext ? " (in shell)" : "";
          console.log( `      - chunk: ${chunk.type}${contextIndicator} (L${chunk.startLine}-${chunk.endLine}, ${chunk.codeOnlyTokens} code tokens)` );
        }
      }
    }

    if ( skippedContent.length > 0 )
    {
      console.log( `\n  ⚠️ Skipped Content (${skippedContent.length}):` );
      for ( const skipped of skippedContent )
      {
        console.log( `    - L${skipped.lines} (${skipped.type}): ${skipped.tokens} tokens - Reason: ${skipped.reason}` );
      }
    }

    if ( oversizedChunks.length > 0 )
    {
      console.log( `\n  🚨 Oversized & Unprocessed Content (${oversizedChunks.length}):` );
      for ( const oversized of oversizedChunks )
      {
        console.log( `    - L${oversized.startLine}-${oversized.endLine} (${oversized.type}): ${oversized.codeOnlyTokens} tokens - UNPROCESSABLE` );
      }
    }
    console.log( '--------------------------------------------------' );
  }


  console.log( `\n\n======= ANALYSIS COMPLETE FOR ${report.summary.repo} =======` );
  console.log( `\n--- 📊 High-Level Summary ---` );
  console.log( `AI selected ${report.summary.aiFileSelection.filesSelectedByAI} / ${report.summary.aiFileSelection.totalFilesFound} files.` );
  console.log( `\nStrategy Distribution:` );
  Object.entries( report.summary.strategySummary ).forEach( ( [ strategy, count ] ) =>
  {
    if ( strategy !== 'totalSelectedFiles' && ( count as number ) > 0 )
      console.log( `  - ${strategy.padEnd( 20, ' ' )}: ${count} files` );
  } );

  console.log( `\nToken & Cost Analysis:` );
  console.log( `  - Original Tokens (Selected Files): ${report.summary.tokenSummary.originalTokens_SelectedFiles.toLocaleString()}` );
  console.log( `  - Final Tokens to be Sent       : ${report.summary.tokenSummary.finalTokens_SentToAI.toLocaleString()}` );
  console.log( `  - Net Savings                   : ${report.summary.tokenSummary.savings.totalSaved.toLocaleString()} tokens (${report.summary.tokenSummary.savings.netSavingsPercentage})` );
  console.log( `  - Context Header Overhead       : ${report.summary.tokenSummary.contextOverheadPercentage} of final tokens` );
}


// --- Main Orchestration (Faithfully reproducing original logic) ---
/**
 * The main analysis pipeline for a single repository.
 * This function orchestrates everything and returns the data needed for scoring.
 * @param repoUrl The URL of the Git repository to analyze.
 * @param options Optional parameters like whether to print the report.
 * @returns A promise that resolves to the detailed chunking data ready for the scoring engine.
 */
export async function analyzeRepo ( repoUrl: string, client: AIClient, options: { printReport?: boolean, } = {}, readmeOverride = '', runId: string = '', updateState?: updateState )
{
  const { printReport = true } = options; // Default to printing the report

  const repoName = path.basename( repoUrl, '.git' );
  const localPath = path.join( APP_CONFIG.LOCAL_REPO_DIR, repoName );
  updateState && updateState( 'preparing', `Cloning ${repoName}...` );
  await cloneRepo( repoUrl, localPath );

  const allFiles = walkFileTree( localPath ); // Assuming improved walkFileTree
  const fileTreeStr = allFiles.map( f => f.relative ).join( '\n' );

  const readmePath = allFiles.find( f => f.relative.toLowerCase() === 'readme.md' )?.absolute;

  const readme = readmeOverride ? readmeOverride : readmePath ? fs.readFileSync( readmePath, 'utf-8' ) : 'No README found.';

  runId = runId || new Date().toISOString();

  // 1. Get relevant files
  updateState && updateState( 'selecting_files', 'Selecting files' )
  const result = await getRelevantFiles( repoName, readme, fileTreeStr, client );
  // save the file selection results

  const { selections: aiSelections, usage: aiUsage, projectContext } = result
  // const aiSelectedSet = new Set<string>();
  // const allFilesNormalized = allFiles.map( f => path.normalize( f.relative ) );
  // for ( const selection of aiSelections )
  // {
  //   const normalizedSelection = path.normalize( selection );
  //   if ( allFilesNormalized.some( f => f.startsWith( normalizedSelection + path.sep ) ) )
  //   {
  //     allFilesNormalized
  //       .filter( f => f.startsWith( normalizedSelection + path.sep ) )
  //       .forEach( f => aiSelectedSet.add( f ) );
  //   } else
  //   {
  //     aiSelectedSet.add( normalizedSelection );
  //   }
  // }
  // --- NEW, MORE ROBUST SELECTION LOGIC ---
    const aiSelectedSet = new Set<string>();
    
    // Normalize all file paths from the repo ONCE.
    const allRepoFilePaths = allFiles.map(f => path.normalize(f.relative));

    for (const selection of aiSelections) {
        const normalizedSelection = path.normalize(selection);
        
        let foundMatch = false;
        for (const repoFilePath of allRepoFilePaths) {
            // Check for an exact match OR if the repo path is a file inside a selected directory
            if (repoFilePath === normalizedSelection || repoFilePath.startsWith(normalizedSelection + path.sep)) {
                aiSelectedSet.add(repoFilePath);
                foundMatch = true;
            }
        }
        
        // If it wasn't a directory and we found no exact match, log a warning.
        // This helps debug when the AI hallucinates a path.
        if (!foundMatch && !selection.endsWith('/')) {
             console.warn(`[WARNING] AI selected a file that was not found in the repository: ${selection}`);
        }
    }

  updateState( 'selecting_files', `AI selected ${aiSelectedSet.size} files for analysis.` );

  // 2. Initialize the Report structure (exactly as in the original)
  const report: Report = {
    runId,
    summary: {
      repo: repoName,
      timestamp: new Date().toISOString(),
      aiFileSelection: {
        promptTokens: aiUsage?.prompt_tokens,
        completionTokens: aiUsage?.completion_tokens,
        totalFilesFound: allFiles.length,
        filesSelectedByAI: aiSelectedSet.size,
      },
      // ... all other summary fields initialized to 0 or {} ...
      strategySummary: { totalSelectedFiles: aiSelectedSet.size, full_file: 0, single_group: 0, multiple_groups: 0, unprocessed: 0, has_oversized_chunks: 0 },
      tokenSummary: { originalTokens_AllProjectFiles: 0, originalTokens_SelectedFiles: 0, finalTokens_SentToAI: 0, breakdown: { codeTokens: 0, contextHeaderTokens: 0, skippedTokens: 0, shellContextTokens: 0, separatorTokens: 0 } },
      skippedSummary: { totalSkippedChunks: 0, totalSkippedTokens: 0, byReason: {} as Record<string, number> },
      oversizedSummary: { totalOversizedChunks: 0, totalOversizedTokens: 0, files: [] as string[] },
    },
    projectContext: {
      core_concepts: projectContext.core_concepts.map( ( val ) => val.value ),
      primary_domain: projectContext.primary_domain.value,
      primary_stack: projectContext.primary_stack.map( ( val ) => val.value ),
      project_essence: projectContext.project_essence
    },
    flaggedForReview: [],
    details: [] as any[],
  };

  updateState( 'chunking_and_scoring', 'Starting file chunking process...' );

  // --- Main Processing and Aggregation Loop (exactly as in the original) ---
  for ( const f of allFiles )
  {
    // Estimate total project tokens (can be simplified later if not needed)
    if ( !report.summary.tokenSummary.originalTokens_AllProjectFiles )
    {
      report.summary.tokenSummary.originalTokens_AllProjectFiles = allFiles.reduce( ( sum, file ) =>
      {
        return sum + estimateTokens( fs.readFileSync( file.absolute, 'utf-8' ) );
      }, 0 );
    }
    if ( aiSelectedSet.has( path.normalize( f.relative ) ) )
    {
      const fileExtension = path.extname( f.absolute );
      updateState && updateState( 'chunking_and_scoring', `Chunking ${path.normalize( f.relative )}...` );
      // --- DYNAMIC STRATEGY SELECTION ---
      const strategy = getStrategyForExtension( path.basename( f.relative ) );

      // If we don't have a strategy for this file type, we skip it.
      if ( !strategy )
      {
        console.warn( `[SKIP] No language strategy found for file type: ${fileExtension}. File: ${f.relative}` );
        continue;
      }

      const code = fs.readFileSync( f.absolute, 'utf-8' );

      const chunker = new UniversalChunker( strategy, estimateTokens, CHUNKER_CONFIG )

      const fileGroup = chunker.chunkFileWithGrouping( code, f.relative );

      // Populate new report structure
      report.summary.strategySummary[ fileGroup.sendStrategy ]++;
      if ( fileGroup.oversizedChunks.length > 0 )
      {
        report.summary.strategySummary.has_oversized_chunks++;
      }

      report.summary.tokenSummary.originalTokens_SelectedFiles += fileGroup.totalFileTokens;
      report.summary.tokenSummary.finalTokens_SentToAI += fileGroup.tokenBreakdown.finalSent;
      report.summary.tokenSummary.breakdown.codeTokens += fileGroup.tokenBreakdown.codeTokensInGroups;
      report.summary.tokenSummary.breakdown.contextHeaderTokens += fileGroup.tokenBreakdown.fileHeaderTokensInGroups;
      report.summary.tokenSummary.breakdown.skippedTokens += fileGroup.tokenBreakdown.skippedCodeTokens;
      report.summary.tokenSummary.breakdown.shellContextTokens += fileGroup.tokenBreakdown.shellContextTokensInGroups;
      report.summary.tokenSummary.breakdown.separatorTokens += fileGroup.tokenBreakdown.separatorTokensInGroups;
      report.summary.skippedSummary.totalSkippedChunks += fileGroup.skippedContent.length;
      fileGroup.skippedContent.forEach( s =>
      {
        report.summary.skippedSummary.byReason[ s.reason ] = ( report.summary.skippedSummary.byReason[ s.reason ] || 0 ) + 1;
      } );

      if ( fileGroup.oversizedChunks.length > 0 )
      {
        report.summary.oversizedSummary.totalOversizedChunks += fileGroup.oversizedChunks.length;
        report.summary.oversizedSummary.totalOversizedTokens += fileGroup.oversizedChunks.reduce( ( sum, c ) => sum + c.codeOnlyTokens, 0 );
        report.summary.oversizedSummary.files.push( f.relative );
      }
      fileGroup.filePath = f.relative
      report.details.push( fileGroup );
    }
  }

  // Final calculations for summary
  const { tokenSummary } = report.summary;
  tokenSummary[ 'savings' ] = {
    totalSaved: tokenSummary.originalTokens_SelectedFiles - tokenSummary.finalTokens_SentToAI,
    fromSkipping: tokenSummary.breakdown.skippedTokens,
    netSavingsPercentage: ( ( tokenSummary.originalTokens_SelectedFiles - tokenSummary.finalTokens_SentToAI ) / ( tokenSummary.originalTokens_SelectedFiles || 1 ) * 100 ).toFixed( 1 ) + '%',
  };
  tokenSummary[ 'contextOverheadPercentage' ] = ( ( tokenSummary.breakdown.contextHeaderTokens / ( tokenSummary.finalTokens_SentToAI || 1 ) ) * 100 ).toFixed( 1 ) + '%';
  report.summary.oversizedSummary.files = [ ...new Set( report.summary.oversizedSummary.files ) ];
  // Unique files
  // 4. Save the machine-readable report
  saveReport( repoName, runId, 'file-selection', {
    runId, "Tokens_AllProjectFiles": report.summary.tokenSummary.originalTokens_AllProjectFiles,
    "Tokens_SelectedFiles": report.summary.tokenSummary.originalTokens_AllProjectFiles, ...result
  } )
  updateState( 'chunking_and_scoring', 'Chunking complete. Aggregating results...' );
  saveReport( repoName, runId, 'chunking-analysis', report );
  // 5. Optionally print the human-readable report
  if ( printReport )
  {
    printAnalysisReport( report );
  }
  const { details: fileGroups, ...rest } = report
  // 6. Return the data the scorer needs
  return report;
}
type Status = 'preparing' | 'selecting_files' | 'chunking_and_scoring' | 'final_review' | 'complete' | 'error';
type updateState = ( status: Status, message: string ) => void

export async function runAnalysisAndScoring ( repoUrl: string, client: AIClient, readmeOverride: string = '', runId: string = '', updateState?: updateState
)
{
  // 1. Run the analysis pipeline to get the processed data.
  let report: Report

  const repoName = path.basename( repoUrl, '.git' );
  const reportPath = path.join( APP_CONFIG.REPORTS_DIR, repoName, `run-${runId}`, 'chunking-analysis.json' );
  if ( fs.existsSync( reportPath ) )
  {
    updateState && updateState( 'selecting_files', 'Distilling README and identifying project context...' );
    console.log( "Running from runId path", reportPath )
    const content = fs.readFileSync( reportPath, 'utf8' );
    report = JSON.parse( content );
  } else
  {
    updateState && updateState( 'selecting_files', 'Distilling README and identifying project context...' );
    report = await analyzeRepo( repoUrl, client, { printReport: false }, readmeOverride, runId, updateState
    );
  }

  // Step 2: Show stats to the user
  console.log( `\n\n======= ANALYSIS COMPLETE FOR ${report.summary.repo} =======` );
  console.log( `\n--- 📊 High-Level Summary ---` );
  console.log( `AI selected ${report.summary.aiFileSelection.filesSelectedByAI} / ${report.summary.aiFileSelection.totalFilesFound} files.` );

  console.log( `\nStrategy Distribution:` );
  Object.entries( report.summary.strategySummary ).forEach( ( [ strategy, count ] ) =>
  {
    if ( strategy !== 'totalSelectedFiles' && count > 0 )
    {
      console.log( `  - ${strategy.padEnd( 20, ' ' )}: ${count} files` );
    }
  } );

  console.log( `\nToken & Cost Analysis:` );
  console.log( `  - Original Tokens (All Project Files): ${report.summary.tokenSummary.originalTokens_AllProjectFiles.toLocaleString()}` );
  console.log( `  - Original Tokens (Selected Files): ${report.summary.tokenSummary.originalTokens_SelectedFiles.toLocaleString()}` );
  console.log( `  - Final Tokens to be Sent       : ${report.summary.tokenSummary.finalTokens_SentToAI.toLocaleString()}` );
  console.log( `  - Net Savings                   : ${report.summary.tokenSummary.savings.totalSaved.toLocaleString()} tokens (${report.summary.tokenSummary.savings.netSavingsPercentage})` );
  console.log( `  - Context Header Overhead       : ${report.summary.tokenSummary.contextOverheadPercentage} of final tokens` );

  // Step 3: Ask user for confirmation
  if ( process.env[ 'NODE_ENV' ] !== 'production' )
  {
    const answer = await promptUser( '\nContinue to scoring? (yes/no): ' );
    if ( answer.toLowerCase() !== 'yes' )
    {
      console.log( '\n❌ Scoring aborted by user.' );
      return;
    }
  }

  // Step 4: Proceed with scoring
  const warnings = {
    // fileLimitHit: report.summary.fileProcessingSummary.fileLimitHit,
    vendedCodeFlagged: report.flaggedForReview || [],
  };

  updateState( 'chunking_and_scoring', 'Preparing to score files...' );
  // Initialize and run the scoring engine
  const scorer = new ScoringEngine( client, { domain: report.projectContext.primary_domain, stack: report.projectContext.primary_stack, projectEssence: report.projectContext.project_essence }, report.runId );

  updateState( 'chunking_and_scoring', 'Scoring files' );
  const preliminaryScoreCard = await scorer.generateScorecard( report.details, report.summary.repo, warnings, false );
  preliminaryScoreCard.scoredFiles.sort( ( a, b ) => b.impactScore - a.impactScore ); // descending
  updateState( 'chunking_and_scoring', 'Scoring Complete' );

  // 4. Save the preliminaryScoreCard
  saveReport( report.summary.repo, report.runId, 'project-scorecard', preliminaryScoreCard );

  // 5. Generate Final Review and save it as calibrated score card
  // const { calibratedScorecard: finalScoreCard } = await runFinalReview( repoUrl, client, report.runId )

  console.log( "\n\n--- ✅ PROJECT SCORECARD GENERATED ---" );
  console.log( `Preliminary Score ${preliminaryScoreCard.repoName}: ${preliminaryScoreCard.preliminaryProjectScore.toFixed( 2 )} / 10` );

  // console.log( `Final Project Score for ${finalScoreCard.repoName}: ${finalScoreCard.finalProjectScore.toFixed( 2 )} / 10` );
  return preliminaryScoreCard
}

export async function runFinalReview ( repoUrl: string, client: AIClient, runId: string, strategy: DossierStrategy = "global_top_impact" )
{
  const repoName = path.basename( repoUrl, '.git' );

  // --- Load the Preliminary Scorecard ---
  const scorecardPath = path.join( APP_CONFIG.REPORTS_DIR, repoName, `run-${runId}`, 'project-scorecard.json' );
  if ( !fs.existsSync( scorecardPath ) )
  {
    throw new Error( `Preliminary scorecard not found for runId ${runId} at ${scorecardPath}` );
  }
  const preliminaryScorecard = JSON.parse( fs.readFileSync( scorecardPath, 'utf8' ) ) as ProjectScorecard;

  // --- Perform the Final Review ---
  const scorer = new ScoringEngine(
    client,
    { domain: preliminaryScorecard.mainDomain, stack: preliminaryScorecard.techStack, projectEssence: preliminaryScorecard.projectEssence },
    runId
  );
  // The `performFinalReview` now takes the preliminary scorecard directly
  const finalReview = await scorer.performFinalReview( preliminaryScorecard, strategy );

  const finalCalibratedScore = preliminaryScorecard.preliminaryProjectScore * finalReview.multiplier;

  preliminaryScorecard.finalProjectScore = finalCalibratedScore

  // --- Create the Calibrated Scorecard ---
  // We start with the original data and then add/overwrite fields.
  const calibratedScorecard = {
    ...preliminaryScorecard,
    finalReview: { model: client.modelName, dossierBudget: DOSSIER_BUDGET, ...( finalReview as any ) },
    scoredFiles: preliminaryScorecard.scoredFiles
  };
  console.log( "\n\n--- ✅ PROJECT SCORECARD GENERATED ---" );
  console.log( `Preliminary Score ${calibratedScorecard.repoName}: ${calibratedScorecard.preliminaryProjectScore.toFixed( 2 )} / 10` );

  console.log( `Final Project Score for ${calibratedScorecard.repoName}: ${calibratedScorecard.finalProjectScore.toFixed( 2 )} / 10` );

  // --- Save the Versioned Report ---
  const reviewTimestamp = new Date().toISOString().replace( /[:.]/g, '-' );
  const reportType = `final-reviews2/calibrated-scorecard-${reviewTimestamp}`;

  saveReport( repoName, runId, reportType, calibratedScorecard );

  return { calibratedScorecard, calibratedScorecardId: `calibrated-scorecard-${reviewTimestamp}` }
}


async function main ()
{
  initializeTokenizer();
}

// main().finally( () =>
// {
//   closeTokenizer()
// } )






