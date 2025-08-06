// src/utils.ts

import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import Parser, { type Language } from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';

import { APP_CONFIG } from './config.ts';
import type { AIClient, ChatMessage } from './ai_client.ts';
import type {} from "./models.config.ts"
import type { Usage } from './scoring.interfaces.ts';
import readline from 'readline';
const git = simpleGit();

export async function safeJsonChatCompletion<T = object>({
  client,
  messages,
  maxRetries = 3,
  debug = false,
}: {
  client: AIClient;
  messages: ChatMessage[];
  maxRetries?: number;
  debug?: boolean;
}): Promise<{obj:T,usage:Usage} | null> {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await client.chatCompletion(
        {
          messages,
          generationParams:{
            jsonOutput:true
          }
        },
      );

      const raw = res.content ?? '{}';
      if (debug) console.log(`Attempt ${attempt} JSON:`, raw);
      return {obj:JSON.parse(raw),usage:res.usage};
    } catch (err) {
      lastError = err;
      if (debug) console.warn(`Attempt ${attempt} failed:`, err);
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt)); // exponential backoff
    }
  }

  console.error("All retry attempts failed. Last error:", lastError);
  return null;
}

/**
 * Clones a Git repository to a local directory if it doesn't already exist.
 * @param repoUrl The URL of the repository to clone.
 * @param localPath The local path to clone into.
 */
export async function cloneRepo(repoUrl: string, localPath: string): Promise<void> {
    if (!fs.existsSync(localPath)) {
        console.log(`Cloning ${repoUrl} into ${localPath}...`);
        await git.clone(repoUrl, localPath);
        console.log('Cloning complete.');
    } else {
        console.log(`Repository already exists at ${localPath}. Skipping clone.`);
    }
}

/**
 * Recursively walks a directory and returns a list of all files.
 * @param dir The directory to start from.
 * @param rootDir The original root directory for calculating relative paths.
 * @returns An array of file objects with absolute and relative paths.
 */
export function walkFileTree(dir: string, rootDir: string = dir): { relative: string, absolute: string }[] {
    let files: { relative: string, absolute: string }[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Ignore common non-code directories
            if (['.git', 'node_modules', 'dist', 'build'].includes(entry.name)) {
                continue;
            }
            files = files.concat(walkFileTree(fullPath, rootDir));
        } else {
            files.push({ relative: path.relative(rootDir, fullPath), absolute: fullPath });
        }
    }
    return files;
}

/**
 * Gets a tree-sitter parser for a given file extension.
 * @param fileExtension The file extension (e.g., '.ts', '.py').
 * @returns A configured Parser instance or null if the language is unsupported.
 */
export function getParser(fileExtension: string): Parser | null {
    const parser = new Parser();
    switch (fileExtension) {
        case '.ts':
            parser.setLanguage((TypeScript.typescript) as Language);
            return parser;
        case '.tsx':
            parser.setLanguage((TypeScript.tsx) as Language);
            return parser;
        case '.js':
        case '.jsx':
            parser.setLanguage((JavaScript) as Language);
            return parser;
        // case '.sol':
        //     parser.setLanguage((Solidity) as Language);
        //     return parser;
        // Future-proof: Add other languages here
        // case '.py':
        //     parser.setLanguage(Python);
        //     return parser;
        default:
            return null;
    }
}

/**
 * Saves a JSON report to the configured reports directory.
 * @param repoName The name of the repository, used for the subdirectory.
 * @param runId The runId used for grouping different files.
 * @param reportType The type of report (e.g., 'chunking-analysis', 'scoring-report').
 * @param data The JSON-serializable data to save.
 */
export function saveReport(
  repoName: string,
  runId: string,
  reportType: string, // e.g., 'chunking-analysis' or 'final-reviews/review-1'
  data: any
): void {
  const filename = `${path.basename(reportType)}.json`;
  const reportSubDir = path.dirname(reportType); // e.g., 'final-reviews'
  
  const dir = path.join(APP_CONFIG.REPORTS_DIR, repoName, `run-${runId}`, reportSubDir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\n✅ Report saved to ${filePath}`);
}

export const CANONICAL_TAG_MAP: Record<string, string> = {
    // Languages
    'typescript': 'TypeScript',
    'ts': 'TypeScript',
    'javascript': 'JavaScript',
    'js': 'JavaScript',
    'es6': 'JavaScript',
    'python': 'Python',
    'python3': 'Python',

    // Frontend Frameworks & Libraries
    'react': 'React',
    'react.js': 'React',
    'reactjs': 'React',
    'next.js': 'Next.js',
    'nextjs': 'Next.js',
    'vue': 'Vue.js',
    'vue.js': 'Vue.js',

    // Backend Frameworks
    'node': 'Node.js',
    'node.js': 'Node.js',
    'express': 'Express.js',
    'express.js': 'Express.js',
    'nestjs': 'NestJS',
    'nest.js': 'NestJS',
    'django': 'Django',
    'flask': 'Flask',

    // Databases
    'postgres': 'PostgreSQL',
    'postgresql': 'PostgreSQL',
    'mongo': 'MongoDB',
    'mongodb': 'MongoDB',

    // Cloud & DevOps
    'appwrite': 'Appwrite',
    'aws': 'AWS',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'k8s': 'Kubernetes',

    // Domains
    'web application': 'Web Application',
    'webapp': 'Web Application',
    'web app': 'Web Application',
    'frontend': 'Web Application',
    'backend api': 'Backend API',
    'api': 'Backend API',
    'backend': 'Backend API',
    'cli tool': 'CLI Tool',
    'command-line tool': 'CLI Tool',
};

/**
 * Normalizes a single technology or domain name to its canonical form.
 * @param name The fuzzy name generated by the AI (e.g., "reactjs").
 * @returns The canonical name (e.g., "React"), or the original name if no mapping is found.
 */
export function normalizeTechName(name: string): string {
    if (!name) return '';
    // Clean the name for lookup: lowercase and trim whitespace.
    const cleanedName = name.trim().toLowerCase();
    
    // Return the canonical name if found, otherwise return the original trimmed name.
    return CANONICAL_TAG_MAP[cleanedName] || name.trim();
}

/**
 * Normalizes an array of technology/domain names and removes duplicates.
 * @param stack An array of fuzzy names from the AI.
 * @returns A de-duplicated array of canonical names.
 */
export function normalizeTechStack(stack: string[]): string[] {
    if (!stack || !Array.isArray(stack)) return [];

    const normalizedStack = stack.map(tech => normalizeTechName(tech));
    
    // Use a Set to automatically handle duplicates, then convert back to an array.
    return [...new Set(normalizedStack)];
}

export async function promptUser ( query: string ): Promise<string>
{
  const rl = readline.createInterface( {
    input: process.stdin,
    output: process.stdout,
  } );

  return new Promise( resolve =>
  {
    rl.question( query, answer =>
    {
      rl.close();
      resolve( answer.trim() );
    } );
  } );
}