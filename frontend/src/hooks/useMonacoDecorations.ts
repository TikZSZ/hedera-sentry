// src/hooks/useMonacoDecorations.ts

import { useRef, useEffect } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';

// Define the shape of the data the hook will receive
export interface ActiveHighlight {
    type: 'red_flag' | 'optimization';
    location: { startLine: number; endLine: number };
    message: string;
}

export function useMonacoDecorations(
    editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>,
    activeHighlight: ActiveHighlight | null // The hook now receives a specific highlight
) {
    const monaco = useMonaco();
    const decorationsRef = useRef<string[]>([]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !monaco) return;

        // If there's no active highlight, clear all decorations
        if (!activeHighlight) {
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
            return;
        }

        const { type, location, message } = activeHighlight;

        // Create a single decoration for the active highlight
        const newDecorations: editor.IModelDeltaDecoration[] = [
            {
                range: new monaco.Range(location.startLine, 1, location.endLine, 1),
                options: {
                    isWholeLine: true,
                    className: type === 'red_flag' ? 'monaco-highlight-red' : 'monaco-highlight-sky',
                    hoverMessage: { value: message }
                }
            }
        ];

        // Apply the new decoration, replacing the old one
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

        // Automatically scroll to the highlighted area
        editor.revealRangeInCenter(
            {
                startLineNumber: location.startLine, startColumn: 1,
                endLineNumber: location.endLine, endColumn: 1,
            },
            monaco.editor.ScrollType.Smooth
        );

    }, [activeHighlight, monaco, editorRef]);
}