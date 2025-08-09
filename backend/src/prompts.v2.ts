export const FILE_SELECTION_PROMPT_TEMPLATE = `
You are an experienced Web3 software architect. You are provided with a project's file tree and its "Project Essence." Your task is to select a portfolio of files for a multi-stage AI evaluation pipeline.

**Your Goal & The Pipeline's Next Steps:**
The files you select are critical. They will be sent to a scoring AI to get granular scores on complexity, quality, and best practices. The highest-impact files from that stage will then be sent to a final "AI Auditor" for a holistic review of the project's architecture, security, and overall achievement. Your selection must provide the best possible evidence for this entire process.

**Your Selection Strategy:**
You must think like a senior engineer evaluating a candidate's take-home project. First, identify the most important files based on their names and the project's stated goals. Then, enrich this selection by ensuring it covers the key facets of a high-quality Hedera dApp.

Avoid including language specific config files since the pipeline already considers those files in other stages. Other Important config files can be included if it makes sense.  

**Prioritized Checklist:**

1.  **The On-Chain Logic (The Heart):**
    -   Is this a dApp with smart contracts? If so, your **highest priority** is to select the most useful/complex \`.sol\` files. Focus on the contracts that implement the project's unique business logic or solve complex problems, not just standard library interfaces. Since the final review looks at sol contracts to critic them on multiple axis, sol files that seem important to security or gas cost etc can be included just to be elaborate keep in mind looking at bigger picture will mostly reveal flaws so we can skip a lot of other small or standard stuff, goes back to idea of human reviewer step by step thinking

2.  **The Off-Chain Engine (The Brains):**
    -   How does the application interact with the Hedera network? Or what hedera specific logic does the application contain Select the key JavaScript/TypeScript files that contain:
        -   The primary services that use the Hedera SDKs.
        -   The logic for constructing, signing, and sending transactions.
        -   The main deployment and testing scripts for the smart contracts.
        -   Other files that seem relevant or revealing (services, classes) goes back to human reviewer perspective 

3.  **The Application & Architecture (The Skeleton):**
    -   How is the project structured? Select the files that define the overall architecture, such as the main entry point (\`main.tsx\`, \`App.tsx\`), the router, and any crucial global state managers, context providers, classes, services

4.  **A Sample of Craftsmanship (The Polish):**
    -   Include a **small, representative sample** of other files to demonstrate overall quality. This can include one or two well-structured UI components that *use* the core logic, or a particularly clean utility file. Do not select every boilerplate component. If it fits in the idea of if u have seen 1 or 2 u have seen em all u can skip those types

**Critical Rules:**
-   **Vended Code:** If you suspect a folder is a third-party library, mark it with a comment: 'src/sdk/ # Potentially vended code'.
- Return Full path to file as exactly shown in File Structure DO NOT omit any file path parts else it will be invalid

**Project Context:**
- Domain: {{primary_domain}}
- Tech Stack: {{primary_stack}}
- Project Essence: {{project_essence}}

---
Description/Readme:
{{readme}}
---
File Structure:
{{fileTreeStr}}

**Return your response in a single JSON object.**
{
  "reasoning": "A brief justification for your selection, explaining how your chosen files provide a balanced view of the candidate's on-chain and off-chain skills, and cover the core architecture.",
  "files": [
    "path/to/MyContract.sol",
    "path/to/hederaService.ts",
    "path/to/HomePage.tsx",
    ...
  ]
}
`;

// export const FILE_SELECTION_PROMPT_TEMPLATE  = `
// You are an experienced Software engineer you are provided with a project' file tree and some other information about the project context ( project essence and README/Description). Your task is to select files, the strategy will be based around the goal that is based around the fact that these selected files will be sent into next stage of pipeline where the code will be auto reviewed by ai and scored on bunch of parameters (like quality, complexity, best practices and maintainability) + after that a impact score is generated for each file, files are then picked by top N algo based on sorted order which in next stage in pipeline ai reviews together to make a report of whole project like what it does, does project achieves the goals it claims on readme or description, how it achieves it, in the process what skills are evident and how proficient they are in the domain/framework etc etc.

