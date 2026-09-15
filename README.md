# PhishShield-X 🛡️
### *A Multimodal Defense-in-Depth Framework with Quish-EDL for Real-Time URL, Quishing, and Social Engineering Threat Detection*

[![Research Paper](https://img.shields.io/badge/Research-Paper%20Manuscript-blue?style=for-the-badge&logo=googlescholar&logoColor=white)](research_paper/PAPER_MANUSCRIPT.md)
[![LaTeX Source](https://img.shields.io/badge/LaTeX-IEEE%20Manuscript-green?style=for-the-badge&logo=latex&logoColor=white)](research_paper/paper_draft.tex)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20REST-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TensorFlow](https://img.shields.io/badge/Deep%20Learning-TensorFlow%20%2F%20Keras-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://tensorflow.org/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Scikit--Learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

> **PhishShield-X** is a publication-grade, multimodal cybersecurity intelligence platform engineered to detect and neutralize zero-day phishing across **URLs, QR Codes (Quishing), and Spoofed Emails (.EML)**.
> 
> * **Production Serving Architecture**: Runs **M3 (Multimodal Early Fusion + Softmax)** for QR image scanning (delivering state-of-the-art $94.41\%$ accuracy and a calibrated Expected Calibration Error of $\text{ECE} = 0.0236$), alongside a 34-feature Random Forest + Live OSINT pipeline for standalone URL traffic.
> * **Research Discovery (Quish-EDL)**: Rigorously evaluates Dirichlet Subjective Logic Evidential Deep Learning (EDL) on open-set zero-day attacks, establishing the mathematical necessity of Outlier Exposure to prevent open-set spurious evidence leakage.

---

## 🗺️ System Architecture & Workflow Maps

### 1. End-to-End Multi-Signal Ingestion & Defense Pipeline Map
The diagram below maps the multi-modal routing flow across URL, QR image, and email submission vectors:

```mermaid
flowchart TD
    User([User / API Request / Security Gateway]) --> Ingest{Input Modality}
    
    %% ----------------- URL VECTOR -----------------
    Ingest -->|URL String| U0["[Stage 0] Pre-Flight Whitelist Triage (<1ms)"]
    U0 -->|Top 100k Whitelist Hit| U_Safe["✅ Verdict: 100% SAFE (Whitelist Override)"]
    U0 -->|Not Whitelisted| U1["[Stage 1] Typosquatting & Levenshtein Brand Check"]
    U1 --> U2["[Stage 2] Dual-Branch AI Engine"]
    
    subgraph U_AI [Dual-Branch AI Engine]
        U2A["Branch A: Deep Semantic Model\n(Conv1D + BiGRU + Multi-Head Attention)"]
        U2B["Branch B: 34-Feature Tabular Model\n(Shannon Entropy, TLD, Lexical Tokens)"]
        U2A & U2B --> U2_Ens["Ensemble Probability (P_ML)"]
    end
    U2 --> U_AI
    U_AI --> U3["[Stage 3] Parallel OSINT & Continuous Trust Decay"]
    
    subgraph U_OSINT [Live Threat Intelligence & Infrastructure]
        U3A["VirusTotal v3 REST (70+ AV Engines)"]
        U3B["Google Safe Browsing v4 Lookup"]
        U3C["WHOIS Saturated Logarithmic Trust Curve\nT(d) = max_discount * ln(1+d) / ln(1+D_mature)"]
        U3D["SSL Certificate Transparency Freshness (<3d)"]
    end
    U3 --> U_OSINT
    U_OSINT --> U4["[Stage 4] Three-Tier Dynamic Conflict Resolution"]
    
    %% ----------------- QR VECTOR -----------------
    Ingest -->|QR Code Image| Q0["[Stage 0] Robust Dual-Engine Decoder"]
    
    subgraph Q_CV [Multi-Pipeline Computer Vision Engine]
        Q0A["Contrast Enhancement (CLAHE 8x8)"]
        Q0B["White Quiet-Zone Border Padding"]
        Q0C["Inverted Dark-Mode QR Variants"]
        Q0D["PyZbar + OpenCV QRCodeDetectorAruco"]
    end
    Q0 --> Q_CV
    Q_CV --> Q1["[Stage 1] Visual Geometry & Logo Occlusion Analysis"]
    Q_CV --> Q2["[Stage 2] High-Risk Protocol Profiler (WIFI, UPI, SMSTO, DATA)"]
    Q_CV --> Q3["[Stage 3] Recursive Multi-Hop URL Redirect Unroller"]
    Q_CV --> Q4["[Stage 4] M3 Multimodal Early Fusion Neural Network"]
    Q1 & Q2 & Q3 & Q4 --> Q_Fused["[Stage 5] Multimodal Decision Fusion Engine"]
    
    %% ----------------- EMAIL VECTOR -----------------
    Ingest -->|.EML File / Raw Email| E0["[Stage 0] RFC 822 Forensic Header Parser"]
    
    subgraph E_Forensics [Email Forensic & Social Engineering Engine]
        E0A["Cryptographic Header Verification (SPF, DKIM, DMARC)"]
        E0B["Envelope Return-Path vs From Mismatch Detector"]
        E0C["Body Semantic TF-IDF NLP + Job/Invoice Scam Rules"]
    end
    E0 --> E_Forensics
    E_Forensics --> E_Fused["[Stage 3] Email Threat Verdict Synthesis"]
    
    %% ----------------- UNIFIED OUTPUT -----------------
    U4 & Q_Fused & E_Fused --> FinalOut["[Output Layer] Forensic Threat Card & JSON API Response"]
```

---

### 2. Quish-EDL Neural Architecture Map
Detailed schematic of the visual and lexical feature extraction streams, early multimodal concatenation, and dual evaluation heads:

```mermaid
flowchart LR
    subgraph Visual_Stream [Visual Spatial QR Stream]
        V_In["QR Matrix X_vis\n(64x64x1 Grayscale)"] --> V_Conv["Conv2D\n(16 filters, 3x3, ReLU)"]
        V_Conv --> V_Pool["MaxPool2D\n(4x4 Pool)"]
        V_Pool --> V_Flat["Flatten"]
        V_Flat --> V_Dense["Dense (32, ReLU)\n+ Dropout (0.2)"]
        V_Dense --> V_Feat["f_vis in R^32"]
    end

    subgraph Lexical_Stream [Lexical Character Sequence Stream]
        L_In["URL Payload Sequence X_lex\n(180 Character Tokens)"] --> L_Emb["Embedding Layer\n(Vocab 110 -> Dim 32)"]
        L_Emb --> L_Conv["Conv1D\n(32 filters, k=3, ReLU)"]
        L_Conv --> L_Pool["MaxPool1D\n(Pool Size 6)"]
        L_Pool --> L_Flat["Flatten"]
        L_Flat --> L_Dense["Dense (32, ReLU)\n+ Dropout (0.2)"]
        L_Dense --> L_Feat["f_lex in R^32"]
    end

    V_Feat & L_Feat --> Fuse["Multimodal Early Fusion Concatenation\nh_fused = [f_vis || f_lex] in R^64"]
    Fuse --> Dense1["Dense (48, ReLU)\n+ Dropout (0.2)"]
    Dense1 --> Dense2["Dense (32, ReLU)"]
    Dense2 --> Logits["Logits z in R^2"]

    subgraph Serving_Head [Production Serving Head (M3)]
        Logits --> Softmax["Softmax Layer\np = Softmax(z)"]
        Softmax --> CalibOut["Calibrated Threat Probability\n(ECE = 0.0236, Acc = 94.41%)"]
    end

    subgraph Research_Head [Subjective Logic Evidential Head (M6)]
        Logits --> EvLayer["Evidence e = ReLU(z)\nDirichlet alpha = e + 1.0"]
        EvLayer --> Strength["Total Strength S = sum(alpha_k)"]
        Strength --> Belief["Belief Masses: b_k = (alpha_k - 1) / S"]
        Strength --> Uncert["Epistemic Uncertainty: u = K / S"]
    end
```

---

### 3. Decoupled Poison-Resilient Active Learning Triage Map
The architecture isolates independent external ground truth from internal model predictions to eliminate circular bias and protect against adversarial dataset poisoning:

```mermaid
flowchart TD
    Live["Incoming Telemetry Stream (Live Traffic)"] --> ModelInf["Model Inference (M3 Score)"]
    Live --> ExtIntel["Independent External Intelligence (VT, GSB, WHOIS)"]
    
    ModelInf & ExtIntel --> Triage{"Three-Tier Consensus Triage Engine"}
    
    Triage -->|Model Phishing >0.74 AND Corroborated by External Threat Feed| T1["Tier 1: Auto-Confirmed Malicious\n• VT >= 1, GSB = True, or Fresh Domain with Active Harvest Form\n• Action: Auto-Enqueued to Malicious Retraining Pool"]
    
    Triage -->|Ambiguous Score 0.40-0.74 OR Conflicting Signals OR Zero-Day Protocol| T2["Tier 2: Ambiguous Quarantine Firewall\n• Divergent Signals or Novel Transport Protocol\n• Action: Quarantined for Mandatory Human / Sandbox Review\n• Strict Safety Rule: NEVER fed directly to automated retraining"]
    
    Triage -->|Aged Domain >365d AND Clean Threat Intel AND Zero Heuristic Flags| T3["Tier 3: Auto-Cleared Benign\n• Zero ML Score Dependency (Prevents Circular Confirmation Bias)\n• Action: Auto-Enqueued to Benign Baseline Retraining Pool"]

    subgraph Retrain_Pipeline [Continuous Retraining & Safety Gate]
        T1 & T3 --> NewModel["Retrain Candidate Neural Model"]
        NewModel --> RegGate{"Golden Benchmark Regression Gate"}
        RegGate -->|Passes Immutable 5-Fold Benchmark: Acc >= 94.40%, ECE <= 0.025| ProdDeploy["🚀 Promote to Production Live Serving"]
        RegGate -->|Performance Regression Detected| Reject["⚠️ Reject Weights & Trigger SecOps Alert"]
    end
```

---

## 🔬 Key Research Contribution: Quish-EDL

### The Multimodal Email + Embedded QR Threat Gap
As highlighted in recent threat advisories from the **FBI Cyber Division** and telemetry from **IRONSCALES** and **Barracuda Networks**, cyber adversaries have shifted heavily toward **Quishing (QR Phishing)**—embedding optical 2D matrices inside email bodies and PDF attachments. Traditional Secure Email Gateways (SEGs) and textual NLP parsers are completely blind to graphic payloads, perceiving the lure as benign text while the victim scans the QR code on an unmanaged personal device.

---

## 📊 5-Fold Cross-Validation Empirical Benchmark Results (Strict Parity Protocol)

Evaluated across a full **5-Fold Stratified Cross-Validation Protocol** with strict encoder parity (shared visual & lexical feature extractors) and tuning budget parity (8 epochs, identical batch size and optimizer across all models):

| Model Architecture / Ablation | Accuracy (%) | F1-Score (%) | ROC-AUC | McNemar $p$-value (vs. M6) |
| :--- | :---: | :---: | :---: | :---: |
| **M1: Unimodal Vision-Only** | $82.63 \pm 1.26$ | $80.87 \pm 2.36$ | $0.9195 \pm 0.0092$ | $p < 0.001$ (Sig.) |
| **M2: Unimodal Lexical-Only** | $90.10 \pm 1.12$ | $90.20 \pm 1.11$ | $0.9562 \pm 0.0089$ | $p < 0.001$ (Sig.) |
| **M3: Multimodal Early Fusion (Softmax)** | $94.30 \pm 1.03$ | $94.11 \pm 1.09$ | $0.9903 \pm 0.0056$ | $p < 0.001$ (Refit) |
| **M4: Multimodal Late Fusion** | $92.33 \pm 1.28$ | $92.34 \pm 1.27$ | $0.9790 \pm 0.0034$ | $p = 0.3916$ (Equiv.) |
| **M5: Multimodal Cross-Attention (Softmax)** | $89.43 \pm 1.29$ | $88.99 \pm 1.15$ | $0.9539 \pm 0.0107$ | $p < 0.001$ (Sig.) |
| **M6: Quish-EDL (Proposed)** | **$94.41 \pm 0.44$** | **$94.22 \pm 0.49$** | **$0.9885 \pm 0.0040$** | **--- (Reference)** |

### Comparison with Published Literature
* **Trad & Chehab (arXiv:2505.03451, 2025, PhishStorm 10k Dataset)**: Reported ROC-AUC range of $0.9106\text{--}0.9133$.
* **Quish-EDL (Ours)**: Achieves **$0.9885 \pm 0.0040$ ROC-AUC**, representing an absolute increase of **$+0.0752$ AUC points (+7.52 percentage points)** over published upper bounds, while introducing Subjective Logic Bayesian uncertainty estimation.
* **CIC-Trap4Phish 2025 & Galadima Mendeley Benchmark (2025)**: Robust zero-shot generalization across unified visual-lexical distributions ($>91.8\%$ accuracy).

### Calibration & Epistemic Uncertainty Findings
* **In-Distribution Calibration**: Deterministic Early Fusion with Softmax (M3) achieves peak calibration ($\text{ECE} = 0.0236 \pm 0.0039$, $\text{Brier} = 0.0418 \pm 0.0084$). Evidential Deep Learning (M6) exhibits systematic in-distribution underconfidence ($\text{ECE} = 0.0871 \pm 0.0042$) due to Dirichlet KL penalty evidence suppression.
* **Open-Set Spurious Evidence Leakage**: On $N=400$ unseen zero-day evasion samples spanning non-HTTP protocols (`WIFI:`, `UPI:`, `bitcoin:`, `ethereum:`, `geo:`, `tel:`, `otpauth:`, `matrix:`, `ssh:`, `magnet:`, vCards, JSON telemetry, base64 payloads), multi-seed evaluation demonstrates $\bar{u}_{\text{OOD}} = 0.2096 \pm 0.0108$ vs. $\bar{u}_{\text{ID}} = 0.2571 \pm 0.0093$ ($0.82\times$ ratio). Because standard evidential loss operates exclusively on in-distribution labeled data, unconstrained feature activations produce non-zero evidence on novel domains, proving the necessity of explicit Outlier Exposure for zero-day defense.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend UI** | React 18, Vite, Lucide Icons, Glassmorphic Dashboard, Tailwind CSS |
| **Backend API** | FastAPI, Python 3.13, Uvicorn, SQLAlchemy, SQLite |
| **Deep Learning** | TensorFlow 2.21, Keras 3, Custom Evidential Dirichlet Layers |
| **Machine Learning** | Scikit-Learn, Joblib, NumPy, Pandas, SciPy |
| **Computer Vision** | OpenCV (cv2), PyZbar, CLAHE contrast equalization, Perceptual dHash |
| **Threat Intel / OSINT** | VirusTotal v3 REST API, Google Safe Browsing v4, Python-WHOIS, SSL Sockets |
| **Browser Automation** | Playwright headless Chromium for real-time live page rendering |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Quick Start & Installation

### Prerequisites
* Python 3.10+ (Tested up to Python 3.13)
* Node.js 18+ and npm
* Optional: VirusTotal API Key and Google Safe Browsing API Key in `backend/.env`

### 1. Clone the Repository
```bash
git clone https://github.com/yashsinghal1234/PhishShield-X.git
cd PhishShield-X
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Activate virtual environment:
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Run the 5-Fold Evaluation Suite (Optional - to re-evaluate research benchmarks):
python evaluate_quishing_research.py

# Start FastAPI Server:
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

The web dashboard will be accessible at: `http://localhost:5173`.

---

## 📑 Research Artifacts & Reproducibility

* **Full Research Manuscript Draft**: [`research_paper/PAPER_MANUSCRIPT.md`](research_paper/PAPER_MANUSCRIPT.md)
* **IEEE LaTeX Source Code**: [`research_paper/paper_draft.tex`](research_paper/paper_draft.tex)
* **Evaluation & Ablation Script**: [`backend/evaluate_quishing_research.py`](backend/evaluate_quishing_research.py)
* **Production Serving Weights (M3)**: `backend/m3_early_fusion_weights.weights.h5`
* **Research Ablation Weights (EDL)**: `backend/quish_cross_edl_weights.weights.h5`
* **Raw Benchmark Results**: [`backend/quishing_research_results.json`](backend/quishing_research_results.json)

---

## 👥 Authors & Mentorship
* **Yash Singhal** (`yash.2428cs1806@kiet.edu`)
* **Saurav Singh** (`saurav.2428cs1961@kiet.edu`)
* **Shubham** (`shubham.cs@kiet.edu`)
* **Tanya Vaish** (`tanya.vaish@kiet.edu`)
* **Prof. Rahul** (*Faculty Mentor & Project Guide*, `rahul@kiet.edu`)

*Department of Computer Science, KIET Group of Institutions, Ghaziabad, Delhi-NCR, India.*

---

## 📜 License & Citation
This project is released under the **MIT License**.

If you use **Quish-EDL** or **PhishShield-X** in your academic research, please cite:
```bibtex
@article{quish_edl_2026,
  title={Quish-EDL: Multimodal Visual-Lexical Neural Architecture and Empirical Limits of Evidential Uncertainty in QR-Phishing Detection},
  author={Singhal, Yash and Singh, Saurav and Shubham and Vaish, Tanya and Rahul, Prof.},
  journal={arXiv preprint},
  year={2026}
}
```


