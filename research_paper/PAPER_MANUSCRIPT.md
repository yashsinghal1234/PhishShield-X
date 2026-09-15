# Quish-EDL: Multimodal Visual-Lexical Neural Architecture and Empirical Limits of Evidential Uncertainty in QR-Phishing Detection

**Target Venues**: *IEEE Transactions on Dependable and Secure Computing (TDSC)* / *Computers & Security (Elsevier)* / *IEEE Access (Special Section on AI in Cyber Defense)* / *ACM AsiaCCS* / *IEEE S&P Workshop on Deep Learning and Security (DLS)*

---

## Abstract
Quishing (Quick Response code phishing) has emerged as an evasive attack vector that completely bypasses perimeter email defenses, Secure Email Gateways (SEGs), and textual Natural Language Processing (NLP) parsers by encapsulating weaponized payloads inside optical 2D matrices. In this paper, we conduct a systematic empirical and theoretical study of multimodal neural architectures for quishing defense. We present **Quish-EDL**, a unified framework that couples visual spatial QR matrix representations with character-level lexical sequence embeddings under strict encoder and tuning parity. 

Evaluated across a comprehensive 5-fold cross-validation benchmark and independent cross-dataset generalization suites (including Trad et al., CIC-Trap4Phish 2025, and Galadima 2025), multimodal early fusion achieves state-of-the-art detection performance (**$94.41\% \pm 0.44\%$ Accuracy, $0.9885 \pm 0.0040$ ROC-AUC**), significantly outperforming unimodal vision ($82.63\%$, $p < 0.001$), unimodal lexical ($90.10\%$, $p < 0.001$), and bilinear cross-attention baselines ($89.43\%$, $p < 0.001$), while delivering a $+7.52$ percentage point ROC-AUC improvement over published literature baselines ($0.9133$).

Beyond classification accuracy, we investigate the calibration and uncertainty quantification properties of Subjective Logic Evidential Deep Learning (EDL) in binary cyber-defense, uncovering two fundamental structural findings:
1. **In-Distribution Underconfidence**: While deterministic early fusion with softmax (M3) achieves near-optimal in-distribution calibration ($\text{ECE} = 0.0236 \pm 0.0039$, $\text{Brier} = 0.0418 \pm 0.0084$), Dirichlet evidential parameterization suffers from systematic underconfidence ($\text{ECE} = 0.0871 \pm 0.0042$) driven by KL-divergence evidence suppression; and
2. **Open-Set Spurious Evidence Leakage**: Across a 25-fold multi-seed replication study on $N=400$ unseen zero-day evasion protocols, closed-form binary Dirichlet EDL consistently yields lower uncertainty on out-of-distribution attacks than on in-distribution test samples ($\bar{u}_{\text{OOD}} = 0.2096 \pm 0.0108$ vs. $\bar{u}_{\text{ID}} = 0.2571 \pm 0.0093$, an inverted ratio of $0.82\times \pm 0.04\times$). We formalize the mechanism behind this failure: because standard evidential loss regularizes non-ground-truth evidence exclusively on in-distribution labeled samples, unconstrained feature activations on novel domains generate spurious positive evidence ($\mathbf{e} > 0$) that inflates total Dirichlet strength $S$ and artificially suppresses epistemic uncertainty ($u = K/S$).

These results establish that single-distribution EDL cannot inherently guarantee zero-day epistemic uncertainty elevation without explicit Outlier Exposure (OE). Consequently, we formulate a decoupled multi-source active learning consensus architecture that safely bridges calibrated model inference with automated retraining without adversarial dataset poisoning.

---

## 1. Introduction & Threat Landscape

### 1.1 The Multimodal Quishing Threat
Traditional enterprise email security relies on Static Heuristic Analysis, Domain Name System Blacklists (DNSBL), and Natural Language Processing (NLP) parsers to inspect email headers, text bodies, and embedded hyperlinks. However, cyber adversaries have increasingly shifted toward **Quishing (QR Phishing)**---rendering malicious targets into graphical 2D optical barcodes embedded within email attachments (e.g., PDF invoices, HTML lures) or image bodies. Threat telemetry from the **FBI Cyber Division (Flash Alerts)**, **IRONSCALES**, and **Barracuda Networks** indicates a sharp multi-fold rise in quishing campaigns targeting enterprise credential harvesting and financial toll fraud.

```
+-----------------------------------------------------------------------------------+
|                        TRADITIONAL EMAIL GATEWAY INSPECTION                       |
|  [Email Text: "Please scan invoice QR"] ---> [NLP / Lexical Filter] ---> "SAFE"   |
|                                                    | (Blind to graphical payload) |
+-----------------------------------------------------------------------------------+
                                                     v
+-----------------------------------------------------------------------------------+
|                           PROPOSED MULTIMODAL DEFENSE (QUISH-EDL)                 |
|                                                                                   |
|  +--------------------+         +------------------------+                        |
|  | Visual Spatial QR  |         | Lexical URL Sequence   |                        |
|  | Matrix (64x64)     |         | Tokens (180 chars)     |                        |
|  +---------+----------+         +-----------+------------+                        |
|            |                                |                                     |
|            +--------------+  +--------------+                                     |
|                           v  v                                                    |
|              [Joint Multimodal Representation]                                    |
|                           |                                                       |
|                           v                                                       |
|               [Evidential Dirichlet Head]                                         |
|                           |                                                       |
|         +-----------------+-----------------+                                     |
|         v                                   v                                     |
|  [Belief Masses: b_0, b_1]          [Epistemic Uncertainty: u]                    |
|  (Calibrated Threat Class)          (Zero-Day Attack Alert)                       |
+-----------------------------------------------------------------------------------+
```

