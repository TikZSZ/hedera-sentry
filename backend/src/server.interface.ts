import type { PreliminaryProjectScorecard, ProjectContext, ProjectScorecard } from "./scoring.interfaces";

interface LogEntry {
    id: number;
    message: string;
    timestamp: string;
}
export type Status = 'preparing' | 'selecting_files' | 'chunking_and_scoring' | 'final_review' | 'complete' | 'error';
export type updateState = ( status: Status, message: string ) => void
export interface RunState {
    status: Status
    projectContext?:ProjectContext
    // REMOVED: message: string;
    logHistory: LogEntry[]; // NEW: The source of truth for progress
    repoUrl: string;
    repoName: string;
    runId: string;
    scoreCardPath?:string
    // preliminaryScorecard?: PreliminaryProjectScorecard;
    finalScorecard?: ProjectScorecard;
    error?: string;
}