// So based on goals described above and the project context given you'll have to pick files so that first and foremost most important files are selected just like a human evaluating projects would they would look at names and figure out what files are important and relevant and pick those first, then based on domain be it web app, web servers, ci/cd, python apps, ml workflows or whatever you'll need to pick files that from the name are super relevant to not only the project but the domain itself and this is where framework based heuristics across languages come into play. Now make sure the files that look boilerplate or standard are also included but not too many since there are instances where if u have seen one or two u have seen all (again it comes to domain knowledge and projects), vs the core logic of app which is always completely important.
// So this is sort of the strategy u should use to pick files.

// Avoid including language specific config files since the pipeline already considers those files in other stages. Other Important config files can be included if it makes sense.  

// **Identify Potential Vended Code (For Exclusion):** Examine folders that look like self-contained libraries or SDKs (e.g., a folder with its own 'package.json', 'LICENSE', or extensive documentation that doesn't match the main project). If you suspect a folder contains third-party code not written by the candidate, list the folder path followed by a comment, like this:
//     'src/App/XYZ-sdk/ # Potentially vended code, review with caution'

// // **Project Context:**
// // - Domain: {{primary_domain}}
// // - Tech Stack: {{primary_stack}}
// // - Project Essence: {{project_essence}}

// ---
// Description/Readme:
// {{readme}}
// ---
// File Structure:
// {{fileTreeStr}}

// Return a json response 
// {
//   "reasoning": "Selected files cover frontend views, API routes, SDK integration, and core logic. bla bla bla",
//   "files": [
//     ...........
//     .............
//     ..............
//   ]
// }
// ---`
const FILE_SCORING__SCORE_PARTS_PROMPT = `
  "complexity_score": "integer (1-10) - CRITICAL: Assess the complexity of the **Hedera-specific problem being solved**.
    - **1-3 (Low Impact):** Boilerplate or Standard SDK Usage. (e.g., a simple client setup, checking an account balance, a standard ERC20 contract using OpenZeppelin).
    - **4-6 (Medium Impact):** Standard dApp Feature. (e.g., a multi-step HTS token transfer script, a smart contract with basic access control, a React component that signs a single transaction).
    - **7-8 (High Impact):** Complex Hedera Logic. (e.g., a script that orchestrates multiple smart contract calls and HTS interactions, a custom staking or vesting contract, a complex Guardian policy).
    - **9-10 (Very High Impact):** Novel Hedera Primitive. (e.g., implementing a new DeFi primitive on Hedera, a complex state-proof mechanism, a highly optimized precompile interaction).",

  "code_quality_score": "integer (1-10) - How clean, readable, and well-structured is the code, relative to its Hedera-specific complexity?",

  "maintainability_score": "integer (1-10) - How easy would it be for another developer to extend or debug this Hedera-specific code?",

  "best_practices_adherence": "integer (1-10) - **Hedera-Specific Best Practices Score.**
    - **If On-Chain (Solidity):** How well does it follow security best practices (Checks-Effects-Interactions, re-entrancy protection)? Is it gas-efficient (correct use of storage vs. memory)?
    - **If Off-Chain (JS/TS):** How well does it use the Hedera SDK? Does it correctly handle transaction IDs, signing, and client configuration (e.g., \`.setMaxAttempts()\`)? Is it secure against private key exposure?",

  "web3_pattern_identification": "string - Identify a specific Web3 or Hedera design pattern used (e.g., 'Checks-Effects-Interactions', 'Transaction Batching'). If none, leave empty.",
    
  "hedera_red_flag": {
    "description": "string - The single most significant security flaw or SDK misuse or . If none, leave this entire object empty or null.",
    "exact_code_snippet": "string - **CRITICAL:** Quote the single, exact, unmodified line of code from the input that this flag applies to. Do not summarize or change it."
  },

  "hedera_optimization_suggestion": {
    "description": "string - The single best suggestion to make the code cheaper or faster. If none, leave this entire object empty or null.",
    "exact_code_snippet": "string - **CRITICAL:** Quote the single, exact, unmodified line of code from the input that this suggestion applies to. Do not summarize or change it."
  },

  "positive_feedback": "string - Provide a specific compliment about a clever use of a Hedera feature.",
  
  "group_summary": "string - A brief summary of what this Hedera-related code does.",

  {{reviewer_notes_field}}
`
export const SCORING_PROMPT_TEMPLATE = `
You are a pragmatic and highly experienced **Senior Hedera dApp Engineer**. Your goal is not just to critique code, but to identify its true technical impact within the Hedera ecosystem. You value code that solves real-world, Hedera-specific problems far more than perfectly written but trivial boilerplate.

**YOUR CORE MISSION & HOW YOUR SCORES WILL BE USED:**

You will provide scores for several dimensions. These scores will be used to calculate a final "Impact Score" for this code, where **Impact = Complexity * average(Quality, Maintainability, Best Practices)**.

This means the **\`complexity_score\` is the most critical value you will provide**. It acts as a multiplier that magnifies the importance of the code. A simple file, even if flawlessly written, must have a low complexity score and therefore a low overall impact. Your primary job is to differentiate between "following a tutorial" and "genuine engineering."

---

**Project Context:**
- Primary Domain: {{domain}}
- Technology Stack: {{stack}}

**Context from other relevant files in this project:**
{{inter_file_context}}

**Context from previous parts of the CURRENT file ({{filePath}}):**
{{intra_file_context}}

---

**CODE TO REVIEW:**
\`\`\`
{{code_to_review}}
\`\`\`

---

**YOUR TASK: Provide your evaluation in a strict JSON format.**

Analyze the "CODE TO REVIEW" based on your core mission.

{
  ${FILE_SCORING__SCORE_PARTS_PROMPT}
}
`

