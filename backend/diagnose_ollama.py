
import urllib.request
import json
import os
import sys

def check_ollama():
    print("🔍 Diagnostic Tool for Ollama Integration")
    print("----------------------------------------")
    
    # 1. Check Python environment
    try:
        import ollama
        print(f"✅ 'ollama' package is installed.")
    except ImportError:
        print("❌ 'ollama' package is NOT installed.")
        print("   Run: pip install ollama")
        return

    # 2. Check Ollama Server
    url = "http://localhost:11434/api/tags"
    try:
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                print("✅ Ollama server is running and reachable.")
                data = json.loads(response.read().decode())
                models = data.get('models', [])
                if models:
                    print(f"✅ Found {len(models)} models:")
                    for m in models:
                        print(f"   - {m['name']}")
                else:
                    print("⚠️ No models found. Run 'ollama pull llama2'")
            else:
                print(f"⚠️ Server returned status: {response.status}")
    except Exception as e:
        print(f"❌ Could not connect to Ollama server: {e}")
        print("   Ensure Ollama is running ('ollama serve')")
        return

    # 3. Test Chat Completion
    model = os.environ.get('OLLAMA_MODEL', 'llama2')
    print(f"\n🧠 Testing model '{model}'...")
    
    try:
        import ollama
        response = ollama.chat(model=model, messages=[
            {'role': 'user', 'content': 'Hello!'}
        ])
        print(f"✅ Response: {response['message']['content']}")
    except Exception as e:
        print(f"❌ Model generation failed: {e}")
        if "not found" in str(e):
            print(f"   Run 'ollama pull {model}'")

if __name__ == "__main__":
    check_ollama()
