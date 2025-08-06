// src/components/analysis/AnalysisLoader.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

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

export function AnalysisLoader({ logHistory, isLoading, error }: AnalysisLoaderProps) {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
    };

    const getIcon = (index: number, totalLogs: number) => {
        if (error && index === totalLogs - 1) {
            return <AlertTriangle className="h-4 w-4 text-red-500" />;
        }
        if (!isLoading && index === totalLogs - 1) {
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        }
        if (isLoading && index === totalLogs - 1) {
            return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        }
        return <CheckCircle className="h-4 w-4 text-gray-400" />;
    };

    return (
        <div className="w-full h-screen mx-auto bg-gray-900 text-white  shadow-2xl p-6 font-mono text-sm border border-gray-700">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3 w-[50%] mx-auto"
            >
                <AnimatePresence>
                    {logHistory.map((log, index) => (
                        <motion.div
                            key={log.id}
                            variants={itemVariants}

                            exit="hidden"
                            layout
                            className="flex"
                        >
                            <div className="flex-shrink-0 mt-0.5 mr-3">
                                {getIcon(index, logHistory.length)}
                            </div>
                            <div className="flex-grow">
                                <span className="text-gray-400 mr-3">{log.timestamp}</span>
                                <span className={
                                    isLoading && index === logHistory.length - 1 ? "text-blue-400 font-bold" :
                                    error && index === logHistory.length - 1 ? "text-red-400 font-bold" :
                                    !isLoading && index === logHistory.length - 1 ? "text-green-400 font-bold" :
                                    "text-gray-300"
                                }>
                                    {log.message}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}