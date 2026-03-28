"""Quick test for the Ensemble NLP Classifier"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ensemble_classifier import get_ensemble_classifier

clf = get_ensemble_classifier()
print(f"Models Trained: {clf.is_trained}")
print(f"SVM Model: {'Loaded' if clf.svm_model else 'Missing'}")
print(f"TF-IDF:    {'Loaded' if clf.tfidf_vectorizer else 'Missing'}")
print(f"Embeddings:{'Loaded' if clf.embedding_model else 'Missing'}")
print(f"Emb Index: {'Loaded' if clf.intent_embeddings else 'Missing'}")
print()

test_queries = [
    "What are today's sales?",
    "How much paneer do we have?",
    "Show pending orders",
    "Hello",
    "Which combos should we promote?",
    "Add 2 burgers to table 5",
    "How much wastage this week?",
    "How much does a burger cost?",
    "How much cash did we pull in today?",
    "Dude what's our revenue looking like?",
    "Kaunsa item sabse zyada profitable hai?",
    "Are any ingredients about to expire?",
]

print(f"{'Query':<50} {'Intent':<20} {'Method':<20} {'Conf':>6}")
print("=" * 100)

for query in test_queries:
    result = clf.classify(query)
    print(f"{query:<50} {result['intent']:<20} {result['method']:<20} {result['confidence']:>6.2f}")

print()
print("Test complete!")
