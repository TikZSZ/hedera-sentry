// src/components/TechStackDisplay.tsx

import { TechIcon } from './TechIcon'; // Import our new smart component

export const TechStackDisplay = ({ techStack }: { techStack: string[] }) => {
  if (!techStack || techStack.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <h3 className="text-sm font-semibold text-zinc-400">Tech Stack:</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {techStack.map(tech => (
          <div key={tech} className="flex items-center gap-2" title={tech}>
            <TechIcon tech={tech} /> {/* Use the new component */}
            <span className="text-sm text-zinc-300">{tech}</span>
          </div>
        ))}
      </div>
    </div>
  );
};