// server.ts

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createAIClient } from './ai_client';
import { ALL_MODELS } from './models.config';
import {  runFinalReview, runAnalysisAndScoring } from './main'; // Assuming main analysis logic is in `main.ts`
import { closeTokenizer, initializeTokenizer } from './tokenizer';
import type { PreliminaryProjectScorecard, ProjectScorecard } from './scoring.interfaces';

// --- In-Memory State Management ---
// We'll use a simple Map to store the state of each analysis run.
// For a production app, you would replace this with Redis or a database.
interface LogEntry {
    id: number;
    message: string;
    timestamp: string;
}

interface RunState {
    status: 'preparing' | 'selecting_files' | 'chunking_and_scoring' | 'final_review' | 'complete' | 'error';
    // REMOVED: message: string;
    logHistory: LogEntry[]; // NEW: The source of truth for progress
    repoUrl: string;
    repoName: string;
    runId: string;
    preliminaryScorecard?: ProjectScorecard;
    finalScorecard?: ProjectScorecard;
    error?: string;
}

const analysisStore = new Map<string, RunState>();

// --- NEW: A centralized state updater function ---
function updateRunState(runId: string, status: RunState['status'], message: string) {
    const currentState = analysisStore.get(runId);
    if (currentState) {
        currentState.status = status;
        // Add the new message to the log history.
        currentState.logHistory.push({
            id: currentState.logHistory.length + 1,
            message,
            timestamp: new Date().toLocaleTimeString(),
        });
    }
}

// --- Main Application Setup ---
const app = express();
const PORT = process.env.PORT || 10000;

app.use( cors() ); // Enable CORS for your frontend
app.use( express.json() ); // Enable JSON body parsing

// --- The Core Logic (run in the background, non-blocking) ---
async function startBackgroundAnalysis ( runId: string, repoUrl: string, description: string = "" )
{
    try
    {
        const client = createAIClient( ALL_MODELS[ 'gpt-4o-mini' ] ); // Client for initial steps
        const scoreClient = createAIClient( ALL_MODELS[ 'gemini-2.5-flash' ] ); // Client for final review

        const preliminaryScorecard = await runAnalysisAndScoring( repoUrl, client, description, runId, (status,message)=>{
            updateRunState(runId,status,message)
        } );

        // Update state with the preliminary result
        const currentState = analysisStore.get( runId )!;
        currentState.preliminaryScorecard = preliminaryScorecard as any;

        updateRunState(runId, 'final_review', 'Performing final holistic review...');
        // Step 4: Run the Final Review
        const { calibratedScorecard } = await runFinalReview( repoUrl, scoreClient, runId );

        // Step 5: Finalize the state
        currentState.finalScorecard = calibratedScorecard;
        updateRunState(runId, 'complete', '✅ Analysis complete!');

    } catch ( error: any )
    {
        console.error(`Error during analysis for runId ${runId}:`, error);
        const errorMessage = `❌ Error: ${error.message}`;
        updateRunState(runId, 'error', errorMessage);
        const currentState = analysisStore.get(runId)!;
        currentState.error = error.message;
    }
}


// --- API Endpoints ---

/**
 * POST /analysis
 * Kicks off a new analysis job.
 */
app.post( '/analysis', ( req, res ) =>
{
    const { repoUrl } = req.body;

    if ( !repoUrl || typeof repoUrl !== 'string' )
    {
        return res.status( 400 ).json( { error: 'repoUrl is required' } );
    }

    const runId = new Date().toISOString().replace( /[:.]/g, '-' );
    const repoName = path.basename( repoUrl, '.git' );

    // Create the initial state object and store it.
    const initialMessage = 'Initiating analysis pipeline...';
    const initialState: RunState = {
        runId,
        repoUrl,
        repoName,
        status: 'preparing',
        logHistory: [{ id: 1, message: initialMessage, timestamp: new Date().toLocaleTimeString() }],
    };
    analysisStore.set(runId, initialState);
    
    startBackgroundAnalysis(runId, repoUrl);
    res.status(202).json({ runId });
} );

/**
 * GET /analysis/:runId/status
 * The frontend polls this endpoint to get progress updates and the final result.
 */
app.get( '/analysis/:runId/status', ( req, res ) =>
{
    const { runId } = req.params;

    const state = analysisStore.get(runId);

    if (!state) return res.status(404).json({ error: 'Analysis run not found.' });

    // The endpoint now returns the full log history every time.
    res.status(200).json({
        runId: state.runId,
        status: state.status,
        logHistory: state.logHistory, // Send the whole history
        report: state.status === 'complete' ? state.finalScorecard : null,
        error: state.status === 'error' ? state.error : null,
    });
} );

// --- Server Initialization ---
async function startServer ()
{
    initializeTokenizer(); // Initialize tokenizer once on server start
    // app.use(express.static('public'))
    // app.get(/(.*)/, (req, res) => res.sendFile(path.resolve('public', 'index.html')));
    const server = app.listen( PORT, () =>
    {
        console.log( `Hedera Sentry AI server is running on http://localhost:${PORT}` );
    } );

    process.on( 'SIGTERM', () =>
    {
        server.close( () =>
        {
            console.log( 'HTTP server closed.' );
            closeTokenizer()
            // Perform other cleanup tasks before exiting
            process.exit( 0 ); // Exit the process
        } );
    } );

    process.on( 'SIGINT', () =>
    {
        server.close( () =>
        {
            console.log( 'HTTP server closed.' );
            closeTokenizer()
            // Perform other cleanup tasks before exiting
            process.exit( 0 ); // Exit the process
        } );
    } );
}

startServer();