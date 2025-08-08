// src/hooks/useMonacoDecorations.ts

import { useRef, useEffect } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import type { ScoredFile } from '@/types';

export function useMonacoDecorations(
    editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>,
    file: ScoredFile | null,
    hoveredGroupId: number | null
) {
    const monaco = useMonaco();
    const decorationsRef = useRef<string[]>([]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !monaco || !file) return;

        // Function to create decorations for a single group
        const createDecorationsForGroup = (groupId: number): editor.IModelDeltaDecoration[] => {
            const group = file.scoredChunkGroups.find(g => g.groupId === groupId);
            if (!group) return [];
            
            const decorations: editor.IModelDeltaDecoration[] = [];
            const { hedera_red_flag, hedera_optimization_suggestion } = group.score;

            if (hedera_red_flag?.start_line && hedera_red_flag?.end_line) {
                decorations.push({
                    range: new monaco.Range(hedera_red_flag.start_line, 1, hedera_red_flag.end_line, 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-highlight-red',
                        hoverMessage: { value: `**Red Flag:** ${hedera_red_flag.description}` }
                    }
                });
            }

            if (hedera_optimization_suggestion?.start_line && hedera_optimization_suggestion?.end_line) {
                 decorations.push({
                    range: new monaco.Range(hedera_optimization_suggestion.start_line, 1, hedera_optimization_suggestion.end_line, 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-highlight-sky',
                        hoverMessage: { value: `**Optimization:** ${hedera_optimization_suggestion.description}` }
                    }
                });
            }
            return decorations;
        };

        // --- Main Effect Logic ---
        let newDecorations: editor.IModelDeltaDecoration[] = [];

        if (hoveredGroupId) {
            // If a specific group is hovered, highlight it and scroll to it
            const groupData = file.chunkingDetails.groupedChunks.find(g => g.groupId === hoveredGroupId);
            if (groupData) {
                const startLine = groupData.startLine;
                const endLine = groupData.endLine;

                // Add a subtle highlight for the whole hovered chunk
                newDecorations.push({
                    range: new monaco.Range(startLine, 1, endLine, 1),
                    options: { isWholeLine: true, className: 'monaco-line-highlight-subtle' }
                });

                // Add the specific feedback highlights for this chunk
                newDecorations.push(...createDecorationsForGroup(hoveredGroupId));

                editor.revealRangeInCenter({
                    startLineNumber: startLine, startColumn: 1,
                    endLineNumber: endLine, endColumn: 1,
                }, monaco.editor.ScrollType.Smooth);
            }
        } else {
            // If nothing is hovered, show ALL feedback highlights for the whole file
            file.scoredChunkGroups.forEach(group => {
                newDecorations.push(...createDecorationsForGroup(group.groupId));
            });
        }
        
        // Apply decorations
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    }, [file, hoveredGroupId, monaco, editorRef]);
}