# Ollama Local LLM Setup Guide

## Overview

The Ask-AI chatbot can now run entirely locally using **Ollama**, ensuring privacy and zero API costs. It uses open-source models like Llama 2 or Mistral to provide intelligent, context-aware responses.

---

## 🚀 Setup Instructions

### 1. Install Ollama
Download and install Ollama from the official website:
- **Windows/Mac/Linux**: [https://ollama.com/download](https://ollama.com/download)

### 2. Pull a Model
Open your terminal/command prompt and pull a model (e.g., Llama 2):
```bash
ollama pull llama2
```
*Note: You can also use other models like `mistral`, `gemma`, etc.*

### 3. Start Ollama Server
Make sure Ollama is running:
```bash
ollama serve
```

### 4. Configure Backend
The backend is already configured to use Ollama by default if available.
Check `backend/.env` settings:
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

---

## 🔄 Switching Models

To use a different model (e.g., Mistral):

1. Pull the model:
   ```bash
   ollama pull mistral
   ```

2. Update `backend/.env`:
   ```bash
   OLLAMA_MODEL=mistral
   ```

3. Restart the backend server.

---

## 🎯 Features

✅ **100% Local** - No data leaves your machine
✅ **Zero Cost** - No API fees
✅ **Privacy** - Secure and private
✅ **Flexible** - Switch between Llama 2, Mistral, Gemma, etc.
✅ **Intelligent** - Same capabilities as cloud LLMs (Intent Classification, Contextual Responses)

---

## ⚠️ Troubleshooting

**"Ollama service not available"**
- Ensure Ollama app is running
- Verify `OLLAMA_BASE_URL` is accessible (default: http://localhost:11434)

**Slow Responses / Stuck on "Thinking..."**
- Local LLM speed depends on your hardware (CPU/GPU).
- **Solution:** Switch to a faster model!
  1. Pull a smaller model: `ollama pull tinyllama` or `ollama pull llama3`
  2. Update `.env`: `OLLAMA_MODEL=tinyllama`
  3. Restart backend.
- **Recommended Models:**
  - `llama3` (8GB RAM required, fast & smart)
  - `tinyllama` (Very fast, runs on anything)
  - `phi` (Microsoft's small model)

**Fallback**
- If Ollama is offline, the system automatically falls back to the rule-based engine.