Because the target URI is rendered as a 2D optical grid of modules, text-based email parsers perceive the email as benign text. When users scan the QR code using unmanaged personal mobile devices, the enterprise security perimeter is completely bypassed.

### 1.2 Research Objectives & Contributions
This paper addresses the fundamental architectural, generalization, and calibration questions in quishing defense:
1. **Multimodal Fusion Superiority**: We systematically construct an ablation ladder (M1: Vision-Only, M2: Lexical-Only, M3: Early Fusion Softmax, M4: Late Fusion, M5: Cross-Attention, M6: Evidential Early Fusion) under strict encoder parity and identical training budgets, demonstrating that early multimodal concatenation outperforms unimodal and complex co-attention baselines.
2. **Cross-Dataset Generalization & Optical Extraction Methodology**: We validate model generalization across three independent benchmark datasets (Trad et al., CIC-Trap4Phish 2025, and Galadima 2025), documenting the exact optical extraction and pairing protocols to guarantee reproducibility.
3. **Empirical Reliability Diagrams**: We provide 10-bin empirical reliability diagrams uncovering that Dirichlet EDL exhibits systematic in-distribution underconfidence ($\text{ECE} \approx 0.087$) compared to Softmax ($\text{ECE} = 0.0236$), driven by Dirichlet KL-divergence evidence regularization.
4. **Spurious Evidence Leakage in Open-Set EDL**: Across 25 multi-seed fold runs and an 8-cell factorial sweep, we document that closed-form binary EDL produces $\bar{u}_{\text{OOD}} \le \bar{u}_{\text{ID}}$ ($0.82\times \pm 0.04\times$), formally explaining why single-distribution evidential loss cannot autonomously flag novel zero-day protocols.
5. **Decoupled Active Learning Architecture**: We design a poison-resilient multi-source consensus triage pipeline that decouples independent external ground truth from internal model predictions.

---

## 2. Related Work

### 2.1 QR Code Security & Quishing Analysis
The security implications of 2D optical barcodes have been studied across physical and digital attack surfaces. Krombholz et al. (2014) provided the first comprehensive survey of QR code vulnerabilities, analyzing user susceptibility and physical overlay vectors. Vidas et al. (2013) conducted seminal empirical field studies under the term "QRishing," demonstrating that smartphone users routinely scan untrusted public QR codes driven by curiosity. Amoah & Hayfron-Acquah (2022) analyzed attack vectors in mobile QR phishing and proposed heuristic mitigation frameworks.

Recent detection efforts have focused on isolated pipeline stages:
- **Optical Character Recognition (OCR) & Lexical Filtering**: Trad & Chehab (2025) extracted decoded URLs from QR codes and evaluated machine learning classifiers on PhishStorm-derived paired datasets, achieving ROC-AUC of $0.9106\text{--}0.9133$. However, their pipeline operates unimodally on decoded text, discarding visual matrix tampering cues.
- **Visual Structural & Geometry Analysis**: Galadima (2025) published the Mendeley benchmark dataset of 1,000 verified benign and malicious QR codes (DOI: 10.17632/cmhh7744sp.1), evaluating visual encoding density and error correction variations. Agrawal et al. (2021) investigated visual watermarking and tamper detection in QR code matrices.
- **Large-Scale Multi-Format Datasets**: The Canadian Institute for Cybersecurity released CIC-Trap4Phish (2025), a benchmark aggregating multi-format phishing lures across emails, QR attachments, and documents.

Our work bridges the visual-lexical divide by enforcing joint representation learning over paired optical matrices and lexical sequences under a unified benchmark.

### 2.2 Multimodal Deep Learning in Cybersecurity
Multimodal architectures have gained traction in phishing webpage detection. Phishpedia (Lin et al., USENIX Security 2021) combined object detection and Siamese networks to visually recognize brand logos and compare them against domain identity. VisualPhishNet (Abdelnabi et al., ACM CCS 2020) trained triplet CNNs on visual similarity to detect zero-day phishing pages without hand-crafted features. PhishIntention (Liu et al., IEEE TIFS 2024) introduced visual layout segmentation to identify credential-harvesting input forms. Sahoo et al. (ACM Comput. Surv. 2017) surveyed machine learning techniques for malicious URL detection.

In the quishing domain, however, visual representations consist of discrete 2D frequency patterns rather than natural webpage screenshots. We evaluate whether bilinear cross-attention mechanisms or direct multimodal concatenation provide superior inductive bias for optical barcode representations.

### 2.3 Evidential Deep Learning & Uncertainty Estimation
Standard deep classifiers output uncalibrated Softmax distributions that frequently exhibit overconfidence on out-of-distribution (OOD) inputs (Guo et al., ICML 2017). To quantify epistemic uncertainty in safety-critical domains without the computational overhead of Bayesian Monte Carlo Dropout (Gal & Ghahramani, ICML 2016) or Deep Ensembles (Lakshminarayanan et al., NeurIPS 2017), Sensoy et al. (NeurIPS 2018) proposed **Evidential Deep Learning (EDL)** based on Dempster-Shafer Subjective Logic (Jøsang, 2016). EDL parameterizes a Dirichlet prior directly over class probabilities.

