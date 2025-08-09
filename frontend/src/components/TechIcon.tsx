// src/components/TechIcon.tsx

import React, { useState } from 'react';
import { SiSolidity, SiTypescript, SiReact, SiNodedotjs, SiNestjs } from 'react-icons/si';
import { FaHardHat } from 'react-icons/fa';
import { Package } from 'lucide-react'; // Our fallback icon from Lucide

// 1. Our primary, static map for common, high-quality icons.
const staticIconMap: Record<string, React.ReactNode> = {
  'Solidity': <SiSolidity className="text-gray-400" />,
  'TypeScript': <SiTypescript className="text-blue-400" />,
  'React': <SiReact className="text-sky-400" />,
  'Node.js': <SiNodedotjs className="text-green-500" />,
  'NestJS': <SiNestjs className="text-red-500" />,
  'Hardhat': <FaHardHat className="text-yellow-500" />,
  // ... add your other top 15-20 techs here
};

const FallbackIcon = <Package className="h-4 w-4 text-zinc-500" />;

// 2. A helper to normalize names for the dynamic URL (e.g., "Next.js" -> "nextjs")
const normalizeForCDN = (name: string): string => {
  return name.toLowerCase().replace(/[\s.]/g, '');
};

interface TechIconProps {
  tech: string;
}

export const TechIcon = ({ tech }: TechIconProps) => {
  const [hasError, setHasError] = useState(false);
  
  // 3. Check our primary static map first.
  const staticIcon = staticIconMap[tech];
  if (staticIcon) {
    return <span className="h-4 w-4 flex items-center justify-center">{staticIcon}</span>;
  }

  // 4. If not found, construct a URL for the Devicon CDN as a fallback.
  const slug = normalizeForCDN(tech);
  // We'll try to fetch the colored, original version of the icon.
  const dynamicIconUrl = `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`;

  // 5. Render based on error state.
  if (hasError) {
    return <span className="h-4 w-4 flex items-center justify-center">{FallbackIcon}</span>;
  }

  // Render an <img> tag. The `onError` handler is the key to our fallback logic.
  return (
    <img
      src={dynamicIconUrl}
      alt={`${tech} logo`}
      className="h-4 w-4"
      // If this image fails to load (404), this event fires.
      onError={() => setHasError(true)}
      // Hide the broken image icon while it's trying to load
      style={{ display: hasError ? 'none' : 'inline-block' }}
    />
  );
};