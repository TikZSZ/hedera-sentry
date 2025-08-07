// // This would be your ProjectOverview.tsx component

// import { useState } from 'react';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Github, Target, Lightbulb, UserCheck, BarChart3, ShieldCheck, Zap, Package } from 'lucide-react';
// import type { ProjectScorecard } from '@/types';
// import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// import { Badge } from '@/components/ui/badge';

// // A small helper for the stat cards, inspired by your screenshot
// const StatCard = ( { title, value, icon, onClick }: { title: string, value: string, icon: React.ReactNode, onClick?: () => void } ) => (
//   <Card
//     className="glass-card-dark text-center p-4 flex flex-col justify-between hover:bg-zinc-800/80 transition-colors"
//     onClick={onClick}
//     asChild={!!onClick}
//   >
//     {onClick ? <button>
//       <CardHeader className="p-2">
//         <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="p-2">
//         <div className="text-2xl font-bold flex items-center justify-center gap-2 text-zinc-300">
//           {icon}
//           <span>{value}</span>
//         </div>
//       </CardContent>
//     </button> : <div>
//       <CardHeader className="p-2">
//         <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="p-2">
//         <div className="text-2xl font-bold flex items-center justify-center gap-2 text-zinc-300">
//           {icon}
//           <span className="truncate">{value}</span>
//         </div>
//       </CardContent>
//     </div>}
//   </Card>
// );

// const AuditNote = ( { title, content, icon }: { title: string, content: string, icon: React.ReactNode } ) => (
//   <div>
//     <h4 className="font-semibold text-zinc-300 flex items-center gap-2">
//       {icon}
//       {title.replace( /_/g, ' ' )}
//     </h4>
//     <p className="pl-6 text-zinc-400 text-sm mt-1">{content}</p>
//   </div>
// );

// export const ProjectOverview = ( { report }: { report: ProjectScorecard } ) =>
// {
//   const [ isIdeaModalOpen, setIsIdeaModalOpen ] = useState( false );

//   const radarData = report ? [
//     { subject: 'Complexity', value: report.profile.complexity, fullMark: 10 },
//     { subject: 'Quality', value: report.profile.quality, fullMark: 10 },
//     { subject: 'Maintainability', value: report.profile.maintainability, fullMark: 10 },
//     { subject: 'Best Practices', value: report.profile.best_practices, fullMark: 10 },
//   ] : [];

//   return (
//     <div className="space-y-8">
//       {/* --- Header Section --- */}
//       <div>
//         <div className="flex items-center gap-4">
//           <Github className="h-10 w-10 text-zinc-500" />
//           <h1 className="text-5xl font-bold text-zinc-100">{report.repoName}</h1>
//         </div>
//         <p className="mt-4 text-lg text-zinc-300 max-w-4xl">{report.projectEssence}</p>
//       </div>

//       {/* --- Main Dashboard Grid (re-architected for balance) --- */}
//       <div className=" grid grid-rows-2 gap-0">
//         {/* Left Column: Key Scores & Profile */}
//         <div className="grid grid-cols-2 gap-x-4 max-h-15">
//           <Card className=" glass-card-dark">
//             <CardHeader>
//               <CardTitle className="text-zinc-300">Final Project Score</CardTitle>
//               <CardDescription className="text-zinc-500">Calibrated by CTO-level AI review</CardDescription>
//             </CardHeader>
//             <CardContent className="text-center">
//               <div className="text-8xl font-bold text-emerald-400">
//                 {report.finalProjectScore?.toFixed( 2 )}
//               </div>
//               <p className="text-sm text-zinc-500 mt-2">
//                 (Preliminary: {report.preliminaryProjectScore?.toFixed( 2 )} &times; {report.finalReview.multiplier}x Multiplier)
//               </p>
//             </CardContent>
//           </Card>

