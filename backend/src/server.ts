// server.ts

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createAIClient } from './ai_client';
import { ALL_MODELS } from './models.config';
import { runFinalReview, runAnalysisAndScoring, scoreSingleFile } from './main'; // Assuming main analysis logic is in `main.ts`
import { closeTokenizer, initializeTokenizer } from './tokenizer';
import type { RunState, Status, updateState } from './server.interface';
import { APP_CONFIG } from './config';
import { cloneRepo, walkFileTree } from './utils';
import { getRepoMetadata, type RepoMetadata } from './repo.metadata';
import fs from "fs"
// --- In-Memory State Management ---
// We'll use a simple Map to store the state of each analysis run.
// For a production app, you would replace this with Redis or a database.

const analysisStore = new Map<string, RunState>();
// NEW: A global cache for repository metadata (file lists, effective root, etc.)

const client = createAIClient(ALL_MODELS[process.env.SCORE_MODEL || "gpt-4o-mini"]);
const scoreClient = createAIClient(ALL_MODELS[process.env.FINAL_REVIEW_MODEL || "gemini-2.5-flash"]);

function updateRunState ( runId: string, status: RunState[ 'status' ], message: string )
{
    const currentState = analysisStore.get( runId );
    if ( currentState )
    {
        currentState.status = status;
        // Add the new message to the log history.
        currentState.logHistory.push( {
            id: currentState.logHistory.length + 1,
            message,
            timestamp: new Date().toLocaleTimeString(),
        } );
    }
}

// --- Main Application Setup ---
const app = express();
const PORT = process.env.PORT || 10000;

app.use( cors() ); // Enable CORS for your frontend
app.use( express.json() ); // Enable JSON body parsing

// --- The Core Logic (run in the background, non-blocking) ---
async function startBackgroundAnalysis ( runId: string, repoUrl: string, description: string = "", updateState: updateState, cache: boolean = false )
{
    try
    {
        const currentState = analysisStore.get( runId )!;
        try
        {
            if ( cache )
            {
                const repoName = path.basename( repoUrl, '.git' );
                const reportPath = path.join( APP_CONFIG.REPORTS_DIR, repoName, `run-${runId}`, 'final-reviews2' );
                // Read the directory
                const files = fs.readdirSync( reportPath )
                    .map( file =>
                    {
                        const filePath = path.join( reportPath, file );
                        const stat = fs.statSync( filePath );
                        return {
                            file,
                            mtime: stat.mtime,
                            isFile: stat.isFile()
                        };
                    } )
                    .filter( f => f.isFile ) // Ensure only files, not subdirectories
                    .sort( ( a, b ) => b.mtime.getTime() - a.mtime.getTime() ); // Sort descending by modified time
                    
                if ( files.length === 0 )
                {
                    throw new Error( 'No Report Cache Found' )
                } else
                {   
                    updateState( 'preparing', '✅ Cache Found' );
                    const mostRecentFile = files[ 0 ].file;
                    const mostRecentFilePath = path.join( reportPath, mostRecentFile );

                    // Read file content (assuming it's a text file, adjust for JSON or others)
                    const content = fs.readFileSync( mostRecentFilePath, 'utf8' );
                    console.log( `Most recent file: ${mostRecentFile}` );
                    currentState.finalScorecard = JSON.parse( content )
                    // currentState.preliminaryScorecard = currentState.finalScorecard
                    updateState( 'complete', '✅ Analysis complete!' );
                    currentState.scoreCardPath = mostRecentFilePath
                    currentState.projectContext = {
                        domain: currentState.finalScorecard.mainDomain,
                        projectEssence: currentState.finalScorecard.projectEssence,
                        stack: currentState.finalScorecard.techStack
                    }
                    return
                }
            }
        } catch ( err )
        {


        }

        const preliminaryScorecard = await runAnalysisAndScoring( repoUrl, client, description, runId, updateState );

        // Update state with the preliminary result
        // currentState.preliminaryScorecard = preliminaryScorecard;
        currentState.projectContext = {
            domain: preliminaryScorecard.mainDomain,
            projectEssence: preliminaryScorecard.projectEssence,
            stack: preliminaryScorecard.techStack
        }

        updateState( 'final_review', 'Performing final holistic review...' )
        // Step 4: Run the Final Review
        const { calibratedScorecard, calibratedScorecardPath } = await runFinalReview( repoUrl, scoreClient, runId );
        currentState.scoreCardPath = calibratedScorecardPath
        // Step 5: Finalize the state
        currentState.finalScorecard = calibratedScorecard;
        updateState( 'complete', '✅ Analysis complete!' );

    } catch ( error: any )
    {
        console.error( `Error during analysis for runId ${runId}:`, error );
        const errorMessage = `❌ Error: ${error.message}`;
        updateRunState( runId, 'error', errorMessage );
        const currentState = analysisStore.get( runId )!;
        currentState.error = error.message;
    }
}