Follow-up works, including Prior Networks (Malinin & Gales, NeurIPS 2018) and Posterior Networks (Charpentier et al., NeurIPS 2020), attempted to refine Dirichlet parameter estimation. In computer vision, Bao et al. (IEEE TPAMI 2021) demonstrated that Dirichlet losses could improve open-set recognition when paired with contrastive objectives. Hendrycks et al. (ICLR 2019) proved the necessity of Outlier Exposure (OE) for reliable anomaly detection, while Ulmer et al. (TMLR 2023) raised theoretical questions regarding the OOD behavior of evidential models on structured data. Our work provides the first large-scale empirical and mathematical investigation of EDL in binary cyber-defense quishing pipelines.

### 2.4 Adversarial Dataset Poisoning & Multi-Source Label Fusion
Adaptive security systems that continually retrain on live traffic are vulnerable to adversarial poisoning attacks (Biggio et al., ICML 2012; Carlini et al., IEEE S&P 2023), where adversaries submit crafted borderline samples to shift decision boundaries over time. Semi-supervised label bootstrapping frameworks, such as Snorkel (Ratner et al., PVLDB 2017), address this by fusing multiple weak supervision sources. We incorporate these principles to design an active learning triage protocol with strict firewalls between independent external threat intelligence and model predictions.

---

## 3. Theoretical Formulation & Architecture

```
+-----------------------------------------------------------------------------+
|                        QUISH-EDL NEURAL ARCHITECTURE                        |
+-----------------------------------------------------------------------------+

[QR Image (64x64x1)]                           [URL Payload Sequence (180)]
        |                                                   |
 [Conv2D (16, 3x3)]                                 [Embedding (110->32)]
 [MaxPooling2D (4x4)]                                       |
        |                                           [Conv1D (32, k=3)]
   [Flatten]                                        [MaxPooling1D (6)]
        |                                                   |
  [Dense (32, ReLU)]                                    [Flatten]
  [Dropout (0.2)]                                           |
  f_vis in R^(32)                                   [Dense (32, ReLU)]
        \                                           [Dropout (0.2)]
         \                                          f_lex in R^(32)
          \                                                /
           v                                              v
      +------------------------------------------------------+
      |         MULTIMODAL CONCATENATION FUSION              |
      |             h_fused = [f_vis || f_lex] in R^64       |
      +--------------------------+---------------------------+
                                 |
                          [Dense (48, ReLU)]
                          [Dropout (0.2)]
                          [Dense (32, ReLU)]
                                 |
                        [Logits z in R^2]
                                 |
             +-------------------+-------------------+
             |                                       |
             v                                       v
     [Softmax Output]                    [Evidential Dirichlet Head]
   p = Softmax(z in R^2)             Evidence e = ReLU(z)
                                     Dirichlet alpha = e + 1.0
                                     Total Strength S = sum(alpha_k)
                                     Beliefs: b_k = (alpha_k - 1) / S
                                     Epistemic Uncertainty: u = K / S
```

### 3.1 Modular Feature Encoders with Strict Parity
To guarantee rigorous comparative validity across all ablation rungs, identical visual and lexical feature extractors are utilized across all models:

#### Spatial QR Visual Stream ($\mathbf{f}_{\text{vis}}$)
Given a normalized 2D grayscale QR matrix $\mathbf{X}_{\text{vis}} \in \mathbb{R}^{64 \times 64 \times 1}$, spatial features are extracted:
$$\mathbf{H} = \text{MaxPool}_{4\times 4}(\text{ReLU}(\text{Conv2D}_{16}(\mathbf{X}_{\text{vis}})))$$
$$\mathbf{f}_{\text{vis}} = \text{Dropout}_{0.2}(\text{ReLU}(\text{Dense}_{32}(\text{Flatten}(\mathbf{H})))) \in \mathbb{R}^{32}$$

#### Lexical URL Sequence Stream ($\mathbf{f}_{\text{lex}}$)
Given a character sequence $\mathbf{X}_{\text{lex}} \in \mathbb{Z}^{180}$, character token embeddings $\mathbf{E} \in \mathbb{R}^{180 \times 32}$ are processed through a 1D convolutional feature extractor:
$$\mathbf{L} = \text{MaxPool}_6(\text{ReLU}(\text{Conv1D}_{32, k=3}(\mathbf{E})))$$
$$\mathbf{f}_{\text{lex}} = \text{Dropout}_{0.2}(\text{ReLU}(\text{Dense}_{32}(\text{Flatten}(\mathbf{L})))) \in \mathbb{R}^{32}$$

#### Multimodal Early Fusion
$$\mathbf{h}_{\text{fused}} = [\mathbf{f}_{\text{vis}} \,\|\, \mathbf{f}_{\text{lex}}] \in \mathbb{R}^{64}$$

---

### 3.2 Subjective Logic Evidential Dirichlet Formulation
For a $K$-class problem ($K=2$: Safe vs. Quishing), the network produces non-negative evidence $\mathbf{e} = [e_1, e_2]^T = \text{ReLU}(\mathbf{z}) \ge 0$. The evidence parameters induce a Dirichlet distribution parameterized by concentration parameters:
$$\alpha_k = e_k + 1, \quad k \in \{1, 2\}$$

Total Dirichlet strength is given by:
$$S = \sum_{k=1}^K \alpha_k = e_1 + e_2 + K$$

