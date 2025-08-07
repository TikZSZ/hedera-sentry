// src/config.ts
import path from "path"
import type { ChunkingConfig } from './chunker/chunker.interface'; // We'll define this in chunker.ts
/**
 * Global application configuration
 */
export const APP_CONFIG = {
  REPORTS_DIR: path.join("reports","analysis_reports_scorer_hedera_sol"),
  CACHE_DIR: './.cache', // For caching AI file selections
  LOCAL_REPO_DIR: 'repo_cache',
  FORCE_SIMPLE_STRATEGY: process.env.FORCE_SIMPLE_STRATEGY === 'true' || true,
};

export type DossierStrategy = 'global_top_impact' | 'top_impact_per_file';

/**
 * Configuration for the UniversalChunker.
 * Tune these values to affect how code is split.
 */
export const CHUNKER_CONFIG: ChunkingConfig = {
  maxTokensPerChunk: 800,
  maxTokensPerGroup: 2500, // Increased for better context
  minLinesForSubChunk: 20, // Deprecated but kept for reference
  contextItemLimit: 15,
  boilerplateThreshold: 0.6,
  maxContextTokens: 200,
  
};
export const MAX_TOKENS_PER_FILE_ALLOWED_LIMIT = 8000
export const MAX_BATCH_BUDGET = 5100

export const DOSSIER_BUDGET = 16000
/**
 * Configuration for AI model interactions.
 */
export const AI_CONFIG = {
  // Model for selecting relevant files
  FILE_SELECTION_MODEL: 'gpt-4o-mini',

  // Model for scoring code chunks
  SCORING_MODEL: 'gpt-4o-mini',

  TIMEOUT_MS: 45_000,

  MAX_RETRIES: 3
};
