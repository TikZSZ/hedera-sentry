// src/pages/HomePage.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import
{
  Github,
  GitBranch,
  Cpu,
  Bot,
  FileJson,
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

const exampleReport = {
  finalScore: 8.7,
  complexity: 7.8,
  quality: 9.1,
  bestPractices: 9.2,
  summary:
    "An exceptionally well-architected Hedera dApp demonstrating a deep understanding of HTS and secure smart contract patterns.",
  strengths: [
    "Excellent separation of on-chain and off-chain logic.",
    "Highly gas-efficient minting function in primary contract.",
    "Robust error handling and transaction retries in the SDK service.",
  ],
};

export default function HomePage ()
{
  const [ repoUrl, setRepoUrl ] = useState( "" );
  const [ isLoading, setIsLoading ] = useState( false );
  const [ error, setError ] = useState( "" );
  const navigate = useNavigate();

  const handleAnalysis = () =>
  {
    if ( !repoUrl.includes( "github.com" ) )
    {
      setError( "Please enter a valid GitHub repository URL." );
      return;
    }
    setError( "" );
    setIsLoading( true );
    navigate( `/analysis?repo=${encodeURIComponent( repoUrl )}` );
  };

  return (
    <div className="snap-y snap-mandatory h-screen overflow-y-scroll scroll-smooth">
      {/* --- HERO SECTION --- */}
      <section className="relative snap-start h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-tr from-emerald-500 to-cyan-600 text-white overflow-hidden">
        {/* Glowing blobs */}
        <motion.div
          className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-300 opacity-30 rounded-full blur-3xl z-0"
          animate={{ scale: [ 1, 1.2, 1 ] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-72 h-72 bg-cyan-400 opacity-20 rounded-full blur-2xl z-0"
          animate={{ y: [ 0, -20, 0 ], x: [ 0, 20, 0 ] }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="z-10 max-w-3xl"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold drop-shadow-2xl">
            Hedera Sentry AI
          </h1>
          <p className="mt-6 text-xl md:text-2xl text-white/80">
            Instantly audit any Hedera dApp with AI. **Uncover security risks, optimize gas fees, and improve your architecture** — in seconds.
          </p>
        </motion.div>

        {/* GitHub Input */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 z-10 w-full max-w-2xl flex flex-col sm:flex-row items-center gap-4"
        >
          <Input
            className="h-12 text-base bg-white/20 backdrop-blur-md border border-white/30 text-white placeholder:text-white/60"
            placeholder="https://github.com/hashgraph/hedera-dapp"
            value={repoUrl}
            onChange={( e ) => setRepoUrl( e.target.value )}
            onKeyDown={( e ) => e.key === "Enter" && handleAnalysis()}
          />
          <Button
            className="h-12 px-6 bg-white text-emerald-700 hover:bg-gray-100"
            onClick={handleAnalysis}
            disabled={isLoading}
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </Button>
        </motion.div>
        {error && <p className="text-red-200 mt-3">{error}</p>}
        <Button
          variant="link"
          className="mt-4 text-white/60 hover:text-white"
          onClick={() =>
          {
            const exampleUrl = "https://github.com/hashgraph/hedera-smart-contracts";
            setRepoUrl( exampleUrl );
            // Optionally, you could even trigger the analysis directly
            // navigate(`/analysis?repo=${encodeURIComponent(exampleUrl)}`);
          }}
        >
          Or, see an example analysis
        </Button>
      </section>

      {/* --- PIPELINE SECTION --- */}
      <section className="snap-start h-screen flex flex-col items-center justify-center px-6 bg-zinc-900 text-white relative">
        <h2 className="text-4xl font-bold mb-4 text-emerald-400">
          How It Works
        </h2>
        <p className="mb-12 text-lg text-zinc-300 max-w-xl text-center">
          Our multi-stage AI pipeline mimics how an expert would audit your codebase.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[ {
            icon: <GitBranch className="text-emerald-300" />,
            title: "Scoping & Selection",
            desc: "Identifies the most important Solidity/SDK files, ignores boilerplate."
          }, {
            icon: <Cpu className="text-cyan-300" />,
            title: "Scoring Engine",
            desc: "Chunks code, rates it on complexity, security, & Hedera best practices."
          }, {
            icon: <Bot className="text-purple-300" />,
            title: "CTO Review",
            desc: "Evaluates big-picture architecture, cohesion, modularity."
          }, {
            icon: <FileJson className="text-orange-300" />,
            title: "Final Report",
            desc: "Get a polished report with score, strengths, and advice."
          } ].map( ( { icon, title, desc }, i ) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
              className="bg-zinc-800/50 backdrop-blur-md border border-zinc-700/40 p-6 rounded-xl text-left shadow-xl hover:shadow-emerald-400/20"
            >
              <div className="mb-4 text-3xl">{icon}</div>
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </motion.div>
          ) )}
        </div>
      </section>

      {/* --- REPORT PREVIEW --- */}
      <section className="snap-start h-screen flex items-center justify-center px-6 bg-gradient-to-br from-zinc-900 via-black to-zinc-800 text-white">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }} 
          className="w-full max-w-5xl glass-card p-8 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-emerald-500/10 shadow-2xl"
        >
          <CardHeader>
            <CardTitle className="text-3xl font-bold">
              Sample Audit: <span className="text-emerald-300">hedera-demo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-8 mt-6">
            <div className="text-center">
              <p className="text-zinc-400">Final Score</p>
              <div className="my-4 relative h-32 w-32 mx-auto">
                  <svg className="absolute inset-0" viewBox="0 0 36 36">
                    <path className="text-gray-200 dark:text-gray-700" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <motion.path 
                        className="text-emerald-500"
                        strokeWidth="3" 
                        stroke="currentColor" 
                        fill="none" 
                        strokeLinecap="round"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        initial={{ strokeDasharray: "0, 100" }}
                        animate={{ strokeDasharray: `${exampleReport.finalScore * 10}, 100` }}
                        transition={{ duration: 1, ease: "circOut", delay: 0.5 }}
                     />
                  </svg>
                  <div className="absolute inset-2 flex items-center justify-center">
                    <span className="text-4xl font-bold">{exampleReport.finalScore.toFixed(1)}</span>
                  </div>
                </div>
              
              <div className="mt-4 text-sm space-y-1 text-zinc-400">
                <p>Complexity: {exampleReport.complexity}</p>
                <p>Quality: {exampleReport.quality}</p>
                <p>Best Practices: {exampleReport.bestPractices}</p>
              </div>
            </div>
            <div className="md:col-span-2 text-left">
              <h4 className="font-semibold text-xl text-emerald-300 mb-2">Summary</h4>
              <p className="text-zinc-300">{exampleReport.summary}</p>
              <h4 className="font-semibold text-xl text-emerald-300 mt-6 mb-2">Key Strengths</h4>
              <ul className="list-disc pl-5 text-zinc-400 space-y-1">
                {exampleReport.strengths.map( ( point, i ) => (
                  <li key={i}>{point}</li>
                ) )}
              </ul>
            </div>
          </CardContent>
        </motion.div>
      </section>
    </div>
  );
}
