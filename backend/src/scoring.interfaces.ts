// src/scoring.interfaces.ts

import { type FileChunkGroup } from './chunker/chunker.interface'; // Import from our chunker module

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
/**
 * The structured JSON output we expect from the AI for each code group it scores.
 */
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

/**
 * An object that holds the score for a single ChunkGroup.
 */
export interface ScoredChunkGroup {
    groupId: number;
    score: AIScore;
    totalTokens:number
    usage:Usage
}

/**
 * An object representing a fully scored file, containing its calculated Impact Score.
 */
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

export type PreliminaryProjectScorecard = Omit<ProjectScorecard,'finalReview'>

/**
 * The final, aggregated scorecard for the entire project.
 */
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
    warnings: {
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
  reasoning: Reasoning;
  refined_tech_stack: string[];
  holistic_project_summary: string;
  
  claim_validation: Claimvalidation;
  // An array of 3-5 bullet points
  key_takeaways: string[];
  refined_main_domain: string;
  /** The final, high-level summary of the project. */
  groupsInDossier: number;
  dossierCode: string;
}
interface Claimvalidation {
  rating: string;
  justification: string;
}

interface Reasoning {
  multiplier_justification: string;
  preliminary_score_critique: string;
  context_sufficiency_assessment: string;
}


/**
 * The final, top-level report for a single candidate, aggregating all their projects.
 */
export interface CandidateScorecard {
    candidateId: string; // e.g., GitHub username or email

    model:string;
    usage:Usage;
    /** The final, aggregated score for the candidate, weighted by project quality. */
    overallScore: number;
    consolidatedTechStack: any;
    /** An AI-generated, high-level executive summary of the candidate's profile. */
    executiveSummary: string;

    /** A list of key strengths observed across all projects. */
    demonstratedStrengths: string[];

    /** A list of potential areas for growth or recurring patterns. */
    areasForDevelopment: string[];

    /** A list of all the individual project scorecards for drill-down. */
    projectAnalyses: ProjectScorecard[];
}

export interface JobFitAnalysisResult {
    candidateId: string; // e.g., GitHub username or email

    /** A score from 1-10 indicating how well the candidate's profile matches the job requirements. */
    matchScore: number;
    model:string;
    usage:Usage;
    /** A high-level summary explaining the match score. */
    summary: string;

    /** Specific strengths the candidate has that are highly relevant to the job. */
    alignedStrengths: string[];
    
    /** Key skills or experiences required by the job that were not observed in the candidate's projects. */
    potentialGaps: string[];
}