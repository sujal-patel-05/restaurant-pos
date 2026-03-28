"""
Ensemble NLP Intent Classifier
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Production-grade 3-layer ensemble for restaurant POS intent classification.

Architecture:
  Layer 1: TF-IDF + SVM (scikit-learn) — Fast, trained classifier
  Layer 2: Semantic Embeddings (sentence-transformers) — Deep understanding
  Layer 3: LLM Fallback (Groq Llama 3.3 70B) — Ultimate fallback

The ensemble picks the winner based on confidence scores.
If both Layer 1 & 2 are unsure, it defers to the LLM.
"""

import os
import json
import logging
import pickle
import numpy as np
from typing import Dict, Any, Optional, Tuple, List
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Model storage directory ─────────────────────────────────────
MODEL_DIR = Path(__file__).parent.parent / "ml_models"
SVM_MODEL_PATH = MODEL_DIR / "svm_intent_classifier.pkl"
TFIDF_MODEL_PATH = MODEL_DIR / "tfidf_vectorizer.pkl"
EMBEDDINGS_INDEX_PATH = MODEL_DIR / "intent_embeddings.pkl"
METRICS_PATH = MODEL_DIR / "training_metrics.json"


class EnsembleIntentClassifier:
    """
    3-Layer Ensemble NLP Classifier for restaurant POS queries.

    Layer 1 — TF-IDF + SVM:
        Traditional ML. Converts text to TF-IDF vectors, then classifies
        using a Support Vector Machine with probability estimates.

    Layer 2 — Semantic Embeddings:
        Uses a pre-trained Sentence Transformer (all-MiniLM-L6-v2) to embed
        the query and compare cosine similarity against intent anchor sentences.

    Layer 3 — LLM Fallback:
        When both Layer 1 & 2 have low confidence, the query is sent to
        the Groq LLM for few-shot classification.

    Ensemble Decision Logic:
        - If SVM confidence >= 0.75 AND Embedding similarity >= 0.70 → use SVM
        - If SVM confidence >= 0.80 → use SVM even if embeddings disagree
        - If Embedding similarity >= 0.82 → use Embeddings
        - Otherwise → defer to LLM
    """

    def __init__(self):
        self.svm_model = None
        self.tfidf_vectorizer = None
        self.embedding_model = None
        self.intent_embeddings = None  # {intent: [anchor_embeddings]}
        self.is_trained = False
        self._load_models()

    def _load_models(self):
        """Load pre-trained SVM and embedding index from disk."""
        try:
            # Load SVM + TF-IDF
            if SVM_MODEL_PATH.exists() and TFIDF_MODEL_PATH.exists():
                with open(SVM_MODEL_PATH, "rb") as f:
                    self.svm_model = pickle.load(f)
                with open(TFIDF_MODEL_PATH, "rb") as f:
                    self.tfidf_vectorizer = pickle.load(f)
                logger.info("✅ SVM intent classifier loaded from disk")
            else:
                logger.warning("⚠️ SVM model not found — run train_ensemble.py first")

            # Load Embedding Index
            if EMBEDDINGS_INDEX_PATH.exists():
                with open(EMBEDDINGS_INDEX_PATH, "rb") as f:
                    self.intent_embeddings = pickle.load(f)
                logger.info("✅ Embedding intent index loaded from disk")

            # Load Embedding Model (lazy — downloads on first use)
            try:
                from sentence_transformers import SentenceTransformer
                self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("✅ Sentence Transformer model loaded (all-MiniLM-L6-v2)")
            except Exception as e:
                logger.warning(f"⚠️ Sentence Transformer not available: {e}")
                self.embedding_model = None

            self.is_trained = (
                self.svm_model is not None and
                self.tfidf_vectorizer is not None
            )

        except Exception as e:
            logger.error(f"Failed to load ensemble models: {e}")

    # ── Layer 1: TF-IDF + SVM ───────────────────────────────────

    def _classify_svm(self, text: str) -> Tuple[str, float]:
        """
        Classify using TF-IDF + SVM.
        Returns: (predicted_intent, confidence_probability)
        """
        if not self.svm_model or not self.tfidf_vectorizer:
            return "general", 0.0

        try:
            tfidf_vector = self.tfidf_vectorizer.transform([text.lower()])
            predicted = self.svm_model.predict(tfidf_vector)[0]

            # Get probability distribution
            proba = self.svm_model.predict_proba(tfidf_vector)[0]
            confidence = float(max(proba))

            return predicted, confidence
        except Exception as e:
            logger.error(f"SVM classification error: {e}")
            return "general", 0.0

    # ── Layer 2: Semantic Embeddings ────────────────────────────

    def _classify_embeddings(self, text: str) -> Tuple[str, float]:
        """
        Classify using cosine similarity against intent anchor embeddings.
        Returns: (predicted_intent, max_cosine_similarity)
        """
        if not self.embedding_model or not self.intent_embeddings:
            return "general", 0.0

        try:
            # Embed the query
            query_embedding = self.embedding_model.encode(
                text, convert_to_numpy=True, normalize_embeddings=True
            )

            best_intent = "general"
            best_similarity = 0.0

            for intent, anchor_embeddings in self.intent_embeddings.items():
                # Cosine similarity against all anchors for this intent
                similarities = np.dot(anchor_embeddings, query_embedding)
                max_sim = float(np.max(similarities))

                if max_sim > best_similarity:
                    best_similarity = max_sim
                    best_intent = intent

            return best_intent, best_similarity
        except Exception as e:
            logger.error(f"Embedding classification error: {e}")
            return "general", 0.0

    # ── Ensemble Decision Logic ─────────────────────────────────

    def classify(self, text: str) -> Dict[str, Any]:
        """
        Run all layers and return the ensemble decision.

        Returns:
            {
                "intent": str,
                "confidence": float,
                "method": str,  # "svm", "embeddings", "ensemble", "llm_required"
                "svm_result": {"intent": str, "confidence": float},
                "embedding_result": {"intent": str, "similarity": float},
            }
        """
        # Run Layer 1 & 2 in parallel (conceptually)
        svm_intent, svm_conf = self._classify_svm(text)
        emb_intent, emb_sim = self._classify_embeddings(text)

        result = {
            "svm_result": {"intent": svm_intent, "confidence": round(svm_conf, 4)},
            "embedding_result": {"intent": emb_intent, "similarity": round(emb_sim, 4)},
        }

        # ── Ensemble Decision Rules ──

        # Rule 1: Both agree with high confidence → STRONG match
        if svm_intent == emb_intent and svm_conf >= 0.60 and emb_sim >= 0.55:
            result["intent"] = svm_intent
            result["confidence"] = round(max(svm_conf, emb_sim), 4)
            result["method"] = "ensemble_agree"
            logger.info(
                f"🎯 Ensemble AGREE: '{text[:50]}' → {svm_intent} "
                f"(SVM:{svm_conf:.2f}, EMB:{emb_sim:.2f})"
            )
            return result

        # Rule 2: SVM is very confident → trust SVM
        if svm_conf >= 0.80:
            result["intent"] = svm_intent
            result["confidence"] = round(svm_conf, 4)
            result["method"] = "svm_dominant"
            logger.info(
                f"🔵 SVM dominant: '{text[:50]}' → {svm_intent} ({svm_conf:.2f})"
            )
            return result

        # Rule 3: Embeddings are very confident → trust Embeddings
        if emb_sim >= 0.82:
            result["intent"] = emb_intent
            result["confidence"] = round(emb_sim, 4)
            result["method"] = "embedding_dominant"
            logger.info(
                f"🟢 Embedding dominant: '{text[:50]}' → {emb_intent} ({emb_sim:.2f})"
            )
            return result

        # Rule 4: SVM has decent confidence → use SVM
        if svm_conf >= 0.60:
            result["intent"] = svm_intent
            result["confidence"] = round(svm_conf, 4)
            result["method"] = "svm_fallback"
            logger.info(
                f"🔵 SVM fallback: '{text[:50]}' → {svm_intent} ({svm_conf:.2f})"
            )
            return result

        # Rule 5: Embeddings have decent similarity → use Embeddings
        if emb_sim >= 0.55:
            result["intent"] = emb_intent
            result["confidence"] = round(emb_sim, 4)
            result["method"] = "embedding_fallback"
            logger.info(
                f"🟢 Embedding fallback: '{text[:50]}' → {emb_intent} ({emb_sim:.2f})"
            )
            return result

        # Rule 6: Neither is confident → defer to LLM
        result["intent"] = "general"
        result["confidence"] = 0.0
        result["method"] = "llm_required"
        logger.info(
            f"⚠️ Ensemble unsure: '{text[:50]}' → deferring to LLM "
            f"(SVM:{svm_conf:.2f}/{svm_intent}, EMB:{emb_sim:.2f}/{emb_intent})"
        )
        return result

    # ── Training Methods ────────────────────────────────────────

    @staticmethod
    def train_and_save():
        """
        Train both the SVM classifier and build the embedding index.
        Called from train_ensemble.py script.
        Returns training metrics dict.
        """
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.svm import SVC
        from sklearn.model_selection import (
            train_test_split,
            cross_val_score,
            StratifiedKFold,
        )
        from sklearn.metrics import (
            classification_report,
            confusion_matrix,
            accuracy_score,
        )
        from sentence_transformers import SentenceTransformer
        from services.intent_training_data import TRAINING_DATA, INTENT_ANCHORS

        # Ensure model directory exists
        MODEL_DIR.mkdir(parents=True, exist_ok=True)

        texts = [t[0] for t in TRAINING_DATA]
        labels = [t[1] for t in TRAINING_DATA]

        print(f"\n{'='*60}")
        print(f"  ENSEMBLE NLP CLASSIFIER — TRAINING PIPELINE")
        print(f"{'='*60}")
        print(f"  Total samples:  {len(texts)}")
        print(f"  Intent classes: {len(set(labels))}")
        print(f"  Classes: {sorted(set(labels))}")
        print(f"{'='*60}\n")

        # ── 1. Train TF-IDF + SVM ──────────────────────────────
        print("━━━ LAYER 1: Training TF-IDF + SVM ━━━")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels, test_size=0.2, random_state=42, stratify=labels
        )

        # TF-IDF Vectorization
        tfidf = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),  # Unigrams + bigrams
            sublinear_tf=True,
            min_df=1,
            strip_accents="unicode",
            lowercase=True,
        )
        X_train_tfidf = tfidf.fit_transform(X_train)
        X_test_tfidf = tfidf.transform(X_test)

        # SVM with probability calibration
        svm = SVC(
            kernel="linear",
            C=1.0,
            probability=True,
            class_weight="balanced",
            random_state=42,
        )
        svm.fit(X_train_tfidf, y_train)

        # Evaluate
        y_pred = svm.predict(X_test_tfidf)
        accuracy = accuracy_score(y_test, y_pred)
        report = classification_report(y_test, y_pred, output_dict=True)
        cm = confusion_matrix(y_test, y_pred, labels=sorted(set(labels)))

        print(f"\n  Test Accuracy: {accuracy:.4f} ({accuracy*100:.1f}%)")
        print(f"\n{classification_report(y_test, y_pred)}")

        # Cross-validation
        X_all_tfidf = tfidf.transform(texts)
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(svm, X_all_tfidf, labels, cv=cv, scoring="accuracy")
        print(f"  5-Fold Cross-Validation: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

        # Save SVM & TF-IDF
        with open(SVM_MODEL_PATH, "wb") as f:
            pickle.dump(svm, f)
        with open(TFIDF_MODEL_PATH, "wb") as f:
            pickle.dump(tfidf, f)
        print(f"\n  ✅ SVM model saved to {SVM_MODEL_PATH}")
        print(f"  ✅ TF-IDF vectorizer saved to {TFIDF_MODEL_PATH}")

        # ── 2. Build Embedding Index ───────────────────────────
        print(f"\n━━━ LAYER 2: Building Semantic Embedding Index ━━━")

        emb_model = SentenceTransformer("all-MiniLM-L6-v2")
        intent_embeddings = {}

        for intent, anchors in INTENT_ANCHORS.items():
            embeddings = emb_model.encode(
                anchors, convert_to_numpy=True, normalize_embeddings=True
            )
            intent_embeddings[intent] = embeddings
            print(f"  Encoded {len(anchors):2d} anchors for [{intent}]")

        with open(EMBEDDINGS_INDEX_PATH, "wb") as f:
            pickle.dump(intent_embeddings, f)
        print(f"\n  ✅ Embedding index saved to {EMBEDDINGS_INDEX_PATH}")

        # ── 3. Compile Metrics ─────────────────────────────────
        print(f"\n━━━ TRAINING METRICS ━━━")

        # Test embedding accuracy on training data
        emb_correct = 0
        for text, label in TRAINING_DATA:
            query_emb = emb_model.encode(
                text, convert_to_numpy=True, normalize_embeddings=True
            )
            best_intent = "general"
            best_sim = 0.0
            for intent, anchor_embs in intent_embeddings.items():
                sims = np.dot(anchor_embs, query_emb)
                max_s = float(np.max(sims))
                if max_s > best_sim:
                    best_sim = max_s
                    best_intent = intent
            if best_intent == label:
                emb_correct += 1

        emb_accuracy = emb_correct / len(TRAINING_DATA)

        metrics = {
            "svm": {
                "test_accuracy": round(accuracy, 4),
                "cross_val_mean": round(cv_scores.mean(), 4),
                "cross_val_std": round(cv_scores.std(), 4),
                "classification_report": report,
                "confusion_matrix": cm.tolist(),
                "intent_labels": sorted(set(labels)),
            },
            "embeddings": {
                "model": "all-MiniLM-L6-v2",
                "embedding_dim": 384,
                "total_anchors": sum(len(v) for v in INTENT_ANCHORS.values()),
                "accuracy_on_training_data": round(emb_accuracy, 4),
            },
            "dataset": {
                "total_samples": len(TRAINING_DATA),
                "train_samples": len(X_train),
                "test_samples": len(X_test),
                "intent_distribution": {
                    label: labels.count(label) for label in sorted(set(labels))
                },
            },
        }

        with open(METRICS_PATH, "w") as f:
            json.dump(metrics, f, indent=2)

        print(f"\n  SVM Test Accuracy:      {accuracy*100:.1f}%")
        print(f"  SVM Cross-Val Accuracy: {cv_scores.mean()*100:.1f}% ± {cv_scores.std()*100:.1f}%")
        print(f"  Embedding Accuracy:     {emb_accuracy*100:.1f}%")
        print(f"\n  ✅ Training metrics saved to {METRICS_PATH}")
        print(f"\n{'='*60}")
        print(f"  TRAINING COMPLETE — Ensemble ready for production!")
        print(f"{'='*60}\n")

        return metrics


# ── Singleton ───────────────────────────────────────────────────
_classifier = None

def get_ensemble_classifier() -> EnsembleIntentClassifier:
    """Get or create EnsembleIntentClassifier singleton."""
    global _classifier
    if _classifier is None:
        _classifier = EnsembleIntentClassifier()
    return _classifier