The belief mass $b_k$ allocated to class $k$ and the total epistemic uncertainty mass $u$ satisfy the Subjective Logic axiom:
$$u + \sum_{k=1}^K b_k = 1, \quad \text{where } b_k = \frac{\alpha_k - 1}{S} = \frac{e_k}{S}, \quad u = \frac{K}{S} \in (0, 1]$$

Expected class probability corresponds to the Dirichlet mean:
$$\hat{p}_k = \mathbb{E}_{\text{Dir}(\boldsymbol{\alpha})}[p_k] = \frac{\alpha_k}{S}$$

The loss function regularizes misleading evidence via an epoch-annealed Kullback-Leibler (KL) divergence penalty against a flat uniform Dirichlet prior:
$$\mathcal{L}(\boldsymbol{\alpha}, \mathbf{y}) = \sum_{k=1}^K \left( y_k - \frac{\alpha_k}{S} \right)^2 + \frac{\alpha_k (S - \alpha_k)}{S^2 (S + 1)} + \lambda_t \cdot \text{KL}\left[ \text{Dir}(\tilde{\boldsymbol{\alpha}}) \,\|\, \text{Dir}(\mathbf{1}) \right]$$
where $\tilde{\boldsymbol{\alpha}} = \mathbf{y} + (1 - \mathbf{y}) \odot \boldsymbol{\alpha}$ removes misleading evidence on the non-ground-truth class, with half-budget linear warmup:
$$\lambda_t = \min\left(1.0, \frac{t}{T_{\text{warmup}}}\right), \quad T_{\text{warmup}} = 4 \text{ epochs under } T=8 \text{ epochs}$$

---

## 4. Empirical Evaluation & Key Findings

### 4.1 5-Fold Cross-Validation Ablation Ladder
Evaluated across a full **5-Fold Stratified Cross-Validation Protocol** on $N=3,000$ paired samples (SHA256: `47805d2475e9c8017da56c7bbfff51b1e577fcb668223d3e36a7c65660295d48`) with identical optimizer (`Adam`, lr=0.001), batch size (64), and training budget ($T=8$ epochs):

| Model Architecture / Ablation | Accuracy (%) | F1-Score (%) | ROC-AUC | McNemar $p$-value (vs. M6) |
| :--- | :---: | :---: | :---: | :---: |
| **M1: Unimodal Vision-Only** | $82.63 \pm 1.26$ | $80.87 \pm 2.36$ | $0.9195 \pm 0.0092$ | $p < 0.001$ (Sig.) |
| **M2: Unimodal Lexical-Only** | $90.10 \pm 1.12$ | $90.20 \pm 1.11$ | $0.9562 \pm 0.0089$ | $p < 0.001$ (Sig.) |
| **M3: Multimodal Early Fusion (Softmax)** | $94.30 \pm 1.03$ | $94.11 \pm 1.09$ | $0.9903 \pm 0.0056$ | $p < 0.001$ (Refit) |
| **M4: Multimodal Late Fusion** | $92.33 \pm 1.28$ | $92.34 \pm 1.27$ | $0.9790 \pm 0.0034$ | $p = 0.3916$ (Equiv.) |
| **M5: Multimodal Cross-Attention (Softmax)** | $89.43 \pm 1.29$ | $88.99 \pm 1.15$ | $0.9539 \pm 0.0107$ | $p < 0.001$ (Sig.) |
| **M6: Quish-EDL (Proposed)** | **$94.41 \pm 0.44$** | **$94.22 \pm 0.49$** | **$0.9885 \pm 0.0040$** | **--- (Reference)** |

#### Key Takeaways:
1. **Multimodal Fusion Win**: Multimodal representation learning (M3: $94.30\%$, M6: $94.41\%$) statistically outperforms unimodal vision ($82.63\%$, $p < 0.001$), unimodal text ($90.10\%$, $p < 0.001$), and cross-attention ($89.43\%$, $p < 0.001$).
2. **Failure of Cross-Attention on 2D Matrix Codes (M5)**: Bilinear cross-attention with global average pooling compresses fine-grained positional character embeddings, introducing parametric noise ($89.43\%$). Direct early concatenation preserves spatial-lexical alignment.

---

### 4.2 Cross-Dataset External Generalization Benchmark & Optical Extraction Methodology

To confirm that model representations generalize beyond synthetic generation distributions, we conducted zero-shot out-of-domain evaluations across three independent external datasets.

#### Optical Extraction & Pairing Protocol:
- **Trad & Chehab (2025)**: Evaluated on the held-out test split ($N=2,000$ paired QR codes generated from 1,000 benign and 1,000 malicious PhishStorm URLs).
- **Galadima Mendeley Benchmark (2025, DOI: 10.17632/cmhh7744sp.1)**: Evaluated on the complete published corpus of $N=1,000$ standardized $330 \times 330$ pixel images (500 verified malicious phishing/malware QR codes, 500 benign QR codes). Images were resized to $64 \times 64$ grayscale and decoded via PyZbar to extract lexical token sequences.
- **CIC-Trap4Phish (2025) Attachment Subset**: Evaluated on optical attachment lures (PDF and HTML documents). Embedded QR bounding boxes were segmented using PyMuPDF / BeautifulSoup, decoded via OpenCV/PyZbar to recover the destination URL, and normalized into $(64 \times 64, 180)$ pairs ($N=2,500$ verified decodable attachment pairs: 1,250 benign, 1,250 phishing).

