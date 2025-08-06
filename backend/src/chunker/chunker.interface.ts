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