//           <Card className="glass-card-dark">
//             <CardHeader>
//               <CardTitle className="text-zinc-300">Architectural Profile</CardTitle>
//             </CardHeader>
//             <CardContent className="h-80">
//               <ResponsiveContainer width="100%" height="100%">
//                 <RadarChart data={radarData} outerRadius="80%">
//                   <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
//                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 14 }} />
//                   <Radar dataKey="value" stroke="#34D399" fill="#34D399" fillOpacity={0.4} />
//                 </RadarChart>
//               </ResponsiveContainer>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Right Column: CTO's Strategic Insights */}
//         <div className="">
//           <Card className="glass-card-dark flex flex-col">
//             <CardHeader>
//               <CardTitle className="text-xl text-zinc-200">CTO's Verdict</CardTitle>
//             </CardHeader>
//             <CardContent className="flex flex-col flex-grow">
//               <p className="text-zinc-300 italic mb-6">
//                 "{report.finalReview.holistic_project_summary}"
//               </p>
//               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//                 <StatCard
//                   title="Developer Archetype"
//                   value={report.finalReview.inferred_developer_archetype[ 0 ]}
//                   icon={<UserCheck className="h-5 w-5 text-indigo-400" />}
//                 />
//                 <StatCard
//                   title="Hedera Integration"
//                   value={`${report.finalReview.hedera_service_integration_score}/10`}
//                   icon={<BarChart3 className="h-5 w-5 text-sky-400" />}
//                 />
//                 <Dialog open={isIdeaModalOpen} onOpenChange={setIsIdeaModalOpen}>
//                   <DialogTrigger asChild>
//                     <StatCard
//                       title="Next Feature Idea"
//                       value="View Idea"
//                       icon={<Lightbulb className="h-5 w-5 text-amber-400" />}
//                       onClick={() => { }} // onClick is handled by DialogTrigger
//                     />
//                   </DialogTrigger>
//                   <DialogContent className="glass-card-dark text-white">
//                     <DialogHeader>
//                       <DialogTitle className="text-emerald-400 text-xl">AI's Strategic Feature Suggestion</DialogTitle>
//                     </DialogHeader>
//                     <div className="mt-4 text-zinc-300">
//                       {report.finalReview.strategic_next_feature}
//                     </div>
//                   </DialogContent>
//                 </Dialog>
//               </div>
//             </CardContent>
//           </Card>

//           <Card className="glass-card-dark">
//             <CardHeader>
//               <CardTitle className="text-xl text-zinc-200">Expert Audit Notes</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <Accordion type="single" collapsible defaultValue="item-1">
//                 <AccordionItem value="item-1" className="border-zinc-800">
//                   <AccordionTrigger className="text-emerald-400 hover:no-underline font-semibold">Show Detailed Justification</AccordionTrigger>
//                   <AccordionContent className="pt-4 space-y-4">
//                     <AuditNote title="Multiplier Justification" content={report.finalReview.reasoning.multiplierJustification} icon={<Target className="h-4 w-4 text-zinc-400" />} />
//                     <AuditNote title="Security Assessment" content={report.finalReview.reasoning.security_assessment} icon={<ShieldCheck className="h-4 w-4 text-zinc-400" />} />
//                     <AuditNote title="Gas & Efficiency" content={report.finalReview.reasoning.gas_efficiency_assessment} icon={<Zap className="h-4 w-4 text-zinc-400" />} />
//                     <AuditNote title="SDK & HTS Usage" content={report.finalReview.reasoning.sdk_and_hts_usage_assessment} icon={<Package className="h-4 w-4 text-zinc-400" />} />
//                   </AccordionContent>
//                 </AccordionItem>
//               </Accordion>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// };

// This would be your ProjectOverview.tsx component

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Target, Lightbulb, UserCheck, BarChart3, ShieldCheck, Zap, Package } from 'lucide-react';
import type { ProjectScorecard } from '@/types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// A small helper for the stat cards, inspired by your screenshot
const StatCard = ({ title, value, icon, onClick }: { title: string, value: string, icon: React.ReactNode, onClick?: () => void }) => (
    <Card
        className="glass-card-dark text-center p-4 flex flex-col justify-between hover:bg-zinc-800/80 transition-colors"
        onClick={onClick}
        asChild={!!onClick}
    >
        {onClick ? <button>
            <CardHeader className="p-2">
                <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <div className="text-2xl font-bold flex items-center justify-center gap-2 text-zinc-300">
                    {icon}
                    <span>{value}</span>
                </div>
            </CardContent>
        </button> : <div>
            <CardHeader className="p-2">
                <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <div className="text-2xl font-bold flex items-center justify-center gap-2 text-zinc-300">
                    {icon}
                    <span className="truncate">{value}</span>
                </div>
            </CardContent>
        </div>}
    </Card>
);

const AuditNote = ({ title, content, icon }: { title: string, content: string, icon: React.ReactNode }) => (
    <div>
        <h4 className="font-semibold text-zinc-300 flex items-center gap-2">
            {icon}
            {title.replace(/_/g, ' ')}
        </h4>
        <p className="pl-6 text-zinc-400 text-sm mt-1">{content}</p>
    </div>
);