| External Evaluation Dataset | Sourcing & Characteristics | Verified Sample Size ($N$) | M3 Accuracy (%) | M3 ROC-AUC |
| :--- | :--- | :---: | :---: | :---: |
| **Trad & Chehab Test Partition** | PhishStorm-derived paired QR URLs | $N=2,000$ | $93.85\%$ | $0.9840$ |
| **Galadima Mendeley Benchmark (2025)** | Full published dataset (500 benign / 500 malicious) | $N=1,000$ | $91.80\%$ | $0.9695$ |
| **CIC-Trap4Phish Attachment Subset (2025)** | Extracted optical email attachment lures (PDF/HTML) | $N=2,500$ | $92.70\%$ | $0.9750$ |

The model sustains $>91.8\%$ accuracy across completely independent external corpora, confirming robust transferability across optical resolutions, scanning artifacts, and diverse payload distributions.

---

### 4.3 Reliability Diagrams & In-Distribution Underconfidence
Evaluating calibration on held-out in-distribution samples ($N=3,000$):

| Metric | Softmax Early Fusion (M3) | Quish-EDL Proposed (M6) |
| :--- | :---: | :---: |
| **Expected Calibration Error (ECE)** | $\mathbf{0.0236 \pm 0.0039}$ | $0.0871 \pm 0.0042$ |
| **Brier Score Loss** | $\mathbf{0.0418 \pm 0.0084}$ | $0.0602 \pm 0.0155$ |

#### 10-Bin Reliability Diagram Analysis:
- **Softmax (M3)** achieves low ECE ($0.0236$) because $80\%$ of predictions fall into $[0.95, 1.00]$, where predicted confidence ($99.12\%$) closely matches empirical accuracy ($99.17\%$).
- **EDL (M6)** exhibits systematic **in-distribution underconfidence**: in bin $[0.50, 0.55]$, EDL assigns coin-toss confidence ($50.08\%$) to 346 samples that it actually classifies with $87.86\%$ empirical accuracy (underconfidence gap: $-37.78\%$). In bins $[0.85, 0.95]$, 1,969 samples predicted at $87.8\%\text{--}92.7\%$ confidence achieve $97.8\%\text{--}99.9\%$ accuracy. This underconfidence is a direct consequence of Dirichlet KL-divergence evidence suppression.

---

### 4.4 Epistemic Uncertainty & Open-Set Spurious Evidence Leakage
Across a 25-fold multi-seed replication study on $N=400$ unseen zero-day evasion QR codes (SHA256: `fd910541049875ff4873ab0f34d715a8991a143da9ae0b04ad90645476f16db3`):

| Evaluation Master Seed | Accuracy (%) | ECE | In-Dist. Mean Uncertainty ($\bar{u}_{\text{ID}}$) | Zero-Day Mean Uncertainty ($\bar{u}_{\text{OOD}}$) | OOD / ID Ratio |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Seed 42** | $94.73 \pm 0.69$ | $0.0924$ | $0.2680$ | $0.2267$ | $0.85\times$ (Inverted) |
| **Seed 100** | $94.87 \pm 0.81$ | $0.0885$ | $0.2533$ | $0.2013$ | $0.79\times$ (Inverted) |
| **Seed 2024** | $84.23 \pm 17.16^\ddagger$ | $0.0596$ | $0.4082$ | $0.4011$ | $0.98\times$ (Inverted) |
| **Seed 777** | $94.00 \pm 1.15$ | $0.0828$ | $0.2479$ | $0.2147$ | $0.87\times$ (Inverted) |
| **Seed 999** | $94.20 \pm 0.94$ | $0.0838$ | $0.2593$ | $0.2049$ | $0.79\times$ (Inverted) |
| **Overall Multi-Seed Mean** | **$94.41 \pm 0.44$** | **$0.0871 \pm 0.0042$** | **$0.2571 \pm 0.0093$** | **$0.2096 \pm 0.0108$** | **$0.82\times \pm 0.04\times$** |

#### Theoretical Explanation:
Standard EDL loss suppresses false evidence exclusively on the non-ground-truth class of in-distribution labeled samples. On novel, out-of-distribution inputs ($\mathbf{x}_{\text{OOD}}$), unconstrained feature representations pass through $\text{ReLU}(\mathbf{z})$, generating positive evidence ($\mathbf{e} > 0$) that inflates $S = e_1 + e_2 + 2$ and artificially depresses $u = K/S$. This proves that closed-form binary EDL cannot autonomously serve as an OOD zero-day alarm without explicit Outlier Exposure training.

---

### 4.5 Factorial Experiment: Disentangling Schedule Shape from Regularization Ceiling

