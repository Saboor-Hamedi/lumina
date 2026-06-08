# NLP — Natural Language Processing

## 1. Introduction

**Natural Language Processing (NLP)** is a subfield of AI, linguistics, and computer science that enables machines to understand, interpret, and generate human language. It bridges the gap between human communication and computational understanding.

### Why NLP Matters

- **Scale**: Billions of documents, messages, and conversations generated daily
- **Automation**: Extract insights from unstructured text automatically
- **Interaction**: Powers chatbots, voice assistants, translation, and search
- **Business value**: Sentiment analysis, topic modeling, document classification, named entity extraction

### Core Challenges

| Challenge | Description |
|-----------|-------------|
| **Ambiguity** | Same word can mean different things ("bank" = river bank vs. financial bank) |
| **Context** | Meaning depends on surrounding words and world knowledge |
| **Sarcasm/Irony** | Literal vs. intended meaning differs |
| **Morphology** | Word forms vary (run, runs, running, ran) |
| **Syntax** | Grammar rules are complex and exception-ridden |

> **Related**: [[Embeddings]], [[Attention]], [[Tokenization]]

---

## 2. Structure of an NLP Pipeline

A typical NLP pipeline follows a layered architecture:

```
Raw Text → Preprocessing → Feature Extraction → Modeling → Post-processing → Output
```

### Layer Breakdown

#### A. Text Acquisition
- Raw text from documents, APIs, web scraping, databases
- Handles encoding (UTF-8, ASCII), file formats (PDF, HTML, JSON)

#### B. Preprocessing
- **Cleaning**: Remove HTML tags, special characters, normalize whitespace
- **Tokenization**: Split text into words/subwords — see [[Tokenization]]
- **Normalization**: Lowercasing, stemming, lemmatization
- **Stop word removal**: Filter common words ("the", "and", "is")
- **Noise removal**: URLs, emojis, punctuation handling

#### C. Feature Extraction
- **Bag-of-Words (BoW)**: Sparse vector of word counts
- **TF-IDF**: Term frequency-inverse document frequency weighting
- **Word Embeddings**: Dense vector representations — see [[Embeddings]]
- **Contextual Embeddings**: BERT, GPT-based representations

#### D. Modeling
- **Classical ML**: Naive Bayes, SVM, Logistic Regression, CRF
- **Deep Learning**: RNNs, LSTMs, Transformers — see [[Attention]]
- **LLMs**: GPT, LLaMA, Claude — see [[AI Agents]]

#### E. Post-processing
- Confidence scoring, entity resolution, output formatting
- Aggregation, ranking, filtering

#### F. Output
- Classification label, extracted entities, generated text, translation, summary

---

## 3. Design Considerations

