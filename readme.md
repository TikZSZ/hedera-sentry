# 🛡️ Hedera Sentry AI

**Hedera Sentry AI** is an AI-powered auditor and intelligence platform that gives developers a CTO-level code review for their entire Hedera project—instantly. It performs deep architectural, security, and ecosystem-specific reviews of Hedera dApps to make building on the network safer and more efficient.

This project was built for the **Hello Future: Origins 2025 Hackathon**

---

## ✨ Core Features

*   **Full Repository Analysis:** Ingests an entire public GitHub repository for holistic, context-aware auditing.
*   **Sentry Grade & Executive Briefing:** Provides a calibrated 1-10 score and a concise, human-readable summary of the project's purpose and quality.
*   **Interactive Code Audit:** Links every AI insight directly to the exact lines of code, with real-time highlighting for risks, optimizations, and best practices.
*   **Architectural Intelligence:** Generates visual dependency graphs and diagnoses issues beyond the scope of single-file scanners.
*   **Hedera-Specific Focus:** The AI pipeline is specifically tuned to recognize HTS misuse, SDK v3 anti-patterns, and precompile gas inefficiencies.

## 🚀 Getting Started

The project is structured into two main directories: `frontend` and `backend`. Follow the steps below to run the application locally.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Bun](https://bun.sh/) or [npm](https://www.npmjs.com/)/[yarn](https://yarnpkg.com/)
*   An `OPENAI_API_KEY` from [OpenAI](https://platform.openai.com/api-keys)
*   A `GEMINI_API_KEY` from [Google AI Studio](https://makersuite.google.com/app/apikey)

---

### 1. Backend Setup

The backend service is responsible for handling the AI analysis pipeline.

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
bun install
# or: npm install

# 3. Set up your environment variables
# Create a new file named .env in the `backend` directory
touch .env

# 4. Add your API keys to the .env file:
#    (Replace your_key_here with your actual keys)
```

Your `backend/.env` file should look like this:

```env
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
```

```bash
# 5. Start the backend server
bun run start
# or: npm run start

# The backend server should now be running, typically on http://localhost:10000
```

---

### 2. Frontend Setup

The frontend is a Vite-powered React application that provides the user interface.

```bash
# 1. Open a new terminal and navigate to the frontend directory
cd frontend

# 2. Install dependencies
bun install
# or: npm install

# 3. Set up your environment variables
# Create a new file named .env in the `frontend` directory
touch .env

# 4. Add the backend API URL to the .env file.
```

Your `frontend/.env` file should contain this line:

```env
VITE_API_URL=http://localhost:10000
```

*(Note: If your backend runs on a different port, update the URL accordingly.)*

```bash
# 5. Start the frontend development server
bun run dev
# or: npm run dev

# The application should now be running and accessible in your browser,
# typically at http://localhost:5173
```

---

## 🛠️ Technology Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS
*   **Backend:** Node.js, [Your Backend Framework, e.g., Express.js, NestJS]
*   **AI & Orchestration:** OpenAI API, Google Gemini API, [Any other key libraries, e.g., LangChain]
*   **Code Analysis:** Tree-sitter

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.