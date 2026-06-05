# Edutech Global AI Assistant

The **Edutech Global AI Assistant** (formerly Skylar/Maverick) is a full-stack, Retrieval-Augmented Generation (RAG) powered web application designed to act as a knowledgeable, friendly, and professional helper for new staff, interns, and team members at Edutech Global.

## 🌟 Key Features

- **Document Knowledge Base:** Directly upload PDF, DOCX, and XLSX documents to build an internal organizational memory.
- **Advanced RAG Architecture:** Vector embeddings are generated via OpenAI (`text-embedding-3-small`) and stored/indexed in Supabase using `pgvector` and HNSW indexing for rapid semantic search.
- **Smart Fallback (Tavily Integration):** The AI intelligently decides if it has enough internal knowledge to answer a query. If internal context is missing or weak, it supplements or fully delegates the query to the web via the Tavily Advanced Search API.
- **Secure Admin Panel:** Built-in dashboard (`/admin`) gated by password protection allowing admins to upload, chunk, and manage knowledge base documents natively.
- **Modern UI:** Built with React/Next.js 16 featuring a dynamic chat interface.

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **AI/LLM Routing:** [OpenRouter](https://openrouter.ai/) using `openai/gpt-4o-mini`
- **Embeddings:** OpenAI `text-embedding-3-small` (via OpenRouter)
- **Vector Database:** Supabase (`pgvector` + HNSW indexing)
- **Web Search API:** Tavily
- **Document Parsing:** `pdf-parse`, `mammoth` (DOCX), `xlsx`
- **AI SDK:** Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/react`)

## 🏗 Architecture & Flow

1. **User Query:** User submits a message via the Chat Interface.
2. **Embedding Generation:** The query is converted into a 1536-dimensional vector using `text-embedding-3-small`.
3. **Semantic Search (Supabase):** The system searches the `kb_chunks` table using vector cosine similarity.
4. **Confidence Routing:**
   - **High Confidence (>0.6):** Only Internal KB is used.
   - **Weak Match (0.3 - 0.6):** Both Internal KB + Internet Search (Tavily) are merged into the prompt.
   - **No Match (<0.3):** System falls back entirely to Tavily internet search.
5. **LLM Synthesis:** The context is fed to the `gpt-4o-mini` model via OpenRouter, which streams the formatted response back to the UI.

## 🚀 Getting Started

### 1. Prerequisites

- Node.js >= 18
- A [Supabase](https://supabase.com) project
- An [OpenRouter](https://openrouter.ai) account + API Key
- A [Tavily](https://tavily.com) account + API Key

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# OpenRouter API Key (for LLM and Embeddings)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Tavily Web Search API Key
TAVILY_API_KEY=your_tavily_api_key_here

# Admin Password for the Document Upload Dashboard
ADMIN_PASSWORD=your_secure_password_here
```

### 3. Database Setup

Please see [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for the exact SQL commands to:
- Enable `pgvector`
- Create `kb_documents` and `kb_chunks` tables
- Set up HNSW indexes and match functions

### 4. Running the App Local

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the chat interface.
Navigate to [http://localhost:3000/admin](http://localhost:3000/admin) to manage knowledge base documents.

## 📚 Project Structure

- `app/api/chat/route.js`: Core RAG/Routing logic.
- `app/admin/`: Document management dashboard.
- `app/components/`: Reusable UI elements (ChatInterface, FileUploader, etc.).
- `lib/openrouter.js`: System prompts and LLM setup.
- `lib/supabase.js`: Database interaction & search logic.
- `lib/embeddings.js`: Embedding generation logic.
- `lib/tavily.js`: Fallback internet search.
- `lib/parsers.js` & `lib/chunker.js`: Document processing pipelines.