### Data Quality
- **Garbage in, garbage out**: Clean, representative data is non-negotiable
- **Class imbalance**: Use stratified sampling, weighted loss, or oversampling
- **Annotation consistency**: Inter-annotator agreement (Cohen's Kappa ≥ 0.8)

### Model Selection

| Task | Recommended Approach |
|------|---------------------|
| Sentiment Analysis | Fine-tuned BERT or DistilBERT |
| Named Entity Recognition | BiLSTM-CRF or fine-tuned RoBERTa |
| Text Classification | TF-IDF + Linear SVM (small data) or transformer (large data) |
| Machine Translation | Seq2Seq with Attention or T5 |
| Question Answering | BERT-based extractive or GPT-based generative |
| Text Summarization | BART, Pegasus, or GPT-family |

### Performance Metrics

| Task | Metrics |
|------|---------|
| Classification | Accuracy, Precision, Recall, F1-Score |
| Sequence Labeling | Token-level F1, Entity-level F1 |
| Generation | BLEU, ROUGE, METEOR, BERTScore |
| Retrieval | MRR, MAP, Recall@k, NDCG |

### Deployment Considerations
- **Latency**: Transformer inference can be slow → use distillation (DistilBERT), quantization, or ONNX
- **Memory**: Embedding tables can be large → use pruning or shared embeddings
- **Scalability**: Batch inference, GPU acceleration, model sharding
- **Monitoring**: Track data drift, concept drift, prediction confidence over time

---

## 4. Python Code: Simple NLP Pipeline

Below is a complete, runnable NLP pipeline demonstrating preprocessing, feature extraction, and classification.

```python
# simple_nlp_pipeline.py
# A minimal NLP pipeline for text classification

import re
import string
from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# ── 1. Sample dataset ──────────────────────────────────────────────
documents = [
    "I love this product, it works great!",
    "Terrible service, very disappointed.",
    "Absolutely amazing quality and fast shipping.",
    "Waste of money, do not buy this.",
    "Pretty good, exceeded my expectations.",
    "Horrible experience, never again.",
    "Decent quality for the price.",
    "Awful customer support and broken item.",
    "Fantastic! Highly recommend to everyone.",
    "Not worth it, poor build quality.",
]

labels = [
    "positive", "negative", "positive", "negative", "positive",
    "negative", "positive", "negative", "positive", "negative",
]

# ── 2. Preprocessing function ──────────────────────────────────────
def clean_text(text: str) -> str:
    """
    Basic text cleaning:
    - Lowercase
    - Remove punctuation
    - Remove extra whitespace
    """
    text = text.lower()
    text = re.sub(f"[{re.escape(string.punctuation)}]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# Apply cleaning
documents_clean = [clean_text(doc) for doc in documents]

print("=== Cleaned Documents ===")
for orig, clean in zip(documents, documents_clean):
    print(f"  {orig:55s} → {clean}")

# ── 3. Build pipeline ──────────────────────────────────────────────
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        max_features=100,        # keep top 100 terms
        ngram_range=(1, 2),      # unigrams + bigrams
        stop_words="english",    # remove common stop words
    )),
    ("clf", MultinomialNB()),    # fast, interpretable classifier
])

# ── 4. Train / evaluate ────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    documents_clean, labels, test_size=0.3, random_state=42
)

pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_test)

print("\n=== Classification Report ===")
print(classification_report(y_test, y_pred, zero_division=0))

# ── 5. Predict on new text ─────────────────────────────────────────
new_reviews = [
    "This is the best purchase I've ever made!",
    "Cheap materials, broke in a week.",
]

print("=== New Predictions ===")
for review in new_reviews:
    cleaned = clean_text(review)
    pred = pipeline.predict([cleaned])[0]
    probs = pipeline.predict_proba([cleaned])[0]
    confidence = max(probs)
    print(f"  '{review}'")
    print(f"    → {pred} (confidence: {confidence:.2f})\n")

# ── 6. Inspect most informative features ───────────────────────────
feature_names = pipeline.named_steps["tfidf"].get_feature_names_out()
class_log_probs = pipeline.named_steps["clf"].feature_log_prob_

print("=== Top Features per Class ===")
for i, class_label in enumerate(pipeline.named_steps["clf"].classes_):
    top_indices = np.argsort(class_log_probs[i])[-5:][::-1]
    top_features = [(feature_names[j], class_log_probs[i][j]) for j in top_indices]
    print(f"  {class_label}: {[f[0] for f in top_features]}")
```

### Expected Output (approximate)

```
=== Cleaned Documents ===
  I love this product, it works great!              → i love this product it works great
  Terrible service, very disappointed.              → terrible service very disappointed
  ...

=== Classification Report ===
              precision    recall  f1-score   support
    negative       1.00      1.00      1.00         2
    positive       1.00      1.00      1.00         1
```

### Going Further

| Enhancement | Library/Tool |
|-------------|-------------|
| Word embeddings | `gensim` for Word2Vec, `sentence-transformers` for BERT embeddings |
| Deep learning | `transformers` (Hugging Face) for BERT, GPT, T5 |
| Sequence labeling | `spaCy` or `stanza` for NER, POS tagging |
| Large-scale processing | `spaCy` with `transformers` pipeline, `datasets` library |
| Production deployment | `FastAPI` + `ONNX Runtime` for low-latency serving |

> **See also**: [[Embeddings]] for vector representations, [[Attention]] for the transformer mechanism, [[RAG]] for retrieval-augmented generation pipelines.

---

*Last updated: 2025-04-02*
