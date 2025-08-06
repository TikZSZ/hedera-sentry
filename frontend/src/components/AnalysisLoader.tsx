// src/components/analysis/AnalysisLoader.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';

// --- Type Definitions ---
interface LogEntry {
    id: number;
    message: string;
    timestamp: string;
}

interface AnalysisLoaderProps {
    logHistory: LogEntry[];
    isLoading: boolean;
    error: string | null;
}

// --- Animation Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15, // Slightly slower stagger for a more deliberate feel
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 120 } },
};

// --- The Component ---
export function AnalysisLoader({ logHistory, isLoading, error }: AnalysisLoaderProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Effect to auto-scroll to the bottom when new logs arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logHistory]);
    
    // Determine the overall status for the progress bar and header
    const overallStatus = error ? 'error' : isLoading ? 'loading' : 'complete';

    const getIcon = (index: number, totalLogs: number) => {
        const isLastLog = index === totalLogs - 1;
        if (isLastLog && error) return <AlertTriangle className="h-4 w-4 text-red-500" />;
        if (isLastLog && isLoading) return <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />;
        if (isLastLog && !isLoading) return <CheckCircle className="h-4 w-4 text-emerald-500" />;
        return <CheckCircle className="h-4 w-4 text-zinc-500" />; // Completed steps are neutral
    };

    const getProgressBarColor = () => {
        if (error) return "bg-red-500";
        if (!isLoading) return "bg-emerald-500";
        return "bg-emerald-400";
    };

    // Estimate progress based on a typical number of steps (e.g., ~30-40)
    // This provides a smoother progress bar than just using logHistory.length
    const progressPercentage = Math.min(((logHistory.length / 35) * 100), 100);

    return (
        <div className="w-full mx-auto min-h-screen bg-black shadow-2xl font-mono text-sm border border-zinc-800 ">
            {/* Header Section */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-zinc-400" />
                    <h2 className="text-zinc-200 font-bold">Analysis Log</h2>
                </div>
                <div className={`text-xs font-semibold uppercase px-2 py-1 rounded-full ${
                    overallStatus === 'loading' ? 'text-emerald-300 bg-emerald-900/50' :
                    overallStatus === 'complete' ? 'text-emerald-200 bg-emerald-800' :
                    'text-red-200 bg-red-900/50'
                }`}>
                    {overallStatus}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-800 h-1">
                <motion.div
                    className={`h-1 ${getProgressBarColor()}`}
                    initial={{ width: '0%' }}
                    animate={{ width: isLoading ? `${progressPercentage}%` : '100%' }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
            </div>

            {/* Log Output Area */}
            <div
                ref={scrollRef}
                className="p-6 overflow-y-auto"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#4f4f5a #18181b' }} // For Firefox
            >
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                >
                    <AnimatePresence>
                        {logHistory.map((log, index) => {
                            const isLastLog = index === logHistory.length - 1;
                            return (
                                <motion.div
                                    key={log.id}
                                    variants={itemVariants}
                                    layout // This makes the list smoothly adjust when items are added
                                    className="flex items-start"
                                >
                                    <div className="flex-shrink-0 mt-0.5 mr-4">
                                        {getIcon(index, logHistory.length)}
                                    </div>
                                    <div className="flex-grow">
                                        <span className="text-zinc-500 mr-4">{log.timestamp}</span>
                                        <span className={
                                            isLastLog && isLoading ? "text-emerald-300 animate-pulse" :
                                            isLastLog && error ? "text-red-400" :
                                            isLastLog && !isLoading ? "text-emerald-400" :
                                            "text-zinc-300"
                                        }>
                                            {log.message}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}