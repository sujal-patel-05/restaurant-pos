# Gemini API Setup Guide

## Get Your Gemini API Key

1. **Visit Google AI Studio**
   - Go to: https://makersuite.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key**
   - Click "Create API Key"
   - Copy the generated key

3. **Add to Environment**
   - Open `backend/.env` file
   - Add: `GEMINI_API_KEY=your-actual-api-key-here`

## Install Dependencies

```bash
cd backend
pip install google-generativeai==0.3.2
```

## Test the Integration

The AI chatbot will automatically use Gemini if the API key is configured. If not, it falls back to rule-based responses.

**Test with:**
- "What are today's sales?"
- "Add 2 burgers to table 5"
- "Which items are low in stock?"

## Features with Gemini

✅ **Intelligent Intent Classification** - Better understanding of user queries
✅ **Contextual Responses** - More natural, conversational answers
✅ **Flexible Query Handling** - Understands variations and complex questions
✅ **Automatic Fallback** - Uses rule-based system if Gemini is unavailable

## Free Tier Limits

- **60 requests per minute**
- **1,500 requests per day**
- Perfect for development and small-scale production

## Troubleshooting

**Error: "GEMINI_API_KEY not found"**
- Make sure you added the key to `.env` file
- Restart the backend server after adding the key

**Slow responses**
- First request may be slower (model initialization)
- Subsequent requests are faster

**Fallback to rule-based**
- Check if API key is valid
- Check internet connection
- Review backend logs for errors
