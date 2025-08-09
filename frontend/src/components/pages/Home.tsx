// src/pages/HomePage.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Github, GitBranch, Cpu, Bot, FileJson, ShieldCheck, Zap, BarChart3, ArrowRight, Loader2, Lightbulb, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DUMMY_PROJECT_SCORECARD as exampleReport } from "@/lib/dummy-data"; // We'll use the dummy report again

const features = [
    {
        icon: <ShieldCheck className="h-8 w-8 text-emerald-400" />,
        title: "On-Chain Security Audit",
        desc: "Our AI Auditor, trained on Hedera best practices, analyzes your smart contracts for critical vulnerabilities like re-entrancy, gas inefficiencies, and unsafe HTS interactions."
    },
    {
        icon: <BarChart3 className="h-8 w-8 text-cyan-400" />,
        title: "Architectural Deep Dive",
        desc: "Go beyond single files. Sentry analyzes the entire project structure to generate a visual dependency graph and assess your system's overall cohesion and maintainability."
    },
    {
        icon: <UserCheck className="h-8 w-8 text-indigo-400" />,
        title: "Developer Profile Analysis",
        desc: "Sentry doesn't just score code; it profiles the engineer. It identifies a developer's primary archetype and pinpoints their key strengths and areas for growth."
    },
    {
        icon: <Lightbulb className="h-8 w-8 text-amber-400" />,
        title: "Strategic Recommendations",
        desc: "Receive actionable, senior-level advice. Sentry provides concrete suggestions for architectural improvements and even proposes the next logical feature for your roadmap."
    }
];
export default function HomePage() {
    const [repoUrl, setRepoUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleAnalysis = () => {
        if (!repoUrl.includes("github.com")) {
            setError("Please enter a valid GitHub repository URL.");
            return;
        }
        setError("");
        setIsLoading(true);
        const runId = new Date().toISOString()
        navigate(`/analysis?repo=${encodeURIComponent(repoUrl)}&runId=${runId}`);
    };

    return (
        <div className="snap-y snap-mandatory h-screen overflow-y-scroll scroll-smooth bg-black  px-[5%] md:px-0">
            
            {/* --- SECTION 1: HERO & CALL TO ACTION --- */}
            <section className="relative snap-start min-h-screen flex flex-col items-center justify-center text-center px-6 text-white overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-900/50 rounded-full filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-900/50 rounded-full filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

                <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="max-w-4xl"
                    >
                        <Badge className="bg-emerald-900/50 border-emerald-500/30 text-emerald-300 mb-4">
                            Built for the Hedera Origins Hackathon
                        </Badge>
                        <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 pb-2 ">
                            Build on Hedera with Confidence.
                        </h1>
                        <p className="mt-6 text-lg md:text-xl text-zinc-400">
                            <span className="font-bold">Hedera Sentry AI</span> is your autonomous expert auditor. Instantly analyze any GitHub repository to uncover security risks, optimize gas fees, and get a deep architectural review of your dApp.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="mt-12 w-full max-w-2xl"
                    >
                        <form onSubmit={(e) => { e.preventDefault(); handleAnalysis(); }} className="flex flex-col sm:flex-row items-center gap-2">
                            <div className="relative w-full">
                                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                <Input
                                    type="text"
                                    placeholder="Paste your public GitHub repository URL..."
                                    className="h-12 pl-10 text-base glass-card-dark text-zinc-200 placeholder:text-zinc-500"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                />
                            </div>
                            <Button size="lg" className="w-full sm:w-auto h-12 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-black" type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : "Start Audit"}
                            </Button>
                        </form>
                         <Button variant="link" className="mt-3 text-zinc-500 hover:text-emerald-400 text-sm" onClick={() => setRepoUrl("https://github.com/hashgraph/hedera-smart-contracts")}>
                            Or, analyze an example project
                        </Button>
                        {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                    </motion.div>
                </div>
            </section>

            {/* --- SECTION 2: HOW IT WORKS / PIPELINE --- */}
            <section className="snap-start min-h-screen flex flex-col items-center justify-center px-6 bg-black text-white relative ">
                <h2 className="text-4xl font-bold mb-4 text-center">More Than a Linter. A True Second Opinion.</h2>
                <p className="mb-12 text-lg text-zinc-400 max-w-2xl text-center">
                  Sentry provides insights that are normally only available from a seasoned Principal Engineer.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl ">
                    {features.map(({ icon, title, desc }, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.5 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card-dark p-6 h-full text-left"
                        >
                            <div className="mb-4">{icon}</div>
                            <h3 className="font-semibold text-lg mb-2 text-zinc-100">{title}</h3>
                            <p className="text-sm text-zinc-400">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* --- SECTION 3: THE REWARD / REPORT PREVIEW --- */}
            <section className="snap-start min-h-screen flex flex-col items-center justify-center md:px-6 md:pb-6 bg-black text-white z-20">
                <h2 className="text-4xl font-bold mb-4 text-center">Receive an Expert-Level Scorecard</h2>
                <p className="mb-12 text-lg text-zinc-400 max-w-2xl text-center">
                    Go beyond simple linting. Get a holistic, data-driven verdict on your project's quality and the engineer's skill.
                </p>
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.1 }}

                    transition={{ duration: 0.7 }}
                    className="w-full max-w-5xl"
                >
                    <div className="glass-card-dark p-8 rounded-2xl border-emerald-500/20 shadow-emerald-500/10 shadow-2xl">
                        <CardHeader className="p-0">
                            <CardTitle className="text-3xl font-bold text-zinc-100">
                                Sample Audit: <span className="text-emerald-400">hedera-example-dapp</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-3 gap-8 mt-6 p-0">
                            <div className="flex flex-col items-center justify-center">
                                <p className="text-zinc-400">Final Sentry Grade</p>
                                <div className="text-7xl font-bold text-emerald-400 mt-2">{exampleReport.finalProjectScore?.toFixed(2)}</div>
                                <div className="mt-4 text-sm space-y-1 text-zinc-500">
                                    <p>Complexity: {exampleReport.profile.complexity.toFixed(1)}</p>
                                    <p>Quality: {exampleReport.profile.quality.toFixed(1)}</p>
                                    <p>Best Practices: {exampleReport.profile.best_practices.toFixed(1)}</p>
                                </div>
                            </div>
                            <div className="md:col-span-2 text-left">
                                <h4 className="font-semibold text-xl text-zinc-200 mb-2">Executive Summary</h4>
                                <p className="text-zinc-400">{exampleReport.finalReview.detailed_audit.score_explanation}</p>
                                <h4 className="font-semibold text-xl text-zinc-200 mt-6 mb-2">Key Strengths Identified</h4>
                                {/* <p className="text-zinc-400">{exampleReport.finalReview.holistic_project_summary}</p> */}
                                
                                <ul className="list-disc pl-5 text-zinc-400 space-y-1">
                                    {Object.values(exampleReport.finalReview.executive_summary).map((point, i) => (
                                        <li key={i}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        </CardContent>
                    </div>
                </motion.div>
            </section>
        </div>
    );
}