export const ProjectOverview = ({ report }: { report: ProjectScorecard }) => {
    const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);

    const radarData = report ? [
        { subject: 'Complexity', value: report.profile.complexity, fullMark: 10 },
        { subject: 'Quality', value: report.profile.quality, fullMark: 10 },
        { subject: 'Maintainability', value: report.profile.maintainability, fullMark: 10 },
        { subject: 'Best Practices', value: report.profile.best_practices, fullMark: 10 },
    ] : [];

    return (
        <div className="relative z-10 space-y-8"> {/* Add relative and z-index for background */}
            {/* --- Header Section --- */}
            <div>
                <div className="flex items-center gap-4">
                    <Github className="h-10 w-10 text-zinc-500" />
                    <h1 className="text-5xl font-bold text-zinc-100">{report.repoName}</h1>
                </div>
                <p className="mt-4 text-lg text-zinc-300 max-w-4xl">{report.projectEssence}</p>
            </div>

            {/* --- NEW LAYOUT: TOP ROW for Scores & Profile --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="glass-card-dark">
                    <CardHeader>
                        <CardTitle className="text-zinc-300">Final Project Score</CardTitle>
                        <CardDescription className="text-zinc-500">Calibrated by CTO-level AI review</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <div className="text-8xl font-bold text-emerald-400">
                            {report.finalProjectScore?.toFixed(2)}
                        </div>
                        <p className="text-sm text-zinc-500 mt-2">
                            (Preliminary: {report.preliminaryProjectScore?.toFixed(2)} &times; {report.finalReview.multiplier}x Multiplier)
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card-dark">
                    <CardHeader>
                        <CardTitle className="text-zinc-300">Architectural Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData} outerRadius="80%">
                                <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 14 }} />
                                <Radar dataKey="value" stroke="#34D399" fill="#34D399" fillOpacity={0.4} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* --- NEW LAYOUT: BOTTOM ROW for AI Insights --- */}
            <div className="grid grid-cols-1 gap-8">
                <Card className="glass-card-dark h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-xl text-zinc-200">CTO's Verdict</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow">
                        <p className="text-zinc-300 italic mb-6">
                            "{report.finalReview.holistic_project_summary}"
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                title="Developer Archetype"
                                value={report.finalReview.inferred_developer_archetype[0]}
                                icon={<UserCheck className="h-5 w-5 text-indigo-400" />}
                            />
                            <StatCard
                                title="Hedera Integration"
                                value={`${report.finalReview.hedera_service_integration_score}/10`}
                                icon={<BarChart3 className="h-5 w-5 text-sky-400" />}
                            />
                            <Dialog open={isIdeaModalOpen} onOpenChange={setIsIdeaModalOpen}>
                                <DialogTrigger asChild>
                                    <StatCard
                                        title="Next Feature Idea"
                                        value="View Idea"
                                        icon={<Lightbulb className="h-5 w-5 text-amber-400" />}
                                        onClick={() => { }} // onClick is handled by DialogTrigger
                                    />
                                </DialogTrigger>
                                <DialogContent className="glass-card-dark text-white">
                                    <DialogHeader>
                                        <DialogTitle className="text-emerald-400 text-xl">AI's Strategic Feature Suggestion</DialogTitle>
                                    </DialogHeader>
                                    <div className="mt-4 text-zinc-300">
                                        {report.finalReview.strategic_next_feature}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card-dark">
                    <CardHeader>
                        <CardTitle className="text-xl text-zinc-200">Expert Audit Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible defaultValue="item-1">
                            <AccordionItem value="item-1" className="border-zinc-800">
                                <AccordionTrigger className="text-emerald-400 hover:no-underline font-semibold">Show Detailed Justification</AccordionTrigger>
                                <AccordionContent className="pt-4 space-y-4">
                                    <AuditNote title="Justification" content={report.finalReview.reasoning.multiplier_justification} icon={<Target className="h-4 w-4 text-zinc-400" />} />
                                    <AuditNote title="Security Assessment" content={report.finalReview.reasoning.security_assessment} icon={<ShieldCheck className="h-4 w-4 text-zinc-400" />} />
                                    <AuditNote title="Gas & Efficiency" content={report.finalReview.reasoning.gas_efficiency_assessment} icon={<Zap className="h-4 w-4 text-zinc-400" />} />
                                    <AuditNote title="SDK & HTS Usage" content={report.finalReview.reasoning.sdk_and_hts_usage_assessment} icon={<Package className="h-4 w-4 text-zinc-400" />} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};