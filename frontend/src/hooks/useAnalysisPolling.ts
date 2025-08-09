// src/hooks/useAnalysisPolling.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectScorecard, ScoredFile } from '@/types'; // Assuming your type definitions are in @/types
import { DUMMY_PROJECT_SCORECARD } from '@/lib/dummy-data';

// Configuration: API base URL and polling interval
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';
const POLLING_INTERVAL_MS = 2000; // Poll every 2 seconds for a responsive feel

// --- Type Definitions ---

// Defines the structure for a single log entry, matching the backend's `RunState`
export interface LogEntry {
    id: number;
    message: string;
    timestamp: string;
}

// Defines the shape of the state object that this hook manages and returns
export interface AnalysisState {
    /** True if the analysis is currently running (from start until completion or error). */
    isLoading: boolean;
    /** The complete history of status messages from the backend. */
    logHistory: LogEntry[];
    /** A string containing the error message if the analysis failed. */
    error: string | null;
    /** The final ProjectScorecard object, available only on completion. */
    report: ProjectScorecard | null;
    allFiles: string[] | null; // NEW: The full list of relative file paths
    /** The unique ID for the current analysis run. */
    runId: string | null;
    isScoringFile?:boolean
}

/**
 * A custom React hook to manage the state and logic for initiating and polling
 * a long-running code analysis job on the backend.
 *
 * @param repoUrl The GitHub repository URL to be analyzed.
 * @returns An object containing the current analysis state (`isLoading`, `logHistory`, `error`, `report`)
 *          and a `startAnalysis` function to begin the process.
 */
export function useAnalysisPolling(repoUrl: string | null,runId:string) {
    const [state, setState] = useState<AnalysisState>({
        isLoading: false,
        logHistory: [],
        error: null,
        report: null,
        runId: null,
        allFiles: null
    });

    const [scoringFileError,setScoringFileError] = useState()

    // useRef is used to store the interval ID so it can be cleared across re-renders
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // This cleanup effect ensures that if the component unmounts (e.g., user navigates away)
    // while an analysis is in progress, the polling interval is stopped to prevent memory leaks.
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []); // The empty dependency array ensures this effect runs only on mount and unmount.


    /**
     * A memoized function to kick off the analysis pipeline.
     * It makes the initial POST request to the backend and then starts the polling process.
     */
    const startAnalysis = useCallback(async () => {
        // mock the data 
        // setState({report:DUMMY_PROJECT_SCORECARD,error:null,isLoading:false,logHistory:[],runId:'',allFiles:['23']}) 
        // return 
        // Guard clause: do nothing if there's no repo URL
        if (!repoUrl) return;

        // Clean up any existing polling interval before starting a new one
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Set the initial "loading" state for the UI
        setState({
            isLoading: true,
            logHistory: [{ id: 1, message: 'Requesting analysis from server...', timestamp: new Date().toLocaleTimeString() }],
            error: null,
            report: null,
            runId: null,
            allFiles:null
        });

        try {
            
            // --- Step 1: Start the analysis job and get a runId ---
            const startResponse = await fetch(`${API_BASE_URL}/analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    repoUrl,
                    runId
                }),
            });

            if (!startResponse.ok) {
                const errorData = await startResponse.json().catch(() => ({ error: 'Server returned a non-JSON error response.' }));
                throw new Error(errorData.error || `Failed to start analysis job (status ${startResponse.status}).`);
            }

            let {  allFiles } = await startResponse.json();
            if (!allFiles) {
                throw new Error("Server did not return a valid runId.");
            }
            
            setState(prevState => ({ ...prevState, runId,allFiles }));

            // --- Step 2: Begin polling for status updates ---
            intervalRef.current = setInterval(async () => {
                try {
                    const statusResponse = await fetch(`${API_BASE_URL}/analysis/${runId}/status`);
                    
                    if (!statusResponse.ok) {
                        const errorData = await statusResponse.json().catch(() => ({ error: 'Failed to parse status error response.' }));
                        throw new Error(errorData.error || `Failed to get analysis status (status ${statusResponse.status}).`);
                    }
                    
                    const statusData = await statusResponse.json();
                    
                    // The backend is the source of truth. We just update our state to match.
                    setState(prevState => ({
                        ...prevState,
                        logHistory: statusData.logHistory || prevState.logHistory,
                    }));

                    // --- Handle Terminal States ---
                    if (statusData.status === 'complete' || statusData.status === 'error') {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        
                        setState(prevState => ({
                            ...prevState,
                            isLoading: false,
                            report: statusData.report, // This will be null on error, which is correct
                            error: statusData.error,   // This will be null on success, which is correct
                        }));
                    }
                } catch (pollError: any) {
                    // This catches network errors during polling or if the status endpoint fails badly
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setState(prevState => ({ 
                        ...prevState, 
                        isLoading: false, 
                        error: pollError.message || 'Polling failed due to a server or network error.',
                    }));
                }
            }, POLLING_INTERVAL_MS);

        } catch (startError: any) {
            // This catches errors from the very first POST /analysis call
            setState({
                isLoading: false,
                logHistory: [{ id: 1, message: `❌ Failed to start analysis: ${startError.message}`, timestamp: new Date().toLocaleTimeString() }],
                error: startError.message,
                report: null,
                runId: null,
                allFiles:null
            });
        }
    }, [repoUrl]); // The `startAnalysis` function is stable unless the `repoUrl` prop changes.

    // Return the complete state object and the function to trigger the analysis.
    /**
     * NEW: A function to score a single file on demand.
     * @param filePath The relative path of the file to score.
     */
    const scoreFile = useCallback(async (filePath: string) => {
        if (!state.runId) {
            console.error("Cannot score file: no active runId.");
            return;
        }

        // Check if the file is already in the report to prevent duplicate calls
        if (state.report?.scoredFiles.some(sf => sf.filePath.endsWith(filePath))) {
            console.log("File already scored:", filePath);
            return;
        }

        setState(prevState => ({ ...prevState, isScoringFile: true }));
        try {
            const response = await fetch(`${API_BASE_URL}/analysis/${state.runId}/score-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to score file.');
            }

            const newScoredFile: ScoredFile = await response.json();
            
            // --- CRITICAL: Update the local report state ---
            // This will cause the UI to reactively display the new file's score.
            setState(prevState => {
                if (!prevState.report) return prevState; // Should not happen
                return {
                    ...prevState,
                    isScoringFile: false,
                    report: {
                        ...prevState.report,
                        scoredFiles: [...prevState.report.scoredFiles, newScoredFile]
                            // Optional: sort by impact score again
                            .sort((a, b) => b.impactScore - a.impactScore),
                    },
                };
            });
            return newScoredFile
        } catch (err: any) {
            console.error("On-demand scoring failed:", err);
            // You could show a toast notification here
            setState(prevState => ({ ...prevState, isScoringFile: false }));
            setScoringFileError(err.message)
            return err.message as string
        }
    }, [state.runId, state.report]);

    return { ...state, startAnalysis,scoreFile,scoringFileError };
}