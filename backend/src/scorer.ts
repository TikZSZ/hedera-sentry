// src/scorer.ts

import { type FileChunkGroup } from './chunker/chunker.interface';
import { AI_CONFIG, CHUNKER_CONFIG, DOSSIER_BUDGET, MAX_BATCH_BUDGET, type DossierStrategy } from './config';
import
{
  FINAL_REVIEW_PROMPT_TEMPLATE,
  REVIEWER_NOTES_FIELD_PROMPT,
} from './prompts';
import
{
  MULTI_FILE_SCORING_PROMPT_TEMPLATE,
  SCORING_PROMPT_TEMPLATE
} from './prompts.v2';

import type { AIScore, ScoredChunkGroup, ScoredFile, ProjectScorecard, FinalReviewAnalysis, Usage, PreliminaryProjectScorecard, ProjectContext } from './scoring.interfaces';
import { OpenAI } from "openai"
import { safeJsonChatCompletion } from './utils';
import type { AIClient } from './ai_client';

// A new interface for our flattened chunk group data
interface DossierEntry
{
  filePath: string;
  groupId: number;
  groupImpactScore: number;
  combinedText: string;
  totalTokens: number;
  score: AIScore;
}

export class ScoringEngine
{
  private runId: string
  private client: AIClient; // No longer `OpenAI`, but our universal client

  constructor( client: AIClient, private projectContext: ProjectContext, runId: string, )
  {
    this.projectContext = projectContext;
    this.runId = runId
    this.client = client;
  }

  /**
   * Scores a single file by processing all its chunk groups.
   * Implements "Intra-File Context Propagation".
   */
  async scoreFile ( fileGroup: FileChunkGroup, interFileContext: string, debug: boolean = false // Add the debug flag, default to false
  ): Promise<ScoredFile>
  {
    console.log( `Scoring file: ${fileGroup.filePath}...` );

    let intraFileContext = "This is the first part of the file.";
    const scoredChunkGroups: ScoredChunkGroup[] = [];
    let errored = 0

    for ( const group of fileGroup.groupedChunks )
    {
      let prompt = SCORING_PROMPT_TEMPLATE
        .replace( '{{domain}}', this.projectContext.domain )
        .replace( '{{stack}}', this.projectContext.stack.join( ', ' ) )
        .replace( '{{inter_file_context}}', interFileContext )
        .replace( '{{intra_file_context}}', intraFileContext )
        .replace( '{{filePath}}', fileGroup.filePath )
        .replace( '{{code_to_review}}', group.combinedText );

      if ( debug )
      {
        prompt = prompt.replace( '{{reviewer_notes_field}}', REVIEWER_NOTES_FIELD_PROMPT );
      } else
      {
        // If not in debug mode, remove the placeholder and the trailing comma
        prompt = prompt.replace( ',\n\n  {{reviewer_notes_field}}', '' );
      }

      const score = await safeJsonChatCompletion<AIScore>( {
        client: this.client,
        messages: [ { role: 'user', content: prompt } ],
        debug: false
      } );

      if ( score )
      {
        scoredChunkGroups.push( {
          groupId: group.groupId,
          score: score.obj,
          totalTokens: group.totalTokens,
          usage: score.usage // tokens used for group score
        } );

        intraFileContext = score.obj.group_summary; // Update context
      } else
      {
        // Optional: still maintain empty score for analytics
        scoredChunkGroups.push( {
          groupId: group.groupId,
          score: {
            best_practices_adherence: 0,
            code_quality_score: 0,
            complexity_score: 0,
            maintainability_score: 0,
            group_summary: "[Skipped due to parsing failure]",
          },
          totalTokens: group.totalTokens,
          usage: null
        } );
      }
    }

    let qualitySum = 0;
    let complexitySum = 0;
    scoredChunkGroups.forEach( g =>
    {
      if ( g.score.complexity_score > 0 )
      {
        qualitySum += g.score.code_quality_score + g.score.maintainability_score + g.score.best_practices_adherence;
        complexitySum += g.score.complexity_score;
      }
    } );

    const averageQuality = ( qualitySum / ( scoredChunkGroups.length * 3 ) ); // Avg quality on a 1-10 scale
    const averageComplexity = ( complexitySum / scoredChunkGroups.length );

    const impactScore = averageQuality * averageComplexity;

    const totalFileUsage = scoredChunkGroups.reduce
      ( ( acc, g ) =>
      ( {
        prompt_tokens: acc.prompt_tokens + g.usage.prompt_tokens,
        completion_tokens: acc.completion_tokens + g.usage.completion_tokens,
        total_tokens: acc.total_tokens + g.usage.total_tokens
      } ),
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } as Usage ) // tokens used for whole file

