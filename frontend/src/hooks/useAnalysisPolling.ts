// src/hooks/useAnalysisPolling.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectScorecard } from '@/types'; // Make sure you have this type defined

// It's good practice to have the API base URL in a central place or .env file
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

// Define the structure for a single log entry
interface LogEntry {
    id: number;
    message: string;
    timestamp: string;
}

// Define the shape of the state our hook will manage
interface AnalysisState {
    isLoading: boolean;
    logHistory: LogEntry[];
    error: string | null;
    report: ProjectScorecard | null;
}
const POLLING_INTERVAL = 100
/**
 * A custom React hook to manage the state and logic for polling a long-running analysis job.
 * @param repoUrl The GitHub repository URL to be analyzed.
 * @returns The current analysis state and a function to start the process.
 */
export function useAnalysisPolling(repoUrl: string | null) {
    const [state, setState] = useState<AnalysisState>({
        isLoading: false,
        logHistory: [],
        error: null,
        report: null,
    });

    // useRef is perfect for storing mutable values that don't trigger re-renders,
    // like interval IDs and the last seen message.
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastMessageRef = useRef<string>('');

    // --- Cleanup Function ---
    // This useEffect hook ensures that if the component unmounts mid-poll,
    // we clear the interval to prevent memory leaks and unnecessary API calls.
    useEffect(() => {
        // The return function from useEffect is the cleanup function.
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []); // Empty dependency array means this runs only once on mount and cleanup on unmount.

    
    const startAnalysis = useCallback(async () => {
        if (!repoUrl) return;

        // Clear any previous interval if start is called again
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // --- Initial State Setup ---
        const initialMessage = 'Initiating analysis pipeline...';
        setState({
            isLoading: true,
            logHistory: [{ id: 1, message: initialMessage, timestamp: new Date().toLocaleTimeString() }],
            error: null,
            report: null,
        });
        lastMessageRef.current = initialMessage;

        try {
            // --- Step 1: Start the analysis job ---
            const startResponse = await fetch(`${API_BASE_URL}/analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl }),
            });

            if (!startResponse.ok) {
                const errorData = await startResponse.json();
                throw new Error(errorData.error || 'Failed to start analysis job.');
            }

            const { runId } = await startResponse.json();
            if (!runId) {
                throw new Error("API did not return a valid runId.");
            }

            // --- Step 2: Begin polling for status updates ---
            intervalRef.current = setInterval(async () => {
                try {
                    const statusResponse = await fetch(`${API_BASE_URL}/analysis/${runId}/status`);
                    
                    if (!statusResponse.ok) {
                        // If the status endpoint itself fails, we stop polling and show an error.
                        const errorData = await statusResponse.json();
                        throw new Error(errorData.error || 'Failed to get analysis status.');
                    }
                    
                    const statusData = await statusResponse.json();
                    
                    // Add new, unique messages to the log history
                    if (statusData.message && statusData.message !== lastMessageRef.current) {
                        setState(prevState => ({
                            ...prevState,
                            logHistory: [
                                ...prevState.logHistory,
                                {
                                    id: prevState.logHistory.length + 1,
                                    message: statusData.message,
                                    timestamp: new Date().toLocaleTimeString()
                                }
                            ]
                        }));
                        lastMessageRef.current = statusData.message;
                    }

                    // --- Handle Terminal States ---
                    if (statusData.status === 'complete') {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        setState(prevState => ({
                            ...prevState,
                            isLoading: false,
                            report: statusData.report,
                            logHistory: [...prevState.logHistory, { id: prevState.logHistory.length + 1, message: '✅ Analysis complete!', timestamp: new Date().toLocaleTimeString() }]
                        }));
                    } else if (statusData.status === 'error') {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        const errorMessage = statusData.error || 'An unknown error occurred during analysis.';
                        setState(prevState => ({
                            ...prevState,
                            isLoading: false,
                            error: errorMessage,
                            logHistory: [...prevState.logHistory, { id: prevState.logHistory.length + 1, message: `❌ Error: ${errorMessage}`, timestamp: new Date().toLocaleTimeString() }]
                        }));
                    }
                } catch (pollError: any) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setState(prevState => ({ 
                        ...prevState, 
                        isLoading: false, 
                        error: pollError.message || 'Polling failed due to a network or server error.',
                        logHistory: [...prevState.logHistory, { id: prevState.logHistory.length + 1, message: `❌ Polling failed.`, timestamp: new Date().toLocaleTimeString() }]
                    }));
                }
            }, POLLING_INTERVAL); // Poll every 3 seconds

        } catch (startError: any) {
            // Handle errors from the initial POST /analysis call
            setState({
                isLoading: false,
                error: startError.message,
                report: null,
                logHistory: [{ id: 1, message: `❌ Failed to start analysis: ${startError.message}`, timestamp: new Date().toLocaleTimeString() }]
            });
        }
    }, [repoUrl]); // The function is re-created only if repoUrl changes.

    // Return the state and the function to trigger the analysis.
    return { ...state, startAnalysis };
}