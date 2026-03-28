"""
Train the Ensemble NLP Classifier
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Run this script to train the SVM model and build
the semantic embedding index.

Usage:
    python train_ensemble.py

Output:
    - ml_models/svm_intent_classifier.pkl
    - ml_models/tfidf_vectorizer.pkl
    - ml_models/intent_embeddings.pkl
    - ml_models/training_metrics.json
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ensemble_classifier import EnsembleIntentClassifier


def main():
    print("\n🚀 Starting Ensemble NLP Training Pipeline...\n")
    metrics = EnsembleIntentClassifier.train_and_save()

    # Print summary
    print("\n📊 FINAL SUMMARY")
    print(f"   SVM Accuracy:       {metrics['svm']['test_accuracy']*100:.1f}%")
    print(f"   SVM Cross-Val:      {metrics['svm']['cross_val_mean']*100:.1f}% ± {metrics['svm']['cross_val_std']*100:.1f}%")
    print(f"   Embedding Accuracy: {metrics['embeddings']['accuracy_on_training_data']*100:.1f}%")
    print(f"   Training Samples:   {metrics['dataset']['total_samples']}")
    print(f"\n✅ Models saved to ml_models/ directory")
    print(f"✅ You can now restart the backend to use the ensemble classifier!\n")


if __name__ == "__main__":
    main()