    return {
      filePath: fileGroup.filePath,
      totalOriginalTokens: fileGroup.totalFileTokens,
      finalTokenCount: fileGroup.finalTokenCount,
      impactScore: impactScore,
      // You can calculate other average scores here if needed
      averageComplexity: scoredChunkGroups.reduce( ( acc, g ) => acc + g.score.complexity_score, 0 ) / scoredChunkGroups.length,
      averageQuality: scoredChunkGroups.reduce( ( acc, g ) => acc + g.score.code_quality_score, 0 ) / scoredChunkGroups.length,
      usage: totalFileUsage,
      retries: 0, // Mark if this success came from a retry
      hadError: false, // This file was successfully scored
      scoredChunkGroups,
      chunkingDetails: fileGroup,
    };
  }

  private async scoreFileBatch (
    batch: FileChunkGroup[],
    interFileContext: string,
    debug: boolean = false
  ): Promise<ScoredFile[]>
  {
    if ( batch.length === 0 ) return [];

    console.log( `Scoring batch of ${batch.length} files...` );

    // --- Initial Scoring Attempt ---
    const initialAttempt = await this.attemptBatchScoring( batch, interFileContext, debug, false );

    // --- Reconciliation and Retry ---
    const successfulFiles = initialAttempt.scoredFiles.filter( sf => !sf.hadError );
    const failedFiles = batch.filter( fg => !successfulFiles.some( sf => sf.filePath === fg.filePath ) );

    if ( failedFiles.length === 0 )
    {
      // Everything succeeded on the first try!
      return initialAttempt.scoredFiles;
    }

    console.warn( `[RETRY] Initial batch call failed for ${failedFiles.length} out of ${batch.length} files. Retrying failed files...` );

    const retryAttempt = await this.attemptBatchScoring( failedFiles, interFileContext, debug, true );

    // --- Final Merge ---
    return [ ...successfulFiles, ...retryAttempt.scoredFiles ];
  }
  /**
 * NEW HELPER: The core logic for a single batch scoring attempt.
 * This is now the reusable unit.
 */
  private async attemptBatchScoring (
    batch: FileChunkGroup[],
    interFileContext: string,
    debug: boolean,
    isRetry: boolean = false
  ): Promise<{ scoredFiles: ScoredFile[], totalUsage: Usage }>
  {
    // 1. Construct the combined code block for the prompt
    const batchedCode = batch.map( fileGroup =>
    {
      // Each file in a batch is a 'full_file' or 'single_group', so it has exactly one chunk group.
      return fileGroup.groupedChunks[ 0 ].combinedText;
    } ).join( '\n\n---\nFile Boundary\n---\n\n' );

    // 2. Construct the prompt using the multi-file template
    let prompt = MULTI_FILE_SCORING_PROMPT_TEMPLATE
      .replace( '{{domain}}', this.projectContext.domain )
      .replace( '{{stack}}', this.projectContext.stack.join( ', ' ) )
      .replace( '{{inter_file_context}}', interFileContext )
      .replace( '{{batched_code}}', batchedCode );

    // Add debug field if needed (similar to scoreFile)
    if ( debug )
    {
      prompt = prompt.replace( '{{reviewer_notes_field}}', REVIEWER_NOTES_FIELD_PROMPT );
    } else
    {
      prompt = prompt.replace( ',\n\n  {{reviewer_notes_field}}', '' );
    }

    const response = await safeJsonChatCompletion<{ reviews: ( AIScore & { file_path: string } )[] }>( {
      client: this.client,
      messages: [ { role: 'user', content: prompt } ],
      debug: false
    } );

    const totalUsage = response?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    if ( !response || !response.obj || !Array.isArray( response.obj.reviews ) )
    {
      console.error( `Batch scoring attempt ${isRetry ? '(RETRY)' : ''} failed: AI did not return a valid 'reviews' array.` );
      return { scoredFiles: [], totalUsage }; // Return empty array, signaling complete failure of the batch
    }

    const successfullyScoredFiles: ScoredFile[] = [];
    const reviews = response.obj.reviews;
    const filesInBatchMap = new Map( batch.map( f => [ f.filePath, f ] ) );

    for ( const review of reviews )
    {
      if ( !review.file_path )
      {
        console.warn( "Warning: AI review object missing 'file_path'. Discarding." );
        continue;
      }

      // Find the best match for the file path returned by the AI
      const matchedFileGroup = Array.from( filesInBatchMap.values() ).find( fg => fg.filePath.endsWith( review.file_path ) );

      if ( matchedFileGroup )
      {
        const fileGroup = matchedFileGroup;

        // This is a successful review, create the full ScoredFile object
        const totalEstimatedTokensInBatch = batch.reduce( ( sum, fg ) => sum + fg.finalTokenCount, 0 );
        const proportionalUsage = {
          prompt_tokens: totalEstimatedTokensInBatch > 0 ? Math.round( totalUsage.prompt_tokens * ( fileGroup.finalTokenCount / totalEstimatedTokensInBatch ) ) : 0,
          completion_tokens: Math.round( totalUsage.completion_tokens / batch.length ),
          total_tokens: ( totalEstimatedTokensInBatch > 0 ? Math.round( totalUsage.prompt_tokens * ( fileGroup.finalTokenCount / totalEstimatedTokensInBatch ) ) : 0 ) + Math.round( totalUsage.completion_tokens / batch.length ),
        };

        const scoredGroup: ScoredChunkGroup = {
          groupId: 1, score: review, totalTokens: fileGroup.finalTokenCount, usage: proportionalUsage,
        };

        const averageQuality = ( review.code_quality_score + review.maintainability_score + review.best_practices_adherence ) / 3;
        const averageComplexity = review.complexity_score;
        const impactScore = averageQuality * averageComplexity;

        successfullyScoredFiles.push( {
          filePath: fileGroup.filePath,
          totalOriginalTokens: fileGroup.totalFileTokens,
          finalTokenCount: fileGroup.finalTokenCount,
          impactScore: impactScore,
          averageComplexity: averageComplexity,
          averageQuality: averageQuality,
          usage: proportionalUsage,
          retries: isRetry ? 1 : 0, // Mark if this success came from a retry
          hadError: false, // This file was successfully scored
          scoredChunkGroups: [ scoredGroup ],
          chunkingDetails: fileGroup,
        } );

        // Remove from map to signify it's been processed
        filesInBatchMap.delete( fileGroup.filePath );
      } else
      {
        console.warn( `Warning: AI returned a review for an unknown file path: '${review.file_path}'. Discarding.` );
      }
    }

    // Any files remaining in the map were sent but not returned by the AI.
    // These are failures from this attempt.
    filesInBatchMap.forEach( unReviewedFileGroup =>
    {
      successfullyScoredFiles.push( this.createEmptyScoredFile( unReviewedFileGroup, isRetry ) );
    } );

    return { scoredFiles: successfullyScoredFiles, totalUsage };
  }

  /**
 * Creates a placeholder ScoredFile object for when AI scoring fails.
 * This ensures the pipeline can continue without crashing.
 * @param fileGroup The FileChunkGroup that failed to be scored.
 * @param isRetry Indicates if this failure happened during a retry attempt.
 * @returns A valid ScoredFile object with zeroed-out scores and error flags.
 */
  private createEmptyScoredFile ( fileGroup: FileChunkGroup, isRetry: boolean = false ): ScoredFile
  {
    const emptyScore: AIScore = {
      complexity_score: 0,
      code_quality_score: 0,
      maintainability_score: 0,
      best_practices_adherence: 0,
      positive_feedback: "[Scoring Failed]",
      improvement_suggestion: "[Scoring Failed]",
      group_summary: "[Scoring Failed]",
    };

    return {
      filePath: fileGroup.filePath,
      totalOriginalTokens: fileGroup.totalFileTokens,
      finalTokenCount: fileGroup.finalTokenCount,
      impactScore: 0,
      averageComplexity: 0,
      averageQuality: 0,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      scoredChunkGroups: fileGroup.groupedChunks.map( g => ( {
        groupId: g.groupId,
        score: emptyScore,
        totalTokens: g.totalTokens,
        usage: null
      } ) ),
      chunkingDetails: fileGroup,
      retries: isRetry ? 1 : 0, // Mark if it failed on a retry
      hadError: true, // This file ultimately failed
    };
  }

  /**
   * Main entry point to generate a full PreliminaryProjectScorecard.
   */
  public async generateScorecard ( dataForScorer: FileChunkGroup[], repoName: string, warnings: any, debug: boolean = false // Add debug flag here too
  ): Promise<PreliminaryProjectScorecard>
  {
    const scoredFiles: ScoredFile[] = [];
    const interFileContext = "Analysis of other project files is ongoing.";

    // --- 1. Partition files into batchable and non-batchable lists ---
    const batchableFiles: FileChunkGroup[] = [];
    const largeFiles: FileChunkGroup[] = [];
    const BATCH_BUDGET = MAX_BATCH_BUDGET; // From config

    for ( const fileGroup of dataForScorer )
    {
      // A file is batchable if it's small and was processed as a single unit.
      if ( ( fileGroup.sendStrategy === 'full_file' || fileGroup.sendStrategy === 'single_group' ) && fileGroup.finalTokenCount < BATCH_BUDGET )
      {
        batchableFiles.push( fileGroup );
      } else
      {
        largeFiles.push( fileGroup );
      }
    }

    batchableFiles.sort( ( a, b ) => b.finalTokenCount - a.finalTokenCount );

    // --- 2. Create and process batches of small files ---
    const batches: FileChunkGroup[][] = [];
    let currentBatch: FileChunkGroup[] = [];
    let currentBatchTokens = 0;

    // New Bin Packer algo Best Fit
    // Use a copy of the array so we can safely modify it.
    let remainingFiles = [ ...batchableFiles ];

    while ( remainingFiles.length > 0 )
    {
      const currentBatch: FileChunkGroup[] = [];
      let currentBatchTokens = 0;

      // Iterate through the remaining files to build one optimal batch.
      for ( let i = 0; i < remainingFiles.length; i++ )
      {
        const file = remainingFiles[ i ];

        if ( currentBatchTokens + file.finalTokenCount <= BATCH_BUDGET )
        {
          // This file fits. Add it to the current batch.
          currentBatch.push( file );
          currentBatchTokens += file.finalTokenCount;

          // Mark this file for removal so it's not considered for the next batch.
          remainingFiles[ i ] = null as any; // Mark for removal
        }
        // If it doesn't fit, we just skip it and keep checking for smaller files.
      }

      // Add the completed batch to our list of batches.
      batches.push( currentBatch );

      // Clean up the array by removing the files we've already batched.
      remainingFiles = remainingFiles.filter( file => file !== null );
    }

    console.log( `Scoring optimization: Batched ${batchableFiles.length} small files into ${batches.length} API calls.` );

    // --- 3. Delegate scoring to the appropriate functions ---
    for ( const batch of batches )
    {
      const batchResults = await this.scoreFileBatch( batch, interFileContext, debug );
      scoredFiles.push( ...batchResults );
    }

    for ( const fileGroup of largeFiles )
    {
      const singleResult = await this.scoreFile( fileGroup, interFileContext, debug );
      scoredFiles.push( singleResult );
    }

    // --- AGGREGATION LOGIC ---
    let totalTokenWeight = 0;
    let weightedComplexity = 0;
    let weightedQuality = 0;
    let weightedMaintainability = 0;
    let weightedBestPractices = 0;
    let totalRetries = 0;
    let totalFailedFiles = 0;
    const totalProjectUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    for ( const file of scoredFiles )
    {
      const tokenWeight = file.totalOriginalTokens;
      totalTokenWeight += tokenWeight;

      // The logic to get file-level averages is CORRECT and NECESSARY.
      let fileTotalComplexity = 0,
        fileTotalQuality = 0,
        fileTotalMaintainability = 0,
        fileTotalBestPractices = 0,
        fileTotalGroupTokens = 0;

      for ( const scoredGroup of file.scoredChunkGroups )
      {
        const groupTokenWeight = scoredGroup.totalTokens;
        fileTotalComplexity += scoredGroup.score.complexity_score * groupTokenWeight;
        fileTotalQuality += scoredGroup.score.code_quality_score * groupTokenWeight;
        fileTotalMaintainability += scoredGroup.score.maintainability_score * groupTokenWeight;
        fileTotalBestPractices += scoredGroup.score.best_practices_adherence * groupTokenWeight;
        fileTotalGroupTokens += groupTokenWeight;
      }
      const fileAvgComplexity = fileTotalGroupTokens > 0 ? fileTotalComplexity / fileTotalGroupTokens : 0;
      const fileAvgQuality = fileTotalGroupTokens > 0 ? fileTotalQuality / fileTotalGroupTokens : 0;
      const fileAvgMaintainability = fileTotalGroupTokens > 0 ? fileTotalMaintainability / fileTotalGroupTokens : 0;
      const fileAvgBestPractices = fileTotalGroupTokens > 0 ? fileTotalBestPractices / fileTotalGroupTokens : 0;

      // Accumulate for the final project profile. This is also CORRECT.
      weightedComplexity += fileAvgComplexity * tokenWeight;
      weightedQuality += fileAvgQuality * tokenWeight;
      weightedMaintainability += fileAvgMaintainability * tokenWeight;
      weightedBestPractices += fileAvgBestPractices * tokenWeight;

      // calculate usage and retry use metrics
      totalRetries += file.retries;
      if ( file.hadError )
      {
        totalFailedFiles++;
      }
      totalProjectUsage.prompt_tokens += file.usage.prompt_tokens
      totalProjectUsage.completion_tokens += file.usage.completion_tokens
      totalProjectUsage.total_tokens += file.usage.total_tokens
    }

    // --- FINALIZATION LOGIC ---

    // Calculate the final weighted average for each profile metric. This is CORRECT.
    const finalProfile = {
      complexity: totalTokenWeight > 0 ? weightedComplexity / totalTokenWeight : 0,
      quality: totalTokenWeight > 0 ? weightedQuality / totalTokenWeight : 0,
      maintainability: totalTokenWeight > 0 ? weightedMaintainability / totalTokenWeight : 0,
      best_practices: totalTokenWeight > 0 ? weightedBestPractices / totalTokenWeight : 0,
    };

    const preliminaryProjectScore =
      ( finalProfile.complexity * 0.40 ) +      // 40% weight on complexity
      ( finalProfile.quality * 0.25 ) +         // 25% weight on quality
      ( finalProfile.maintainability * 0.15 ) + // 15% weight on maintainability
      ( finalProfile.best_practices * 0.20 );   // 20% weight on best practices
    // Total = 100%

    const preliminaryScorecard: PreliminaryProjectScorecard = {
      runId: this.runId,
      repoName,
      model: this.client.modelName,
      preliminaryProjectScore,
      mainDomain: this.projectContext.domain,
      techStack: this.projectContext.stack,
      projectEssence: this.projectContext.projectEssence,
      profile: finalProfile,
      usage: totalProjectUsage,
      totalRetries,
      totalFailedFiles,
      warnings,
      scoredFiles,
    };

    return preliminaryScorecard
  }

  async performFinalReview (
    scorecard: ProjectScorecard, strategy: DossierStrategy = 'top_impact_per_file' // Default to our original strategy

  ): Promise<{ multiplier: number; reasoning: string; techStack: string[]; summary: string }>
  {
    // Delegate the dossier building to a strategy-specific helper
    const { dossierCode, dossierStats, filesSentForFinalEval, groupsInDossier } =
      strategy === 'top_impact_per_file'
        ? this._buildDossierWithTopImpactPerFile( scorecard.scoredFiles )
        : this._buildDossierWithGlobalTopImpact( scorecard.scoredFiles );
    if ( filesSentForFinalEval.length < 1 )
    {
      console.log( { dossierCode, dossierStats, filesSentForFinalEval, groupsInDossier } )
      console.log( 'scoredFiles', scorecard.scoredFiles.length )
      throw new Error( "0 files sent for eval" )
    }
    // console.log(`Final review dossier compiled: ${dossierStats}`);

    // 3. Construct the prompt
    const initialReportSummary = JSON.stringify( {
      preliminary_project_score: scorecard.preliminaryProjectScore, // Use preliminary score
      profile: scorecard.profile,
      techStack: scorecard.techStack,
      mainDomain: scorecard.mainDomain
    }, null, 2 );

    const prompt = FINAL_REVIEW_PROMPT_TEMPLATE
      .replace( '{{project_essence}}', scorecard.projectEssence )
      .replace( '{{initial_report_summary}}', initialReportSummary )
      .replace( '{{dossier_stats}}', dossierStats )
      .replace( '{{code_dossier}}', dossierCode );

    // 4. Make the AI call
    // const res = await this.openai.chat.completions.create( {
    //   model: AI_CONFIG.SCORING_MODEL, // Consider using a more powerful model here if available
    //   messages: [ { role: 'user', content: prompt } ],
    //   response_format: { type: "json_object" },
    // } );

    // const review = JSON.parse( res.choices[ 0 ].message.content ?? '{}' );

    const { obj: review, usage } = await safeJsonChatCompletion<any>( {
      client: this.client,
      messages: [ { role: 'user', content: prompt } ],
    } );

    if ( !review )
    {
      throw console.error( "Final review failed — no valid JSON response from OpenAI." );
    }

    return {
      strategy,
      filesSentForFinalEval,
      usage,
      multiplier: review.final_score_multiplier || 1.0,
      ...review,
      groupsInDossier,
      dossierCode,
    };
  }

  /**
 * Builds the dossier by finding the highest impact ChunkGroups from across all files.
 * This provides a deep dive into the absolute most complex parts of the project.
 */
  private _buildDossierWithGlobalTopImpact ( scoredFiles: ScoredFile[]
  )
  {
    // 1. Sort the FILES by their overall impact score, from highest to lowest.
    const sortedFiles = [...scoredFiles].sort((a, b) => b.impactScore - a.impactScore);

    let tokensUsed = 0;
    let dossierCode = "";
    let filesInDossier = 0;
    const filesSentForFinalEval: string[] = [];
    
    // 2. Iterate through the sorted FILES and try to add the whole file to the dossier.
    for (const file of sortedFiles) {
        // Calculate the total token cost for all chunk groups in this file.
        const fileTokenCost = file.scoredChunkGroups.reduce((sum, g) => sum + g.totalTokens, 0);

        // Check if the ENTIRE file fits in the remaining budget.
        if (tokensUsed + fileTokenCost <= DOSSIER_BUDGET) {
            filesInDossier++;
            filesSentForFinalEval.push(file.filePath);
            
            dossierCode += `\n\n// =======================================================\n`;
            dossierCode += `// FILE START: ${file.filePath}\n`;
            dossierCode += `// File Impact Score: ${file.impactScore.toFixed(2)}\n`;
            dossierCode += `// =======================================================\n`;

            // Add all chunk groups for this file, in their correct order.
            for (const group of file.chunkingDetails.groupedChunks) {
                const scoredGroup = file.scoredChunkGroups.find(sg => sg.groupId === group.groupId);
                const score = scoredGroup?.score;

                dossierCode += `\n\n// --- Group ${group.groupId} ---\n`;
                if (score) {
                    dossierCode += `// Initial Score: { Complexity: ${score.complexity_score}, Quality: ${((score.code_quality_score + score.maintainability_score + score.best_practices_adherence) / 3).toFixed(1)} }\n`;
                }
                dossierCode += group.combinedText;
            }

            tokensUsed += fileTokenCost;
        }
    }

    const dossierStats = `${filesInDossier} top files included, totaling ${tokensUsed} tokens`;
    console.log(`Final review dossier compiled: ${dossierStats}`);

    // We can count the number of groups included for more detailed stats
    const groupsInDossier = scoredFiles
        .filter(sf => filesSentForFinalEval.includes(sf.filePath))
        .reduce((sum, sf) => sum + sf.scoredChunkGroups.length, 0);

    return { dossierCode, dossierStats, filesSentForFinalEval, groupsInDossier };
  }


  /**
   * Builds the dossier by selecting the single highest-impact ChunkGroup from each file.
   * This provides a broad overview of the candidate's "best work" across the project.
   */
  private _buildDossierWithTopImpactPerFile ( scoredFiles: ScoredFile[]
  )
  {
    // 1. Find the single best ChunkGroup from each file
    const topChunkPerFile: DossierEntry[] = [];
    for ( const file of scoredFiles )
    {
      if ( file.scoredChunkGroups.length === 0 ) continue;
      // Find the group with the highest impact score within this file
      const topGroup = file.scoredChunkGroups.reduce( ( maxGroup, currentGroup ) =>
      {
        const maxImpact = ( maxGroup.score.code_quality_score + maxGroup.score.maintainability_score + maxGroup.score.best_practices_adherence ) / 3 * maxGroup.score.complexity_score;
        const currentImpact = ( currentGroup.score.code_quality_score + currentGroup.score.maintainability_score + currentGroup.score.best_practices_adherence ) / 3 * currentGroup.score.complexity_score;
        return currentImpact > maxImpact ? currentGroup : maxGroup;
      } );

      const qualitySum = topGroup.score.code_quality_score + topGroup.score.maintainability_score + topGroup.score.best_practices_adherence;
      const avgQuality = qualitySum / 3;
      const groupImpactScore = avgQuality * topGroup.score.complexity_score;

      topChunkPerFile.push( {
        filePath: file.filePath,
        groupId: topGroup.groupId,
        groupImpactScore,
        combinedText: file.chunkingDetails.groupedChunks.find( g => g.groupId === topGroup.groupId )!.combinedText,
        totalTokens: topGroup.totalTokens,
        score: topGroup.score,
      } );
    }
    // 2. Sort the list of "top chunks" by their impact score, so we add the best of the best first.
    topChunkPerFile.sort( ( a, b ) => b.groupImpactScore - a.groupImpactScore );

    // 3. Build the dossier from this sorted list
    // This building logic is identical to the other strategy's builder.
    let tokensUsed = 0;
    let dossierCode = "";
    let groupsInDossier = 0;
    const filesSentForFinalEval: string[] = [];

    for ( const group of topChunkPerFile )
    {
      if ( tokensUsed + group.totalTokens <= DOSSIER_BUDGET )
      {
        filesSentForFinalEval.push( group.filePath );
        dossierCode += `\n\n// --- From File: ${group.filePath} (Top Group #${group.groupId}) ---\n`;
        dossierCode += `// Initial Score: { Complexity: ${group.score.complexity_score}, Quality: ${( ( group.score.code_quality_score + group.score.maintainability_score + group.score.best_practices_adherence ) / 3 ).toFixed( 1 )} }\n`;
        dossierCode += group.combinedText;
        tokensUsed += group.totalTokens;
        groupsInDossier++;
      }
    }

    const dossierStats = `${groupsInDossier} top groups from ${[ ...new Set( filesSentForFinalEval ) ].length} different files, totaling ${tokensUsed} tokens`;
    console.log( `Final review dossier compiled: ${dossierStats}` );

    return { dossierCode, dossierStats, filesSentForFinalEval, groupsInDossier };
  }
}