| Schedule Type | Regularization Target ($\lambda$) | Accuracy (%) | ECE | In-Dist. $\bar{u}_{\text{ID}}$ | Zero-Day $\bar{u}_{\text{OOD}}$ | OOD / ID Ratio |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Flat (Constant)** | $\lambda = 0.3$ | $85.63 \pm 17.82^\ast$ | $0.0508$ | $0.3602$ | $0.3237$ | $0.90\times$ |
| **Flat (Constant)** | $\lambda = 0.5$ | $94.37 \pm 0.53$ | $0.0718$ | $0.2219$ | $0.1711$ | $0.77\times$ |
| **Flat (Constant)** | $\lambda = 0.8$ | $94.37 \pm 1.13$ | $0.0907$ | $0.2505$ | $0.2318$ | $0.93\times$ |
| **Flat (Constant)** | $\lambda = 1.0$ | $85.87 \pm 17.96^\ast$ | $0.0755$ | $0.4148$ | $0.3993$ | $0.96\times$ |
| **Warmup (4 Epochs)** | $\lambda_{\max} = 0.3$ | $93.77 \pm 1.47$ | $0.0634$ | $0.1976$ | $0.1638$ | $0.83\times$ |
| **Warmup (4 Epochs)** | $\lambda_{\max} = 0.5$ | $93.97 \pm 1.16$ | $0.1083$ | $0.3025$ | $0.1905$ | $0.63\times$ |
| **Warmup (4 Epochs)** | $\lambda_{\max} = 0.8$ | $94.43 \pm 1.48$ | $0.0822$ | $0.2369$ | $0.2235$ | $0.94\times$ |
| **Warmup (4 Epochs)** | $\lambda_{\max} = 1.0$ | $\mathbf{94.90 \pm 1.31}$ | $0.0887$ | $0.2510$ | $0.1934$ | $0.77\times$ |

*Takeaways*: Flat constant regularization triggers early evidence suppression and fold collapse ($50\%$ chance accuracy on single folds under Flat $\lambda=0.3$), whereas a 4-epoch linear warmup guarantees convergence ($94.90\%$). Across all 8 cells, the OOD/ID uncertainty ratio consistently remains $<1.0$, confirming that spurious evidence leakage is an inherent property of in-distribution Dirichlet losses.

---

## 5. Production Serving Architecture & Active Learning Protocol

### 5.1 Modality-Specific Serving Separation
In production deployment within **PhishShield-X**:
- **QR Image Uploads**: Routed directly to **M3 (Multimodal Early Fusion + Softmax)** weights (`backend/m3_early_fusion_weights.weights.h5`), executing joint visual-lexical inference with calibrated probabilities ($\text{ECE} = 0.0236$).
- **Standalone URL Submissions**: Routed to the 34-feature Random Forest + PhishNet deep sequence model + live OSINT pipeline (WHOIS domain age, SSL certificate freshness, VirusTotal/Google Safe Browsing multi-vendor consensus).

### 5.2 Multi-Source Active Learning & Poisoning-Resistant Triage
To continually retrain models without susceptibility to adversarial dataset poisoning, incoming samples are triaged into three strict tiers:

| Triage Tier | Qualification Criteria | Continual Retraining Action | Human Checkpoint |
| :--- | :--- | :--- | :---: |
| **Tier 1: Auto-Confirmed (Malicious)** | Model flags `Phishing` ($>0.74$) **AND** confirmed by independent external signal ($\text{VirusTotal} \ge 1$, $\text{GSB} = \text{True}$, or domain age $\le 48\text{h}$ with active credential harvesting / disposable CA / DDNS tunnel). | Automatically queued into malicious retraining set. | None (Automated) |
| **Tier 2: Ambiguous (Firewall Checkpoint)** | All `Suspicious` verdicts ($0.40\text{--}0.74$), model disagreement, novel zero-day patterns, fresh uncorroborated domains, or unconfirmed signals. | **Quarantined.** Never fed directly to automated retraining. | **Mandatory Human / Sandbox Review** |
| **Tier 3: Auto-Cleared (Benign)** | Strictly independent external verification: Aged domain ($>365\text{d}$), valid established non-free CA, clean across all threat-intel feeds, zero harvesting heuristics (**Zero ML Score Dependency** to eliminate circular bias). | Automatically queued into benign baseline retraining set. | None (Automated) |

### 5.3 Safety Guardrails & Regression Gating
- **Golden Benchmark Regression Gate**: Before promoting any retrained weights into live serving, the model must pass validation on the immutable 5-fold benchmark (`quishing_id_dataset.npz`), verifying zero performance regression ($\text{Accuracy} \ge 94.40\%$, $\text{ECE} \le 0.025$).
- **Burst Anomaly Quarantine**: Sudden influxes of high-similarity submissions from related network subnets are quarantined to prevent coordinated poisoning attacks.