// --- API Endpoints ---
const CODE_EXTENSIONS = new Set( [
    '.ts', '.tsx',
    '.js', '.jsx',
    '.json', '.md',
    '.html', '.css', '.scss',
    '.yml', '.yaml',
    '.c', '.cpp', '.h', '.hpp',
    '.py', '.java', '.rs', '.go', '.sol'
] );
const isNotHidden = ( file: { relative: string } ) =>
    !file.relative.split( path.sep ).some( part => part.startsWith( '.' ) );
/**
 * POST /analysis
 * Kicks off a new analysis job.
 */
app.post( '/analysis', async ( req, res ) =>
{
    try
    {
        let { repoUrl, runId } = req.body;

        if ( !repoUrl || typeof repoUrl !== 'string' )
        {
            return res.status( 400 ).json( { error: 'repoUrl is required' } );
        }
        const updateState = ( status: Status, message: string ) =>
        {
            updateRunState( runId, status, message )
        }

        // 1. Get or create the repository metadata. This handles the cloning.
        const { allFiles, repoName } = await getRepoMetadata( repoUrl, updateState );
        // Create the initial state object and store it.
        const initialMessage = 'Initiating analysis pipeline...';
        const initialState: RunState = {
            runId,
            repoUrl,
            repoName,
            status: 'preparing',
            logHistory: [ { id: 1, message: initialMessage, timestamp: new Date().toLocaleTimeString() } ],
        };

        analysisStore.set( runId, initialState );
        startBackgroundAnalysis( runId, repoUrl, '', updateState, true );

        // const filteredFiles = allFiles
        //     .filter( file => 
        //         CODE_EXTENSIONS.has( path.extname( file.relative ).toLowerCase() ) && isNotHidden(file)
        //     )

        res.status( 202 ).json( { runId, allFiles: allFiles.map( f => f.relative ) } );
    } catch ( err: any )
    {
        res.status( 500 ).json( { error: `Failed to prepare repository: ${err.message}` } );
    }
} );

/**
 * GET /analysis/:runId/status
 * The frontend polls this endpoint to get progress updates and the final result.
 */
app.get( '/analysis/:runId/status', ( req, res ) =>
{
    const { runId } = req.params;

    const state = analysisStore.get( runId );

    if ( !state ) return res.status( 404 ).json( { error: 'Analysis run not found.' } );

    // Get the metadata from the cache using the repoUrl stored in the state.
    // const metadata = repoMetadataCache.get( state.repoUrl );

    // The endpoint now returns the full log history every time.
    res.status( 200 ).json( {
        runId: state.runId,
        status: state.status,
        logHistory: state.logHistory, // Send the whole history
        // The file list now comes from the separate metadata cache.
        report: state.status === 'complete' ? state.finalScorecard : null,
        error: state.status === 'error' ? state.error : null,
    } );
} );