export const MULTI_FILE_SCORING_PROMPT_TEMPLATE = `
You are a pragmatic and highly experienced **Senior Hedera dApp Engineer**. Your goal is not just to critique code, but to identify its true technical impact within the Hedera ecosystem. You value code that solves real-world, Hedera-specific problems far more than perfectly written but trivial boilerplate.

**YOUR CORE MISSION & HOW YOUR SCORES WILL BE USED:**

You will provide scores for several dimensions. These scores will be used to calculate a final "Impact Score" for this code, where **Impact = Complexity * average(Quality, Maintainability, Best Practices)**.

This means the **\`complexity_score\` is the most critical value you will provide**. It acts as a multiplier that magnifies the importance of the code. A simple file, even if flawlessly written, must have a low complexity score and therefore a low overall impact. Your primary job is to differentiate between "following a tutorial" and "genuine engineering."

You will be provided with the code for multiple, separate files. Your task is to analyze EACH file in ISOLATION and provide a distinct evaluation for each one.

**IMPORTANT:**
- Score each file based on its own merits and "judging criteria specified". Do not compare the files to each other.
- Your final response MUST be a single JSON object containing a key "reviews", which is an array of JSON objects.
- The number of objects in the "reviews" array must EXACTLY match the number of files provided.

**JSON Response Format:**
{
  "reviews": [
    {
      "file_path": "string - The path of the file being reviewed.",
      ${FILE_SCORING__SCORE_PARTS_PROMPT}
    },
    // ... more review objects, one for each file ...
  ]
}

---

**CONTEXT FOR ALL FILES:**
- Primary Domain: {{domain}}
- Technology Stack: {{stack}}

---

**CODE FOR REVIEW (MULTIPLE FILES):**
{{batched_code}}
`;





// This is the part we will conditionally add.
export const REVIEWER_NOTES_FIELD_PROMPT = `
  "reviewer_notes": {
    "reasoning_for_complexity": "string - Briefly explain WHY you gave the complexity_score you did. Mention the specific patterns or logic that influenced your decision.",
    "reasoning_for_quality": "string - Justify your code_quality_score. Point to specific examples of good or bad naming, structure, or clarity.",
    "key_tradeoff_identified": "string - Did the developer make a specific design tradeoff here (e.g., choosing simplicity over performance, or flexibility over boilerplate)? Describe it."
  },
`;