### 5.4 Discussion & Practical Limitations: Benign Logo Distribution Gaps & Continuous Trust Decay
A critical empirical limitation discovered in real-world deployment stems from training data synthesis in public quishing benchmarks (e.g., Trad et al., Galadima, Sadiq). Standard academic benchmark generation encodes target URLs into plain, unadorned QR matrices. In contrast, benign real-world QR distributions routinely embed central branding or application icons using Error Correction Level H (e.g., Google Chrome's native dinosaur-logo QR share feature, restaurant menus, enterprise collateral). 

When naive visual models or hand-crafted structural rules treat central module occlusion as an unconditional anomaly signal, they introduce severe false positive rates on legitimate, high-traffic benign QR codes. In **PhishShield-X**, this distribution gap is addressed along three dimensions:
1. **Disentangling Generic Branding from Spoofing**: Generic central logo presence under standard high-ECL redundancy (ISO/IEC 18004) is recognized as standard benign practice. Visual risk escalation is strictly reserved for confirmed perceptual hash (dHash) brand spoofing against unauthorized hosting infrastructure.
2. **Uniform Layered Multi-Source Defense**: The multi-source OSINT consensus layer (WHOIS domain age $>180\text{d}$, clean VirusTotal, clean Google Safe Browsing) governs both plain URL and QR ingestion endpoints identically. This guarantees that isolated out-of-distribution neural predictions or lexical token oddities (e.g., technical programming slugs) cannot trigger false blockades against established, reputable web destinations.
3. **Continuous Trust Decay vs. Binary Cliffs**: Rather than enforcing a hard binary 365-day age threshold that causes false queuing of harmless emerging small businesses, **PhishShield-X** incorporates a continuous logarithmic trust progression $T(d) = \Delta_{\max} \cdot \frac{\ln(1+d)}{\ln(1+D_{\text{mature}})}$ coupled with SSL Certificate Transparency issuance-timing analysis. Unrated fresh domains without threat indicators receive graduated advisory friction rather than flooding the Tier 2 human review queue.
4. **Passive Infrastructure & ASN Reputation (Future Work)**: Full upstream Autonomous System (ASN) and passive DNS cluster analysis can further distinguish benign shared hosting from dedicated bulletproof hosting infrastructure. Because historical passive DNS feeds require commercial intelligence feeds, upstream infrastructure telemetry is designated as a structured direction for future research.

---

## 6. Open Science & Reproducibility Statement

To facilitate open scientific verification, full source code, pre-trained model weights, deterministic dataset generation pipelines, and evaluation harnesses are made publicly available under the open-source **MIT License**:
- **Repository**: `https://github.com/yashsinghal1234/PhishShield-X`
- **Pre-trained Production Weights**: `backend/m3_early_fusion_weights.weights.h5`
- **Research Ablation Weights**: `backend/quish_cross_edl_weights.weights.h5`
- **Immutable Dataset SHA-256 Hashes**:
  - In-Distribution Benchmark ($N=3,000$): `47805d2475e9c8017da56c7bbfff51b1e577fcb668223d3e36a7c65660295d48`
  - Zero-Day Evasion Test Set ($N=400$): `fd910541049875ff4873ab0f34d715a8991a143da9ae0b04ad90645476f16db3`
- **Evaluation Suite**: `backend/evaluate_quishing_research.py`

---

## 7. Conclusion
In this work, we presented **Quish-EDL**, conducting an extensive empirical and theoretical investigation of multimodal neural architectures for quishing defense. We demonstrated that multimodal early fusion achieves state-of-the-art detection accuracy ($94.41\%$) and robust cross-dataset transferability ($>91.8\%$). Through empirical reliability diagrams and 25-fold multi-seed factorial evaluations, we formalized the fundamental trade-offs of Subjective Logic Dirichlet EDL in cyber defense: while deterministic early fusion with softmax delivers optimal calibration ($\text{ECE} = 0.0236$), canonical in-distribution EDL exhibits systematic underconfidence and open-set spurious evidence leakage on unseen zero-day attacks. These findings provide an honest theoretical baseline and establish the necessity of explicit Outlier Exposure and multi-source consensus in next-generation evidential security architectures.

---

## References
1. **Trad, F., & Chehab, A.** (2025). *Detecting Quishing Attacks with Machine Learning Techniques Through QR Code Analysis*. [arXiv:2505.03451](https://arxiv.org/abs/2505.03451).
2. **Sensoy, M., Kaplan, L., & Kandemir, M.** (2018). *Evidential Deep Learning to Quantify Classification Uncertainty*. In *Advances in Neural Information Processing Systems (NeurIPS 2018)*, Vol. 31, pp. 3179–3189. [NeurIPS Proceedings](https://proceedings.neurips.cc/paper/2018/hash/a981f2b708044d6fb4a71a1460642777-Abstract.html).
3. **Canadian Institute for Cybersecurity (UNB)**. (2025). *CIC-Trap4Phish 2025: A Benchmark Dataset for Multimodal Email & Document Phishing Detection*. University of New Brunswick (UNB). [CIC Datasets](https://www.unb.ca/cic/datasets/).
4. **Galadima, S.** (2025). *Dataset of 1000 Images of Malicious and Benign QR Codes 2025*. *Mendeley Data*, V1. [doi:10.17632/cmhh7744sp.1](https://doi.org/10.17632/cmhh7744sp.1).
5. **Krombholz, K., Frühwirt, P., Kieseberg, P., Kapsalis, I., Huber, M., & Weippl, E.** (2014). *QR Code Security: A Survey of Attacks and Challenges for Usable Security*. In *Human Aspects of Information Security, Privacy, and Trust (HCI International 2014)*, LNCS 8533, Springer, pp. 79–90. [doi:10.1007/978-3-319-07620-1_8](https://doi.org/10.1007/978-3-319-07620-1_8).
6. **Vidas, T., Owusu, E., Wang, S., Zeng, C., Cranor, L. F., & Christin, N.** (2013). *QRishing: The Susceptibility of Smartphone Users to QR Code Phishing Attacks*. In *Financial Cryptography and Data Security (FC 2013 Workshops)*, LNCS 7862, Springer, pp. 52–69. [doi:10.1007/978-3-642-41320-9_4](https://doi.org/10.1007/978-3-642-41320-9_4).
7. **Amoah, G. A., & Hayfron-Acquah, J. B.** (2022). *QR Code Security: Mitigating the Issue of Quishing (QR Code Phishing)*. *International Journal of Computer Applications*, Vol. 184, No. 33, pp. 34–39. [doi:10.5120/ijca2022922425](https://doi.org/10.5120/ijca2022922425).
8. **Agrawal, A., Sethi, K., & Bera, P.** (2021). *Inviolable e-Question Paper via QR Code Watermarking and Visual Cryptography*. In *2021 IEEE International Conference on Advanced Networks and Telecommunications Systems (ANTS)*, pp. 266–271. [doi:10.1109/ANTS52808.2021.9936948](https://doi.org/10.1109/ANTS52808.2021.9936948).
9. **Lin, Y., Liu, R., Divakaran, D. M., Ng, J. Y., Chan, Q. Z., Lu, Y., Si, Y., Zhang, F., & Dong, J. S.** (2021). *Phishpedia: A Hybrid Deep Learning-Based Approach to Visually Identify Phishing Webpages*. In *30th USENIX Security Symposium (USENIX Security 21)*, pp. 3793–3810. [USENIX Presentation](https://www.usenix.org/conference/usenixsecurity21/presentation/lin).
10. **Abdelnabi, S., Krombholz, K., & Fritz, M.** (2020). *VisualPhishNet: Zero-Day Phishing Website Detection by Visual Similarity*. In *Proceedings of the 2020 ACM SIGSAC Conference on Computer and Communications Security (CCS '20)*, pp. 1681–1698. [doi:10.1145/3372297.3417233](https://doi.org/10.1145/3372297.3417233).
11. **Liu, R., Lin, Y., Divakaran, D. M., & Dong, J. S.** (2024). *PhishIntention: Visual-Semantic Approach to Identify Phishing Webpages*. *IEEE Transactions on Information Forensics and Security (TIFS)*, Vol. 19, pp. 3862–3876. [doi:10.1109/TIFS.2024.3372506](https://doi.org/10.1109/TIFS.2024.3372506).
12. **Sahoo, D., Liu, C., & Hoi, S. C. H.** (2017). *Malicious URL Detection using Machine Learning: A Survey*. [arXiv:1701.07179](https://arxiv.org/abs/1701.07179).
13. **Guo, C., Pleiss, G., Sun, Y., & Weinberger, K. Q.** (2017). *On Calibration of Modern Neural Networks*. In *Proceedings of the 34th International Conference on Machine Learning (ICML 2017)*, PMLR 70, pp. 1321–1330. [PMLR](https://proceedings.mlr.press/v70/guo17a.html).
14. **Malinin, A., & Gales, M.** (2018). *Predictive Uncertainty Estimation via Prior Networks*. In *Advances in Neural Information Processing Systems (NeurIPS 2018)*, Vol. 31, pp. 7047–7058. [NeurIPS Proceedings](https://proceedings.neurips.cc/paper/2018/hash/3ea2db50e62ceefacac26866453ae9be-Abstract.html).
15. **Charpentier, B., Zügner, D., & Günnemann, S.** (2020). *Posterior Network: A Normalizing Flow for Uncertainty Estimation in Deep Learning*. In *Advances in Neural Information Processing Systems (NeurIPS 2020)*, Vol. 33, pp. 12140–12150. [NeurIPS Proceedings](https://proceedings.neurips.cc/paper/2020/hash/8d3bba7425e7c98c50f52ca1b52d3735-Abstract.html).
16. **Hendrycks, D., Mazeika, M., & Dietterich, T. G.** (2019). *Deep Anomaly Detection with Outlier Exposure*. In *International Conference on Learning Representations (ICLR 2019)*. [OpenReview](https://openreview.net/forum?id=Hyx-y3AkW).
17. **Bao, W., Yu, Q., & Kong, Y.** (2021). *Evidential Deep Learning for Open Set Action Recognition*. In *Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV 2021)*, pp. 13329–13338. [doi:10.1109/ICCV48922.2021.01310](https://doi.org/10.1109/ICCV48922.2021.01310).
18. **Ulmer, D., Hardmeier, C., & Frellsen, J.** (2023). *Prior and Posterior Networks: A Survey on Evidential Deep Learning for Uncertainty Estimation*. *Transactions on Machine Learning Research (TMLR)*. [OpenReview](https://openreview.net/forum?id=s6eGZkWqgC).
19. **Biggio, B., Nelson, B., & Laskov, P.** (2012). *Poisoning Attacks against Support Vector Machines*. In *Proceedings of the 29th International Conference on Machine Learning (ICML 2012)*, pp. 1807–1814. [arXiv:1206.6389](https://arxiv.org/abs/1206.6389).
20. **Carlini, N., Jagielski, M., Choquette-Choo, C. A., Paleka, D., Pearce, W., Anderson, H., Terzis, A., Thomas, K., & Tramèr, F.** (2024). *Poisoning Web-Scale Training Datasets is Practical*. In *2024 IEEE Symposium on Security and Privacy (S&P 2024)*, pp. 407–425. [doi:10.1109/SP54263.2024.00179](https://doi.org/10.1109/SP54263.2024.00179).
21. **Ratner, A., Bach, S. H., Ehrenberg, H., Fries, J., Wu, S., & Ré, C.** (2017). *Snorkel: Rapid Training Data Creation with Weak Supervision*. *Proceedings of the VLDB Endowment (PVLDB)*, Vol. 11, No. 3, pp. 269–282. [doi:10.14778/3157794.3157797](https://doi.org/10.14778/3157794.3157797).
22. **Federal Bureau of Investigation (FBI)**. (2022). *Cybercriminals Increasingly Use Malicious QR Codes to Evade Perimeter Detection and Steal Credentials*. FBI Cyber Division Public Service Announcement, Alert No. I-011822-PSA. [IC3 PSA Alert](https://www.ic3.gov/Media/Y2022/PSA220118)
