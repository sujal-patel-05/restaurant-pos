
import ollama
import os
import requests

def test_ollama():
    print("🔍 Testing Ollama Connection...")
    
    # 1. Check if server is reachable via HTTP
    try:
        response = requests.get("http://localhost:11434")
        if response.status_code == 200:
            print("✅ Ollama server is reachable (http://localhost:11434)")
        else:
            print(f"⚠️ Ollama server responded with status: {response.status_code}")
    except Exception as e:
        print(f"❌ Could not connect to Ollama server: {e}")
        print("   👉 Make sure Ollama is running! Run 'ollama serve' in a terminal.")
        return

    # 2. List available models
    print("\n📦 Checking available models...")
    try:
        models_response = ollama.list()
        # Handle different response formats (object or dict)
        if hasattr(models_response, 'models'):
            models = models_response.models
        elif isinstance(models_response, dict) and 'models' in models_response:
            models = models_response['models']
        else:
            models = models_response
            
        if not models:
            print("❌ No models found!")
            print("   👉 Run 'ollama pull llama2' to download a model.")
        else:
            print(f"✅ Found {len(models)} models:")
            model_names = []
            for m in models:
                # Handle model object or dict
                name = m.model if hasattr(m, 'model') else m.get('name')
                model_names.append(name)
                print(f"   - {name}")
            
            # 3. Test generation
            target_model = os.getenv('OLLAMA_MODEL', 'llama2')
            if target_model not in model_names and f"{target_model}:latest" not in model_names:
                 print(f"\n⚠️ Configured model '{target_model}' not found in list.")
                 print(f"   Using first available model: {model_names[0]}")
                 target_model = model_names[0]
            
            print(f"\n🧠 Testing generation with model: {target_model}...")
            try:
                response = ollama.chat(model=target_model, messages=[
                    {'role': 'user', 'content': 'Say "Hello from Ollama!"'}
                ])
                print(f"✅ Response received: {response['message']['content']}")
            except Exception as e:
                print(f"❌ Generation failed: {e}")

    except Exception as e:
        print(f"❌ Error listing models: {e}")

if __name__ == "__main__":
    test_ollama()
