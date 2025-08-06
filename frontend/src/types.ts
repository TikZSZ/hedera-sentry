export interface ChunkInfo
{
  originalText: string;      // The actual code of the chunk
  codeOnlyTokens: number;
  startLine: number;
  endLine: number;
  type: string;
  // NEW: Context for sub-chunks from their parent (e.g., class MyClass { ... })
  shellContext?: {
    text: string;
    tokens: number;
  };
  // We can remove isOversized here if we handle it differently, but it's okay to keep.
  isOversized: boolean;
  skipReason?: string;
}

export interface ChunkGroup
{
  combinedText: string;
  totalTokens: number;
  chunks: ChunkInfo[];
  startLine: number;
  endLine: number;
  groupId: number;
}

export interface FileChunkGroup
{
  filePath: string;
  totalFileTokens: number;
  chunks: ChunkInfo[]; // All chunks created, including skipped
  groupedChunks: ChunkGroup[]; // Final, sendable groups
  oversizedChunks: ChunkInfo[]; // Chunks that were too big to be processed
  sendStrategy: 'full_file' | 'single_group' | 'multiple_groups' | 'unprocessed';
  finalTokenCount: number;
  skippedContent: SkippedContent[];
  contextHeader: string;
  tokenBreakdown: TokenBreakdown;
}

export interface SkippedContent
{
  reason: string;
  lines: string;
  tokens: number;
  type: string;
  content: string;
}

export interface TokenBreakdown
{
  originalFile: number;
  // What we actually send to the AI:
  finalSent: number;
  // A breakdown of what makes up 'finalSent':
  codeTokensInGroups: number;
  fileHeaderTokensInGroups: number;
  shellContextTokensInGroups: number;
  separatorTokensInGroups: number;
  // What we saved:
  skippedCodeTokens: number;
  unprocessedOversizedTokens: number;
  totalSavings: number;
  savingsPercentage: number;

  // --- NEW FIELDS FOR DETAILED REPORTING ---
  fileHeaderCount: number;
  fileHeaderAvgSize: number;
  shellContextCount: number;
  shellContextAvgSize: number;
  separatorCount: number; // This will be the number of chunks
  separatorAvgSize: number; // This will be the average overhead per chunk
}

export interface ChunkingConfig
{
  maxTokensPerChunk: number;
  maxTokensPerGroup: number;
  minLinesForSubChunk: number;
  contextItemLimit: number; // Renamed from contextImportLimit for clarity
  boilerplateThreshold: number;
  maxContextTokens: number;
}
export interface Usage {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
}

interface ReviewerNotes {
  reasoning_for_complexity: string;
  reasoning_for_quality: string;
  key_tradeoff_identified: string;
}
export interface ScoredChunkGroup {
    groupId: number;
    score: AIScore;
    totalTokens:number
    usage:Usage
}

export interface AIScore {
    complexity_score: number;        // 1-10: How complex is the problem being solved?
    code_quality_score: number;      // 1-10: Readability, structure, naming.
    maintainability_score: number;   // 1-10: How easy is it to modify or debug?
    best_practices_adherence: number;// 1-10: Follows modern language/framework idioms?
    
    // Qualitative feedback for traceability
    positive_feedback?: string;       // One-sentence summary of a key strength.
    improvement_suggestion?: string;  // The single most impactful improvement.

    // For Intra-File Context Propagation
    group_summary: string;           // A 25-word summary of this group's purpose.
    reviewer_notes?: ReviewerNotes;
}
export interface ScoredFile {
    filePath: string;
    totalOriginalTokens: number;
    finalTokenCount:number
    impactScore: number; // The final weighted score for the file
    averageComplexity: number;
    averageQuality: number;
    usage:Usage;
    retries: number; // NEW: How many times we had to retry scoring for this file.
    hadError: boolean; // NEW: Did this file ultimately fail scoring?
    scoredChunkGroups: ScoredChunkGroup[];
    // We attach the original chunking data for full traceability
    chunkingDetails: FileChunkGroup;
}

export interface ProjectScorecard {
    runId:string
    repoName: string;
    model:string;
    // The preliminary score, calculated before the final review. Useful for debugging.
    preliminaryProjectScore?: number;

    // The final score AFTER the multiplier from the final review has been applied.
    finalProjectScore?: number;

    // finalProjectScore: number; // The primary metric for ranking
    normalizedScore?: number;  // Optional Z-score
    mainDomain: string;
    // This will now hold the *refined* tech stack from the final review.
    techStack: string[];

    projectEssence:string;
    // A breakdown of the overall project profile
    profile: {
        complexity: number;     // Weighted average
        quality: number;        // Weighted average
        maintainability: number; // Weighted average
        best_practices: number;  // Weighted average
    };
    usage:Usage;
    totalRetries: number;
    totalFailedFiles: number;
    // The new field to store the results of the final, holistic review.
    // It's optional ('?') in case this step is ever skipped.
    finalReview: FinalReviewAnalysis;

    // The detailed per-file scores
    scoredFiles: ScoredFile[];
    // Warnings from the analysis phase
    warnings?: {
        fileLimitHit: boolean;
        vendedCodeFlagged: { path: string, reason: string }[];
    }
}

export interface FinalReviewAnalysis {
  model: string;
  dossierBudget: number;
  strategy: string;
  filesSentForFinalEval: string[];
  usage: Usage;
  /** The multiplier (e.g., 0.8 to 1.25) applied to the preliminary score. */
  multiplier: number;
  final_score_multiplier: number;

  /** The AI's justification for applying the multiplier. */
  reasoning: object;
  refined_tech_stack: string[];
  holistic_project_summary: string;
}