// --- NEW ENDPOINT: POST /analysis/:runId/score-file ---
app.post( '/analysis/:runId/score-file', async ( req, res ) =>
{
    const { runId } = req.params;
    const { filePath } = req.body; // The relative path of the file to score

    const state = analysisStore.get( runId );
    if ( !state )
    {
        return res.status( 404 ).json( { error: 'Analysis run not found.' } );
    }
    if ( !filePath )
    {
        return res.status( 400 ).json( { error: 'filePath is required.' } );
    }

    const metadata = await getRepoMetadata( state.repoUrl );
    if ( !metadata )
    {
        console.log( state.repoUrl, state.repoName, state.runId, metadata )
        return res.status( 404 ).json( { error: 'Repository metadata not found. The analysis may have failed to start.' } );
    }
    // Find the full file object from our stored list
    const fileToScore = metadata.allFiles.find( f => f.relative === filePath );
    if ( !fileToScore )
    {
        return res.status( 404 ).json( { error: `File not found in repository: ${filePath}` } );
    }

    // Check if it's already scored to avoid re-work
    if ( state.finalScorecard?.scoredFiles.some( sf => sf.filePath.endsWith( filePath ) ) )
    {
        const existingScore = state.finalScorecard.scoredFiles.find( sf => sf.filePath.endsWith( filePath ) );
        return res.status( 200 ).json( existingScore );
    }

    try
    {
        // Delegate to a new, dedicated function in main.ts
        const scoredFile = await scoreSingleFile( state, client, fileToScore );

        // Add the new score to the main scorecard in our state
        state.finalScorecard?.scoredFiles.push( scoredFile );
        state.finalScorecard?.scoredFiles.sort( ( a, b ) => b.impactScore - a.impactScore );
        fs.writeFile( state.scoreCardPath, JSON.stringify( state.finalScorecard ), () => { } )
        res.status( 200 ).json( scoredFile );
    } catch ( error: any )
    {
        res.status( 500 ).json( { error: `Failed to score file: ${error.message}` } );
    }
} );

app.get( '/analysis/:runId/file-content', ( req, res ) =>
{
    const { runId } = req.params;
    const { filePath } = req.query;
    console.log( { runId, filePath } )
    // --- 1. Input Validation ---
    if ( !filePath || typeof filePath !== 'string' )
    {
        return res.status( 400 ).json( { error: 'Query parameter "filePath" is required.' } );
    }

    const state = analysisStore.get( runId );
    if ( !state )
    {
        return res.status( 404 ).json( { error: 'Analysis run not found.' } );
    }

    const repoName = state.repoName;
    const repoCachePath = path.join( APP_CONFIG.LOCAL_REPO_DIR, repoName );
    // --- 2. Security Check: Prevent Directory Traversal ---
    // We resolve the requested file path against the repository's specific cache directory.
    const absoluteFilePath = path.resolve( repoCachePath, filePath );
    console.log( { absoluteFilePath } )

    // This is the critical security check. We ensure that the resolved absolute path
    // is still located *inside* the intended repository cache directory.
    // if (!absoluteFilePath.endsWith(repoCachePath)) {
    //     return res.status(403).json({ error: 'Forbidden: Access to this path is not allowed.' });
    // }

    // --- 3. File Reading and Response ---
    try
    {
        if ( fs.existsSync( absoluteFilePath ) )
        {
            const content = fs.readFileSync( absoluteFilePath, 'utf-8' );
            // Send the content as plain text. The frontend will handle syntax highlighting.
            res.setHeader( 'Content-Type', 'text/plain' );
            res.status( 200 ).send( content );
        } else
        {
            res.status( 404 ).json( { error: `File not found in repository: ${filePath}` } );
        }
    } catch ( error: any )
    {
        console.error( `Error reading file ${filePath} for runId ${runId}:`, error );
        res.status( 500 ).json( { error: 'Failed to read file content.' } );
    }
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