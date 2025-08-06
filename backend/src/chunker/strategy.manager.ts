// src/strategies/strategy_manager.ts

import { DeclarativeFileStrategy } from './strategies/declarative.file.strategy';
import type { LanguageStrategy } from './strategies/language.strategy';
import { TypeScriptStrategy, type TypeScriptDialect } from './strategies/typescript.strategy';
import { SolidityStrategy } from './strategies/solidity.strategy'; // Assuming this exists
import path from "path";
import { APP_CONFIG } from '../config'; // Import the new config

const strategyCache = new Map<string, LanguageStrategy>();
const CONFIG_FILE_PATTERNS: Map<RegExp, string> = new Map([ /* ... your patterns ... */ ]);

export function getStrategyForExtension(filePath: string): LanguageStrategy | null {
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath) || fileName;

    if (APP_CONFIG.FORCE_SIMPLE_STRATEGY) {
        if (strategyCache.has(fileExtension)) {
            return strategyCache.get(fileExtension)!;
        }
        const strategy = new DeclarativeFileStrategy(fileExtension);
        strategyCache.set(fileExtension, strategy);
        return strategy;
    }

    // --- If not a special file, fall back to extension-based strategies ---
    if (strategyCache.has(fileExtension)) {
        return strategyCache.get(fileExtension)!;
    }

    let strategy: LanguageStrategy | null = null;

    switch (fileExtension) {
        case '.ts':
            strategy = new TypeScriptStrategy('typescript');
            break;
        case '.tsx':
            strategy = new TypeScriptStrategy('tsx');
            break;
        case '.js':
            strategy = new TypeScriptStrategy('javascript');
            break;
        case '.jsx':
            strategy = new TypeScriptStrategy('jsx');
            break;
        case '.sol':
            strategy = new SolidityStrategy();
            break;
        default:
            strategy = new DeclarativeFileStrategy(fileExtension);
    }

    if (strategy) {
        strategyCache.set(fileExtension, strategy);
    }

    return strategy; // Will return null for unsupported files if default is removed
}