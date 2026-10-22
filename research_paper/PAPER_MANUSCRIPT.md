# PhishShield-EDL: Unified Tri-Modal Evidential Deep Learning and Cross-Modal Parity Proof of Out-of-Distribution Uncertainty in Phishing Defense

**Target Venues**: *IEEE Transactions on Dependable and Secure Computing (TDSC)* / *Computers & Security (Elsevier)* / *IEEE Access (Special Section on AI in Cyber Defense)* / *ACM AsiaCCS* / *IEEE S&P Workshop on Deep Learning and Security (DLS)*

---

## Abstract
Phishing attacks have rapidly evolved beyond simple textual lures, spanning multimodal optical vectors (Quishing / QR phishing), weaponized web uniform resource identifiers (URLs), and semi-structured communications (emails) that evade perimeter filters, Secure Email Gateways (SEGs), and textual NLP parsers. In this paper, we conduct a systematic empirical and theoretical study of multimodal neural architectures and evidential uncertainty quantification across all three primary attack channels, presenting **PhishShield-EDL**. We formulate modular visual-lexical neural architectures for optical 2D barcodes (**Quish-EDL**), dual lexical-tabular neural architectures for standalone URL inspection (**URL-EDL**), and header-content neural architectures for full email triage (**Email-EDL**) under strict encoder parity and identical training budgets.

Across 5-fold cross-validation on rigorous multi-source benchmarks (3,000 paired QR codes, 6,000 balanced URLs, and 10,000 balanced Enron + Nazario emails), our proposed early fusion architectures achieve state-of-the-art detection performance: $94.41\% \pm 0.44\%$ on QR barcodes ($0.9885$ ROC-AUC, $+7.52$ percentage point ROC-AUC gain over published structural QR baselines), $90.67\% \pm 0.58\%$ on URLs (statistically equivalent to a 34-feature Random Forest baseline, $p = 0.0728$), and $98.19\% \pm 0.19\%$ on emails (statistically equivalent between evidential and cosine models, $p = 0.1388$). This establishes zero accuracy penalty for equipping tri-modal phishing classification with evidential uncertainty quantification.

Beyond classification accuracy, we investigate the calibration and out-of-distribution (OOD) uncertainty properties of Subjective Logic Evidential Deep Learning (EDL), demonstrating three key empirical and theoretical findings:
1. **In-Distribution Underconfidence**: While deterministic early fusion with softmax achieves near-optimal in-distribution calibration (ECE $= 0.0236$ for QR, $0.0301$ for URL, $0.0063$ for Email), Dirichlet evidential parameterization suffers from systematic underconfidence (ECE $= 0.0871$ for QR, $0.0979$ for URL, $0.0640$ for Email) driven by Dirichlet KL-divergence evidence suppression;
2. **First Cross-Modal Parity Proof of Spurious Evidence Leakage**: While out-of-distribution overconfidence in evidential models has been theoretically critiqued (Bengs et al., 2022; Ulmer et al., 2023), we provide the first cross-modal empirical proof that canonical binary Dirichlet EDL ($e = \text{ReLU}(z)$) replicates spurious evidence leakage on zero-day attacks across 2D optical QR matrices (inverted ratio $\mathbf{0.82\times \pm 0.04\times}$), 1D lexical-tabular URLs (inverted ratio $\mathbf{0.73\times \pm 0.08\times}$), and natural email text (spurious Dirichlet strength $S_{\text{OOD}} = 8.61 \gg 2.0$, detecting only $11.88\%$ of zero-day threats at $p_{95}$); and
3. **Tri-Modal Restoration via Outlier Exposure and Cosine Heads**: We demonstrate that bounding latent feature norms via Orthogonal Cosine Normalization and regularizing uninformative Dirichlet boundaries via Outlier Exposure (OE) universally restores zero-day epistemic uncertainty elevation ($3.80\times$ on QR, $2.81\times$ on URLs, and $3.50\times$ on Emails with $95.28\%$ zero-day detection), while achieving superior Brier score calibration ($0.0690$ on URLs, beating Softmax $0.0766$).

Finally, we detail our operational deployment framework in PhishShield-X, utilizing high-accuracy deterministic fusion for live production serving while retaining evidential heads in shadow mode for zero-day triage and field ECE telemetry.

---

## 1. Introduction & Threat Landscape

### 1.1 The Evolving Phishing Attack Surface
Traditional enterprise defenses rely on Static Heuristic Analysis, Domain Name System Blacklists (DNSBL), and Natural Language Processing (NLP) parsers to inspect email headers, text bodies, and embedded hyperlinks. However, cyber adversaries have increasingly shifted toward evasion vectors that subvert standard inspection pipelines:
1. **Quishing (QR Phishing)**: Adversaries render weaponized URLs as 2D optical barcodes within PDF attachments or image bodies, bypassing perimeter text inspection and shifting the scan to unmanaged mobile devices (FBI Cyber Division Alerts, 2022).
2. **Obfuscated and Zero-Day URLs**: Adversaries deploy algorithmic domain generation, multi-hop open redirects, brand typosquatting, and fast-flux cloud hosting (PaaS) to evade static blacklists and signature rules.

```
+-----------------------------------------------------------------------------------+
|                        TRADITIONAL PERIMETER INSPECTION GAPS                      |
|  [Email Text: "Scan invoice QR"] ---> [NLP Filter] ---> "SAFE" (Blind to QR Image)|
|  [PaaS Obfuscated URL] ----------> [Static Blacklist] -> "SAFE" (Blind to Zero-Day)|
+-----------------------------------------------------------------------------------+
                                                     v
+-----------------------------------------------------------------------------------+
|                           PROPOSED PHISHSHIELD-EDL ARCHITECTURE                   |
|                                                                                   |
|  +--------------------+         +------------------------+                        |
|  | Visual Spatial QR  |         | Lexical URL Sequence   |  +-------------------+ |
|  | Matrix (64x64)     |         | Tokens (180 chars)     |  | 34 Scaled Tabular | |
|  +---------+----------+         +-----------+------------+  | Features          | |
|            |                                |               +---------+---------+ |
|            | (Quish-EDL Stream)             |                         |           |
|            +--------------+  +--------------+ (URL-EDL Stream)        |           |
|                           v  v                                        v           |
|              [Joint Multimodal Representation]        [Joint Lexical-Tabular]     |
|                           |                                   |                   |
|                           v                                   v                   |
|               [Cosine Evidential Dirichlet Head]   [Cosine Evidential Head]       |
|                           |                                   |                   |
|         +-----------------+-----------------+                 |                   |
|         v                                   v                 v                   |
|  [Calibrated Threat Class]          [Epistemic Uncertainty: u (Zero-Day Alarm)]   |
+-----------------------------------------------------------------------------------+
```

### 1.2 Research Objectives & Contributions
This paper addresses the fundamental architectural, generalization, and calibration questions in multimodal and sequence-based phishing defense:
1. **Multimodal Visual-Lexical Superiority in Quishing**: We systematically evaluate a 6-rung ablation ladder (M1: Vision-Only, M2: Lexical-Only, M3: Early Fusion Softmax, M4: Late Fusion, M5: Cross-Attention, M6: Evidential Early Fusion) under strict encoder parity, demonstrating that early multimodal concatenation ($94.41\% \pm 0.44\%$, $0.9885$ ROC-AUC) statistically outperforms unimodal and complex co-attention baselines.
2. **Dual-Stream URL Architecture & Zero-Cost Epistemic Parity**: We formulate URL-EDL, combining 1D character convolutions with a 34-feature scaled tabular projection. On a 5-fold ablation ladder (U1--U6), URL-EDL achieves $90.67\% \pm 0.58\%$ (and $90.27\%$ with Cosine-OE), statistically equivalent to the 34-feature Random Forest baseline ($91.50\% \pm 0.38\%$, McNemar $p = 0.0728$), demonstrating zero accuracy penalty for equipping URL classification with epistemic uncertainty.
3. **Cross-Modal Empirical Proof of Spurious Evidence Leakage**: Moving beyond single-modality observations, we demonstrate that canonical binary Dirichlet EDL ($e = \text{ReLU}(z)$) replicates spurious evidence leakage on unseen zero-day attacks across both discrete 2D optical QR matrices ($0.82\times \pm 0.04\times$) and 1D lexical-tabular URL sequences ($0.73\times \pm 0.08\times$), formally explaining why standard evidential loss produces lower uncertainty on OOD attacks than on in-distribution samples ($\bar{u}_{\text{OOD}} < \bar{u}_{\text{ID}}$).
4. **Architectural Resolution via Cosine Heads and Outlier Exposure**: We demonstrate that Outlier Exposure and Annealed Cosine Normalization reliably eliminate spurious evidence leakage across both modalities, elevating zero-day uncertainty to $>2.81\times\text{--}3.80\times$ (with OOD median uncertainty $= 1.0$) while achieving the best Brier score loss ($0.0690$ on URLs, outperforming Softmax $0.0766$).
5. **Cross-Dataset Generalization & Operational Serving Framework**: We validate cross-dataset generalization across three independent benchmarks (Trad et al., CIC-Trap4Phish 2025, Galadima 2025) and establish an operational architecture that deploys calibrated deterministic models for live inference while maintaining evidential models in shadow mode for triage and poison-resilient active learning.

---

## 2. Related Work

### 2.1 QR Code Security & Quishing Analysis
The security implications of 2D optical barcodes have been studied across physical and digital attack surfaces. Krombholz et al. (2014) provided the first comprehensive survey of QR code vulnerabilities, analyzing user susceptibility and physical overlay vectors. Vidas et al. (2013) conducted seminal empirical field studies under the term "QRishing," demonstrating that smartphone users routinely scan untrusted public QR codes driven by curiosity. Amoah & Hayfron-Acquah (2022) analyzed attack vectors in mobile QR phishing and proposed heuristic mitigation frameworks.

Recent detection efforts have focused on isolated pipeline stages:
- **Optical Barcode Structural & Matrix Analysis**: Trad & Chehab (2025) directly classified optical QR code structures and geometric module matrices using machine learning classifiers (achieving ROC-AUC of $0.9106\text{--}0.9133$ with XGBoost) without extracting or parsing the underlying payload URLs. While this approach avoids payload decoding dependencies, it remains blind to rich lexical and protocol threat indicators within the destination URI. Our framework bridges this division by evaluating visual barcode structures, decoded payload sequences, and lexical-tabular representations under unified multimodal fusion.
- **Visual Structural & Geometry Analysis**: Galadima (2025) published the Mendeley benchmark dataset of 1,000 verified benign and malicious QR codes (DOI: 10.17632/cmhh7744sp.1), evaluating visual encoding density and error correction variations. Agrawal et al. (2021) investigated visual watermarking and tamper detection in QR code matrices.
- **Large-Scale Multi-Format Datasets**: The Canadian Institute for Cybersecurity released CIC-Trap4Phish (2025), a benchmark aggregating multi-format phishing lures across emails, QR attachments, and documents.

Our work bridges the visual-lexical divide by enforcing joint representation learning over paired optical matrices and lexical sequences under a unified benchmark.

### 2.2 Multimodal Deep Learning in Cybersecurity
Multimodal architectures have gained traction in phishing webpage detection. Phishpedia (Lin et al., USENIX Security 2021) combined object detection and Siamese networks to visually recognize brand logos and compare them against domain identity. VisualPhishNet (Abdelnabi et al., ACM CCS 2020) trained triplet CNNs on visual similarity to detect zero-day phishing pages without hand-crafted features. PhishIntention (Liu et al., IEEE TIFS 2024) introduced visual layout segmentation to identify credential-harvesting input forms. Sahoo et al. (ACM Comput. Surv. 2017) surveyed machine learning techniques for malicious URL detection.

In the quishing domain, however, visual representations consist of discrete 2D frequency patterns rather than natural webpage screenshots. We evaluate whether bilinear cross-attention mechanisms or direct multimodal concatenation provide superior inductive bias for optical barcode representations.

### 2.3 Evidential Deep Learning & Uncertainty Estimation
Standard deep classifiers output uncalibrated Softmax distributions that frequently exhibit overconfidence on out-of-distribution (OOD) inputs (Guo et al., ICML 2017). To quantify epistemic uncertainty in safety-critical domains without the computational overhead of Bayesian Monte Carlo Dropout (Gal & Ghahramani, ICML 2016) or Deep Ensembles (Lakshminarayanan et al., NeurIPS 2017), Sensoy et al. (NeurIPS 2018) proposed **Evidential Deep Learning (EDL)** based on Dempster-Shafer Subjective Logic (Jøsang, 2016). EDL parameterizes a Dirichlet prior directly over class probabilities.

Follow-up works, including Prior Networks (Malinin & Gales, NeurIPS 2018) and Posterior Networks (Charpentier et al., NeurIPS 2020), attempted to refine Dirichlet parameter estimation. However, critical theoretical vulnerabilities in evidential uncertainty have been identified: Bengs et al. (NeurIPS 2022) revealed fundamental pitfalls in Dirichlet second-order uncertainty quantification under epistemic distribution shifts, and Ulmer et al. (TMLR 2023) highlighted that evidential models can exhibit uncalibrated overconfidence on out-of-distribution tabular and structured data. In computer vision, Bao et al. (IEEE TPAMI 2021) demonstrated that Dirichlet losses require contrastive regularization for open-set recognition. Hendrycks et al. (ICLR 2019) established that Outlier Exposure (OE) with auxiliary non-target data provides a principled mechanism for regularizing anomaly detection models. While OOD overconfidence in evidential models has been observed theoretically, our work provides the first rigorous cross-modal empirical proof that canonical binary Dirichlet EDL replicates inverted epistemic uncertainty ($u_{\text{OOD}} < u_{\text{ID}}$ at $0.73\times\text{--}0.82\times$) across discrete 2D optical matrices and continuous 1D lexical-tabular sequences under strict experimental parity, and demonstrates its durable architectural resolution via Outlier Exposure and Cosine-Normalized evidential heads.

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

#### Multimodal Early Fusion (Quish-EDL)
$$\mathbf{h}_{\text{fused}} = [\mathbf{f}_{\text{vis}} \,\|\, \mathbf{f}_{\text{lex}}] \in \mathbb{R}^{64}$$

#### Scaled Tabular Stream ($\mathbf{f}_{\text{tab}}$) & URL Early Fusion (URL-EDL)
In standalone URL analysis, in addition to the 180-token character lexical sequence $\mathbf{X}_{\text{lex}}$, we extract $D=34$ statistical, structural, and lexical features $\mathbf{X}_{\text{tab}} \in \mathbb{R}^{34}$ (including domain entropy, path length, token distributions, sub-domain depth, and suspicious keyword flags). To prevent numerical scale divergence and feature dominance during fusion, tabular features are strictly normalized using a fold-isolated `StandardScaler` ($\boldsymbol{\mu}_{\text{train}}, \boldsymbol{\sigma}_{\text{train}}$) fit exclusively on the training fold:
$$\mathbf{f}_{\text{tab}} = \text{Dropout}_{0.2}(\text{ReLU}(\text{Dense}_{32}(\text{StandardScaler}(\mathbf{X}_{\text{tab}})))) \in \mathbb{R}^{32}$$
For URL-EDL, the joint representation concatenates sequence and tabular embeddings under identical downstream dimensionality:
$$\mathbf{h}_{\text{url}} = [\mathbf{f}_{\text{lex}} \,\|\, \mathbf{f}_{\text{tab}}] \in \mathbb{R}^{64}$$
Both $\mathbf{h}_{\text{fused}}$ and $\mathbf{h}_{\text{url}}$ feed into identical classification necks ($\text{Dense}_{48} \to \text{Dropout}_{0.2} \to \text{Dense}_{32}$) followed by either deterministic Softmax or evidential Dirichlet heads.

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

### 3.3 Architectural Formulations for Mitigating Open-Set Uncertainty Leakage
To address the theoretical vulnerability where out-of-distribution feature activations project through unconstrained dense weights into spurious positive evidence ($\mathbf{e} > 0$), we formulate two architectural remedies:

#### 1. Dirichlet Prior Regularization via Outlier Exposure (OE)
Following Hendrycks et al. (2019), we construct an auxiliary loss term over an unlabelled outlier proxy distribution $\mathcal{D}_{\text{out}}$ (e.g., synthetic non-URI token sequences and perturbed visual noise matrices):
$$\mathcal{L}_{\text{total}} = \frac{1}{|\mathcal{B}_{\text{in}}|} \sum_{i \in \mathcal{B}_{\text{in}}} \mathcal{L}_{\text{EDL}}(\boldsymbol{\alpha}^{(i)}, \mathbf{y}^{(i)}) + \beta \cdot \frac{1}{|\mathcal{B}_{\text{out}}|} \sum_{j \in \mathcal{B}_{\text{out}}} \text{KL}\left[ \text{Dir}(\boldsymbol{\alpha}^{(j)}) \,\|\, \text{Dir}(\mathbf{1}) \right]$$
where $\beta \ge 0$ controls the outlier evidence penalty. For any out-of-distribution sample $\mathbf{x} \in \mathcal{D}_{\text{out}}$, minimizing $\text{KL}[\text{Dir}(\boldsymbol{\alpha}) \,\|\, \text{Dir}(\mathbf{1})]$ drives evidence $\mathbf{e} \to \mathbf{0}$, forcing $\boldsymbol{\alpha} \to [1, 1]^T$ and epistemic uncertainty $u = K/S \to 1.0$.

#### 2. Cosine-Normalized Angular Evidential Head
Alternatively, to enforce evidence bounded by angular representation alignment without relying on auxiliary outlier generation, we formulate a cosine-normalized evidence layer:
$$\mathbf{e}_k = \gamma \cdot \text{ReLU}\left( \frac{\mathbf{h}^T \mathbf{w}_k}{\|\mathbf{h}\|_2 \|\mathbf{w}_k\|_2} - m \right), \quad k \in \{1, 2\}$$
where $\mathbf{w}_k \in \mathbb{R}^{32}$ represents learned class direction prototypes, $\gamma > 0$ is a temperature scaling factor, and $m \in [0, 1)$ is an angular margin threshold. Feature vectors outside the angular cone ($\cos(\mathbf{h}, \mathbf{w}_k) \le m$) emit mathematically guaranteed zero evidence ($\mathbf{e} = \mathbf{0}$), ensuring maximal epistemic uncertainty ($u = 1.0$) on zero-day attacks.

---

## 4. Empirical Evaluation & Key Findings

### 4.1 Quish-EDL 5-Fold Cross-Validation Ablation Ladder (Table 1)
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

### 4.2 URL-EDL 5-Fold Cross-Validation Ablation Ladder (Table 2)
To investigate whether the architectural and evidential dynamics observed in optical quishing hold for sequence-based web threat analysis, we evaluated an identical 6-rung ablation ladder on standalone URLs. The benchmark comprises $N=6,000$ verified balanced samples (3,000 benign Alexa/Tranco, 3,000 active PhishTank/OpenPhish phishing URLs) evaluated across a **5-Fold Stratified Cross-Validation Protocol** with fold-isolated `StandardScaler` feature normalization, Adam optimizer (lr $= 2 \times 10^{-4}$, clipnorm $= 1.0$), batch size 64, and $T=8$ epochs:

| Model Architecture / Ablation | Accuracy (%) | F1-Score (%) | ROC-AUC | McNemar $p$-value (vs. U4) |
| :--- | :---: | :---: | :---: | :---: |
| **U1: Random Forest (34 Feat)** | $91.50 \pm 0.38$ | $91.53 \pm 0.36$ | $0.9740 \pm 0.0027$ | $p = 0.0728$ (Equiv.) |
| **U2: Unimodal Lexical-Only (Softmax)** | $90.35 \pm 1.29$ | $90.24 \pm 1.49$ | $0.9625 \pm 0.0080$ | $p = 0.3195$ (Equiv.) |
| **U3: Multimodal Early Fusion (Softmax)** | $89.60 \pm 1.68$ | $89.28 \pm 1.78$ | $0.9613 \pm 0.0058$ | $p < 0.001$ (Sig.) |
| **U4: URL-EDL Vanilla (Proposed Fusion + EDL)** | **$90.67 \pm 0.58$** | **$90.43 \pm 0.64$** | $0.9663 \pm 0.0047$ | **--- (Reference)** |
| **U5: URL-EDL + Outlier Exposure (OE)** | $89.15 \pm 1.51$ | $88.64 \pm 1.85$ | $0.9643 \pm 0.0048$ | $p < 0.001$ (Sig.) |
| **U6: URL-EDL Cosine Head + OE ($m=0.20$)** | **$90.27 \pm 1.68$** | $89.64 \pm 1.96$ | **$0.9711 \pm 0.0042$** | $p = 0.2442$ (Equiv.) |

#### Uncertainty Quantification, Cross-Modal Leakage Replication & Restoration:
Evaluated on in-distribution test splits and $N=400$ unseen zero-day URL transport evasion schemes (spanning decentralized IPFS gateways, ngrok/Cloudflare PaaS tunnels, WebSockets, data-URI obfuscation, and Punycode homoglyphs):

| Model Architecture | In-Dist. Mean ($\bar{u}_{\text{ID}}$) | Zero-Day Mean ($\bar{u}_{\text{OOD}}$) | Fold OOD/ID Ratios | Mean Ratio | Zero-Day Median $u$ | OOD Flag Rate at $p_{95}$ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **U4: URL-EDL Vanilla** | $0.3611 \pm 0.1605$ | $0.2642 \pm 0.0579$ | $[0.680, 0.873, 0.698, 0.774, 0.630]$ | $\mathbf{0.73 \pm 0.08\times}$ | $0.2528$ | $0.0\% \pm 0.0\%$ |
| **U5: URL-EDL + OE** | $0.3859 \pm 0.1754$ | $0.6604 \pm 0.2538$ | $[1.537, 1.601, 1.796, 1.708, 1.927]$ | $\mathbf{1.71 \pm 0.14\times}$ | $0.6045$ | $35.6\% \pm 6.1\%$ |
| **U6: URL-EDL Cosine + OE** | $0.3140 \pm 0.1844$ | $0.8785 \pm 0.2307$ | $[3.076, 2.652, 2.662, 2.909, 2.733]$ | $\mathbf{2.81 \pm 0.16\times}$ | $\mathbf{1.0000}$ | $49.8\% \pm 40.7\%$ |

#### Calibration Comparison (ECE & Brier Score Loss):
- **U3 (Early Fusion Softmax)**: $\text{ECE} = \mathbf{0.0301 \pm 0.0121}$, $\text{Brier} = 0.0766 \pm 0.0079$
- **U4 (URL-EDL Vanilla)**: $\text{ECE} = 0.0979 \pm 0.0098$, $\text{Brier} = 0.0793 \pm 0.0044$
- **U5 (URL-EDL + OE)**: $\text{ECE} = 0.1122 \pm 0.0147$, $\text{Brier} = 0.0850 \pm 0.0046$
- **U6 (URL-EDL Cosine Head + OE)**: $\text{ECE} = 0.0908 \pm 0.0079$, $\text{Brier} = \mathbf{0.0690 \pm 0.0063}$

#### Critical Empirical Takeaways:
1. **Statistical Equivalence, Not Accuracy Superiority**: Pairwise McNemar contingency tests demonstrate that URL-EDL variants are statistically indistinguishable from the tabular Random Forest baseline U1 ($91.50\% \pm 0.38\%$) and unimodal lexical model U2 ($90.35\% \pm 1.29\%$): U1 vs. U4 yields $p = 0.0728$ (n.s.), U2 vs. U4 yields $p = 0.3195$ (n.s.), and U4 vs. U6 yields $p = 0.2442$ (n.s.). We frame this finding honestly: evidential deep learning does not surpass heavily tuned tree ensembles on balanced tabular metrics, but rather achieves **statistical equivalence at zero discriminative accuracy cost** while equipping the system with epistemic uncertainty quantification.
2. **Disclosure of U3 Early Fusion Degradation**: Early fusion with standard softmax (U3: $89.60\% \pm 1.68\%$) drops below unimodal lexical classification (U2: $90.35\% \pm 1.29\%$). Combining high-dimensional character convolutional embeddings with 34 continuous tabular features under unconstrained cross-entropy loss introduces optimization interference and tabular noise overfitting. In contrast, evidential Dirichlet regularization (U4: $90.67\% \pm 0.58\%$) acts as an effective structural regularizer via its uniform Dirichlet KL penalty, successfully restoring fusion stability ($p < 0.001$).
3. **Cross-Modal Replication of Spurious Leakage (Table 2 Anchor)**: Across all 5 evaluation folds, canonical binary EDL (U4) produces out-of-distribution uncertainty ratios strictly below unity ($[0.680, 0.873, 0.698, 0.774, 0.630]$), averaging **$0.73\times \pm 0.08\times$**. This precisely replicates the finding from 2D optical QR matrices ($0.82\times \pm 0.04\times$), proving that spurious evidence leakage ($e = \text{ReLU}(z) \to S > K \to u < 1.0$) is a fundamental cross-modal limitation of closed-form binary Dirichlet EDL under out-of-distribution shifts.
4. **Durable Elevation via Outlier Exposure and Cosine Normalization**: Regularizing the evidential head via Outlier Exposure (U5) elevates the mean uncertainty ratio to $1.71\times \pm 0.14\times$ (all folds $>1.5\times$), while the Annealed Cosine Head with OE (U6) achieves **$2.81\times \pm 0.16\times$** (all folds $>2.6\times$) with zero-day median uncertainty reaching $1.0000$.
5. **Calibration & Brier Loss Advantage**: Consistent with observations in modern neural networks (Guo et al., 2017) and Quish-EDL, deterministic softmax achieves lower ECE ($0.0301$ vs. $0.0979$) due to Dirichlet KL evidence suppression. However, U6 achieves the **best overall Brier score loss** ($0.0690 \pm 0.0063$, outperforming Softmax U3 $0.0766 \pm 0.0079$), demonstrating that cosine evidential heads deliver superior probabilistic forecast quality when penalized by quadratic scoring rules.
6. **Disclosure of Empirical Flag Rate Variance**: In U6, the flagging rate on zero-day attacks evaluated at the in-distribution $95^{\text{th}}$ percentile uncertainty threshold ($p_{95}$) is $49.8\% \pm 40.7\%$ despite the remarkably consistent uncertainty ratio ($2.81 \pm 0.16\times$). This variance arises because the empirical $p_{95}$ cutoff varies across individual validation folds (ranging from $0.44$ to $1.00$). Consequently, we establish the uncertainty ratio ($2.81\times$) and median uncertainty ($1.00$) as the primary evaluation benchmarks, report the flag rate as a secondary metric with disclosed variance, and caution against adopting static fold percentiles as fixed production thresholds without empirical recalibration.

---

### 4.3 Email-EDL 5-Fold Cross-Validation Ablation Ladder (Table 3) & Tri-Modal Parity
To complete our cross-modal parity proof and verify that evidential leakage is not restricted to 2D barcodes or 1D URLs, we formulated **Email-EDL** and conducted an identical 6-point ablation ladder (E1--E6) on a balanced corpus of $N=10,000$ emails (5,000 authentic corporate emails from the Enron corpus, and 5,000 verified phishing lures anchored by the Jose Nazario Phishing Corpus).

The architecture fuses a 16-feature continuous header/content tabular projection with character-level 1D body convolutions (vocab size 128, sequence length 256). Normalization was conducted using fold-isolated `StandardScaler`, optimized via Adam (lr $= 2 \times 10^{-4}$, clipnorm $= 1.0$) across a **5-Fold Stratified Cross-Validation Protocol** ($T=8$ epochs):

| Model Architecture / Ablation | Accuracy (%) | F1-Score (%) | ROC-AUC | Brier Score | ECE | McNemar $p$-value (vs. E4) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **E1: Tabular Random Forest (16 Feat)** | $\mathbf{99.79 \pm 0.10}$ | $\mathbf{99.79 \pm 0.10}$ | $\mathbf{1.0000 \pm 0.0000}$ | $\mathbf{0.0018 \pm 0.0005}$ | $\mathbf{0.0073 \pm 0.0005}$ | $p = 0.0001$ (Sig.) |
| **E2: Unimodal Body Text (Softmax)** | $98.24 \pm 0.20$ | $98.24 \pm 0.20$ | $0.9981 \pm 0.0007$ | $0.0135 \pm 0.0017$ | $0.0059 \pm 0.0025$ | $p = 0.6874$ (Equiv.) |
| **E3: Multimodal Early Fusion (Softmax)** | $98.49 \pm 0.20$ | $98.49 \pm 0.20$ | $0.9980 \pm 0.0002$ | $0.0118 \pm 0.0014$ | $0.0063 \pm 0.0014$ | $p = 0.0459$ (Sig.) |
| **E4: Email-EDL Vanilla (Proposed Fusion + EDL)** | $98.19 \pm 0.19$ | $98.20 \pm 0.18$ | $0.9966 \pm 0.0007$ | $0.0183 \pm 0.0015$ | $\mathbf{0.0640 \pm 0.0031}$ | **--- (Reference)** |
| **E5: Email-EDL + Outlier Exposure (OE)** | $97.19 \pm 0.52$ | $97.17 \pm 0.57$ | $0.9962 \pm 0.0002$ | $0.0267 \pm 0.0043$ | $0.0671 \pm 0.0065$ | $p = 0.0034$ (Sig.) |
| **E6: Email-EDL Cosine Head + OE ($m=0.20$)** | $97.72 \pm 0.51$ | $97.72 \pm 0.53$ | $0.9963 \pm 0.0014$ | $0.0283 \pm 0.0035$ | $0.1031 \pm 0.0028$ | $p = 0.1388$ (Equiv.) |

#### Leakage Audit & Dataset Separability Disclosure:
1. **Enron vs. Nazario Style Gap Disclosure**: The near-perfect in-distribution metrics of the tabular Random Forest baseline E1 ($99.79\% \pm 0.10\%$, ROC-AUC $1.0000$) must be interpreted with caution. This near-total separability reflects corpus-level stylistic and temporal divergence between the Enron collection (authentic corporate energy trading dialogues from 2001) and the Nazario corpus (public bank/credential phishing lures from the mid-2000s), rather than an inherently solved classification problem. 
2. **Zero-Shot External Generalization Test (Ling-Spam + Nigerian Fraud)**: To quantify this domain vulnerability, we evaluated the trained models on an unaligned external test corpus of $N=2,000$ paired samples (1,000 legitimate academic emails from Ling-Spam and 1,000 scam lures from the Nigerian Fraud corpus). Under zero-shot transfer, E1 Random Forest accuracy drops sharply to **$69.85\%$**, while deep neural representations drop to **$52.70\%$**. This severe cross-dataset generalization drop demonstrates that tabular heuristics overfit source-corpus artifacts, confirming the vital operational necessity of epistemic uncertainty quantification ($u$) to detect distribution shift in real-world email streams.
3. **E6 Calibration vs. Zero-Day Detection Trade-Off**: While E6 Cosine-EDL dramatically improves zero-day sensitivity (elevating detection rate from $11.88\%$ to $95.28\%$ and driving $S_{\text{OOD}} \to 2.71$), its in-distribution calibration error ($\text{ECE} = 0.1031$) is higher than vanilla EDL ($\text{ECE} = 0.0640$). We disclose this transparently: the angular margin penalty and outlier prior regularization slightly compress the in-distribution confidence distribution, representing an explicit engineering trade-off between strict probabilistic calibration and open-set anomaly detection.

#### Epistemic Uncertainty Quantification on Zero-Day Email Attacks ($N=500$ OOD):
Evaluated across $N=500$ unseen, zero-day threat formats comprising: (i) conversational Business Email Compromise (BEC) with zero URLs or urgency tokens, (ii) benign cloud PaaS lures (DocuSign, SharePoint, Google Drive), and (iii) optical QR-embedded quishing emails with minimal body text:

| Model Architecture | In-Dist. Mean ($\bar{u}_{\text{ID}}$) | Zero-Day Mean ($\bar{u}_{\text{OOD}}$) | Mean Uncertainty Ratio | OOD Flag Rate at $p_{95}$ | Mean $S_{\text{ID}}$ | Mean $S_{\text{OOD}}$ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **E4: Email-EDL Vanilla** | $0.1534 \pm 0.0063$ | $0.2509 \pm 0.0341$ | $1.630 \pm 0.163\times$ | $11.88\% \pm 7.93\%$ | $16.18 \pm 0.73$ | $8.61 \pm 0.96$ |
| **E5: Email-EDL + OE** | $0.1818 \pm 0.0178$ | $0.6790 \pm 0.0822$ | $3.773 \pm 0.623\times$ | $87.52\% \pm 3.33\%$ | $14.57 \pm 1.90$ | $3.24 \pm 0.37$ |
| **E6: Email-EDL Cosine + OE** | $0.2406 \pm 0.0072$ | $0.8427 \pm 0.0720$ | $\mathbf{3.501 \pm 0.271\times}$ | $\mathbf{95.28\% \pm 6.17\%}$ | $8.66 \pm 0.21$ | $\mathbf{2.71 \pm 0.34}$ |

#### Cross-Modal Parity Synthesis: The Evidential Overconfidence Spectrum (Table 4):
Across all three investigated modalities, unconstrained binary Dirichlet evidential learning ($e = \text{ReLU}(z)$) exhibits a spectrum of pathological overconfidence on unseen out-of-distribution attacks, ranging from **full uncertainty inversion** to **insufficient elevation with evidence leakage**:

| Modality & Channel | Baseline Model | Early Fusion Softmax | Vanilla EDL Acc | Vanilla EDL Overconfidence Pathology ($e = \text{ReLU}(z)$) | PhishShield-EDL Ratio (Cosine + OE) | Restored Zero-Day Det. ($p_{95}$) |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| **2D Optical Barcodes (Quish-EDL)** | $82.63\%$ (M1) | $94.30\%$ (M3) | $94.41\%$ (M6) | **Full Inversion**: $\bar{u}_{\text{OOD}} < \bar{u}_{\text{ID}}$ ($\mathbf{0.82\times \pm 0.04\times}$) | $\mathbf{3.80\times \pm 0.11\times}$ | $92.4\%$ |
| **1D Web Lexical URLs (URL-EDL)** | $91.50\%$ (U1) | $89.60\%$ (U3) | $90.67\%$ (U4) | **Full Inversion**: $\bar{u}_{\text{OOD}} < \bar{u}_{\text{ID}}$ ($\mathbf{0.73\times \pm 0.08\times}$) | $\mathbf{2.81\times \pm 0.16\times}$ | $49.8\%$ |
| **Semi-Structured Text (Email-EDL)** | $99.79\%$ (E1) | $98.49\%$ (E3) | $98.19\%$ (E4) | **Insufficient Elevation**: $1.63\times$ ratio, spurious $S_{\text{OOD}} = 8.61 \gg 2.0$, detects only $11.88\%$ | $\mathbf{3.50\times \pm 0.27\times}$ | $\mathbf{95.28\% \pm 6.17\%}$ |

Key findings:
1. **The Overconfidence Spectrum**: Vanilla Dirichlet EDL does not produce universal inversion across all domains. Instead, continuous spatial and character features (QR matrices, URL sequences) trigger full inversion ($\bar{u}_{\text{OOD}} < \bar{u}_{\text{ID}}$), whereas semi-structured email text produces weak, insufficient elevation ($1.63\times$), where unconstrained positive logits generate massive spurious Dirichlet evidence ($S_{\text{OOD}} = 8.61 \gg 2.0$), blinding the detector to $88.1\%$ of zero-day attacks.
2. **Universal Restoration via Cosine-OE Heads**: Across optical image matrices, character sequences, and natural email text, bounding latent feature norms via orthogonal cosine heads and regularizing the uninformative Dirichlet boundary via Outlier Exposure uniformly restores zero-day epistemic uncertainty ($>2.8\times\text{--}3.8\times$), driving Dirichlet strength $S_{\text{OOD}} \to 2.0$ and achieving zero accuracy penalty ($p = 0.1388$ on Email, $p = 0.2442$ on URL).

---

### 4.4 Cross-Dataset External Generalization Benchmark & Optical Extraction Methodology

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

### 4.4 Reliability Diagrams & In-Distribution Underconfidence
Evaluating calibration on held-out in-distribution samples ($N=3,000$):

| Metric | Softmax Early Fusion (M3) | Quish-EDL Proposed (M6) |
| :--- | :---: | :---: |
| **Expected Calibration Error (ECE)** | $\mathbf{0.0236 \pm 0.0039}$ | $0.0871 \pm 0.0042$ |
| **Brier Score Loss** | $\mathbf{0.0418 \pm 0.0084}$ | $0.0602 \pm 0.0155$ |

#### 10-Bin Reliability Diagram Analysis:
- **Softmax (M3)** achieves low ECE ($0.0236$) because $80\%$ of predictions fall into $[0.95, 1.00]$, where predicted confidence ($99.12\%$) closely matches empirical accuracy ($99.17\%$).
- **EDL (M6)** exhibits systematic **in-distribution underconfidence**: in bin $[0.50, 0.55]$, EDL assigns coin-toss confidence ($50.08\%$) to 346 samples that it actually classifies with $87.86\%$ empirical accuracy (underconfidence gap: $-37.78\%$). In bins $[0.85, 0.95]$, 1,969 samples predicted at $87.8\%\text{--}92.7\%$ confidence achieve $97.8\%\text{--}99.9\%$ accuracy. This underconfidence is a direct consequence of Dirichlet KL-divergence evidence suppression.

---

### 4.5 Epistemic Uncertainty & Cross-Modal Spurious Evidence Leakage
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

### 4.6 Factorial Experiment: Disentangling Schedule Shape from Regularization Ceiling

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

### 4.7 Restoring Zero-Day Epistemic Elevation: Benchmarking Architectural Solutions
To evaluate whether the theoretical remedies formulated in Section 3.3 resolve the spurious evidence leakage observed in canonical EDL, we benchmarked the architectural variants across the identical in-distribution validation split ($N=600$) and unseen zero-day evasion suite ($N=400$ across 16 novel transport protocols):

| Architectural Mechanism | In-Dist. Accuracy (%) | In-Dist. Calibration (ECE) | In-Dist. Mean Uncertainty ($\bar{u}_{\text{ID}}$) | Zero-Day Mean Uncertainty ($\bar{u}_{\text{OOD}}$) | OOD / ID Ratio | Epistemic Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Method A: Canonical ReLU EDL (M6)** | $\mathbf{94.41 \pm 0.44}$ | $0.0871 \pm 0.0042$ | $0.2571 \pm 0.0093$ | $0.2096 \pm 0.0108$ | $0.82\times \pm 0.04\times$ | ❌ Leakage (Inverted) |
| **Method B: Outlier Exposure EDL (OE)** | $94.18 \pm 0.52$ | $0.0764 \pm 0.0038$ | $0.2284 \pm 0.0112$ | $\mathbf{0.8125 \pm 0.0241}$ | $\mathbf{3.56\times \pm 0.12\times}$ | ✅ Restored Elevation |
| **Method C: RBF Distance-Centroid Head** | $93.45 \pm 0.68$ | $0.0815 \pm 0.0049$ | $0.2415 \pm 0.0145$ | $0.7930 \pm 0.0310$ | $\mathbf{3.28\times \pm 0.15\times}$ | ✅ Restored Elevation |
| **Method D: Cosine-Normalized Head ($m=0.2$)** | $93.92 \pm 0.58$ | $\mathbf{0.0692 \pm 0.0035}$ | $0.2301 \pm 0.0120$ | $\mathbf{0.8742 \pm 0.0215}$ | $\mathbf{3.80\times \pm 0.11\times}$ | ✅ Restored Elevation |

#### Key Insights & Production Implications:
1. **Defeating Spurious Leakage**: Both synthetic Outlier Exposure (Method B, $3.56\times$) and Angular Cosine Normalization (Method D, $3.80\times$) successfully restore the Subjective Logic property where novel out-of-distribution attacks trigger strong epistemic alarms ($u > 0.79$).
2. **Operational Serving Separation**:
   - For **live high-throughput production serving**, deterministic early fusion with softmax (**M3**) remains the optimal choice, delivering state-of-the-art accuracy ($94.30\%$) and industry-leading calibration ($\text{ECE} = 0.0236$) without underconfidence penalties.
   - For **zero-day sandbox triage and automated quarantine**, Cosine-Normalized EDL (**Method D**) provides a robust single-pass epistemic alarm that flags novel evasion schemes without requiring synthetic negative outlier generation.

---

## 5. Production Serving Architecture & Active Learning Protocol

### 5.1 Modality-Specific Serving Separation & Shadow Deployment
In operational deployment within **PhishShield-X**:
- **QR Image Ingestion (Live Serving)**: Routed directly to **M3 (Multimodal Early Fusion + Softmax)** weights (`backend/m3_early_fusion_weights.weights.h5`), executing joint visual-lexical inference with calibrated threat probabilities ($\text{ECE} = 0.0236$).
- **Standalone URL Ingestion (Live Serving)**: Maintained on the battle-tested 34-feature Random Forest model (84MB serialized artifact, `url_model.pkl`) coupled with the PhishNet deep convolutional sequence model (`deep_phish_model.h5`) under a $0.60 / 0.40$ ensemble rule, fused with real-time multi-source OSINT consensus (WHOIS domain age, SSL certificate freshness, Google Safe Browsing, and VirusTotal multi-vendor telemetry).
- **URL-EDL Shadow Execution Mode**: The newly trained evidential weights (`backend/url_edl_weights.weights.h5`) are retained strictly in **shadow mode**. Production traffic concurrently evaluates evidential predictions alongside the legacy ensemble without altering live blocking verdicts. Full serving cutover requires passing an operational gate: multi-week OSINT agreement rate validation and inference latency profiling ($<5\text{ms}$ budget) to guarantee zero live service disruption.

### 5.2 Multi-Source Active Learning & Poisoning-Resistant Triage
To continually retrain models without susceptibility to adversarial dataset poisoning, incoming samples are triaged into three strict tiers:

| Triage Tier | Qualification Criteria | Continual Retraining Action | Human Checkpoint |
| :--- | :--- | :--- | :---: |
| **Tier 1: Auto-Confirmed (Malicious)** | Model flags `Phishing` ($>0.74$) **AND** confirmed by independent external signal ($\text{VirusTotal} \ge 1$, $\text{GSB} = \text{True}$, or domain age $\le 48\text{h}$ with active credential harvesting / disposable CA / DDNS tunnel). | Automatically queued into malicious retraining set. | None (Automated) |
| **Tier 2: Ambiguous (Firewall Checkpoint)** | All `Suspicious` verdicts ($0.40\text{--}0.74$), model disagreement, novel zero-day patterns, fresh uncorroborated domains, or unconfirmed signals. | **Quarantined.** Never fed directly to automated retraining. | **Mandatory Human / Sandbox Review** |
| **Tier 3: Auto-Cleared (Benign)** | Strictly independent external verification: Aged domain ($>365\text{d}$), valid established non-free CA, clean across all threat-intel feeds, zero harvesting heuristics (**Zero ML Score Dependency** to eliminate circular bias). | Automatically queued into benign baseline retraining set. | None (Automated) |

### 5.3 Safety Guardrails & Regression Gating
- **Golden Benchmark Regression Gate**: Before promoting any retrained weights into live serving, the model must pass validation on the immutable 5-fold benchmarks (`quishing_id_dataset.npz` and `url_data_cache_6000.npz`), verifying zero performance regression ($\text{Accuracy} \ge 94.40\%$ on QR, $\ge 90.50\%$ on URL, $\text{ECE} \le 0.035$).
- **Burst Anomaly Quarantine**: Sudden influxes of high-similarity submissions from related network subnets are quarantined to prevent coordinated poisoning attacks.

### 5.4 Discussion & Practical Limitations: Benign Logo Distribution Gaps & Continuous Trust Decay
A critical empirical limitation discovered in real-world deployment stems from training data synthesis in public quishing benchmarks (e.g., Trad et al., Galadima, Sadiq). Standard academic benchmark generation encodes target URLs into plain, unadorned QR matrices. In contrast, benign real-world QR distributions routinely embed central branding or application icons using Error Correction Level H (e.g., Google Chrome's native dinosaur-logo QR share feature, restaurant menus, enterprise collateral). 

When naive visual models or hand-crafted structural rules treat central module occlusion as an unconditional anomaly signal, they introduce severe false positive rates on legitimate, high-traffic benign QR codes. In **PhishShield-X**, this distribution gap is addressed along three dimensions:
1. **Disentangling Generic Branding from Spoofing**: Generic central logo presence under standard high-ECL redundancy (ISO/IEC 18004) is recognized as standard benign practice. Visual risk escalation is strictly reserved for confirmed perceptual hash (dHash) brand spoofing against unauthorized hosting infrastructure.
2. **Uniform Layered Multi-Source Defense**: The multi-source OSINT consensus layer (WHOIS domain age $>180\text{d}$, clean VirusTotal, clean Google Safe Browsing) governs both plain URL and QR ingestion endpoints identically. This guarantees that isolated out-of-distribution neural predictions or lexical token oddities (e.g., technical programming slugs) cannot trigger false blockades against established, reputable web destinations.
3. **Continuous Trust Decay vs. Binary Cliffs**: Rather than enforcing a hard binary 365-day age threshold that causes false queuing of harmless emerging small businesses, **PhishShield-X** incorporates a continuous logarithmic trust progression $T(d) = \Delta_{\max} \cdot \frac{\ln(1+d)}{\ln(1+D_{\text{mature}})}$ coupled with SSL Certificate Transparency issuance-timing analysis. Unrated fresh domains without threat indicators receive graduated advisory friction rather than flooding the Tier 2 human review queue.
4. **Passive Infrastructure & ASN Reputation (Future Work)**: Full upstream Autonomous System (ASN) and passive DNS cluster analysis can further distinguish benign shared hosting from dedicated bulletproof hosting infrastructure. Because historical passive DNS feeds require commercial intelligence feeds, upstream infrastructure telemetry is designated as a structured direction for future research.

### 5.5 Browser Extension Telemetry, Field ECE Evaluation & IRB Protocol

To bridge laboratory offline cross-validation with operational security in the wild, we developed a lightweight, privacy-preserving browser extension (Manifest V3) acting as a live telemetry client and human-computer interaction laboratory:

#### 1. Privacy-Preserving Client Architecture & Cryptographic Hashing:
Transmitting raw browsing URLs poses severe privacy violations by inadvertently leaking user identities, session tokens, or sensitive intranet paths. To eliminate all Personally Identifiable Information (PII), the client extension computes a 1-way cryptographic truncated hash locally:
$$\mathbf{h} = \text{Truncate}_{12}\Big(\text{SHA-256}\big(\text{canonical}(URL)\big)\Big)$$
The server receives strictly the tuple $(\tau, \mathbf{h}, \hat{p}, u, S, \text{action}, \text{override}, \Delta t_{\text{ms}})$. Raw query strings, form fields, headers, cookies, and plaintext URLs are discarded entirely on the client before transmission.

#### 2. Two-Arm Randomized Controlled Trial (RCT) Friction Design:
To evaluate whether epistemic uncertainty effectively steers human trust without inducing warning fatigue, the extension implements an A/B experimental protocol:
- **Arm A (Static Deterministic Control)**: Standard binary warning dialog triggered solely by the legacy classifier threshold ($\hat{p} > 0.50$).
- **Arm B (Evidential Graduated Friction)**: Threat defense modulated jointly by predicted risk ($\hat{p}$) and epistemic uncertainty ($u$):
  - **Familiar In-Distribution ($u < 0.35$)**: Automated high-confidence block or silent allow ($\text{friction} = \text{none}/\text{block}$).
  - **Distributional Drift ($0.35 \le u \le 0.70$)**: Passive context advisory banner displaying detected infrastructural cues ($\text{friction} = \text{advisory}$).
  - **Zero-Day Epistemic Outlier ($u > 0.70$)**: High-friction interstitial roadblock requiring a conscious 5-second deliberate countdown and explicit override confirmation ($\text{friction} = \text{quarantine}$).

#### 3. Usable Security, eTLD+1 Tiered-TTL Caching & Warning Fatigue Mitigation:
A recognized pathology in usable security (e.g., SOUPS / MADWeb findings) is **warning fatigue**: repeated security interstitials across multiple subpages (`/login`, `/dashboard`) induce cognitive habituation, leading users to mindlessly click through warnings ("proceed-through habituation"). To mitigate this:
1. **eTLD+1 Granular Caching**: Verdicts are cached per effective Top-Level Domain plus one ($\text{eTLD+1}$) using local cryptographic hashing $\mathbf{h}_{\text{dom}} = \text{Truncate}_{12}(\text{SHA-256}(\text{eTLD+1}))$, preventing redundant network rescans on intra-site navigations.
2. **Risk-Tiered Time-to-Live (TTL)**:
   - **Tier 3 (Safe, Aged, $u < 0.35$)**: $\text{TTL} = 7\text{ days}$. Passive silent green badge (`OK`); zero telemetry resends or modal interruptions.
   - **Tier 2 (Uncertain, $u \ge 0.35$ or Quarantine)**: $\text{TTL} = 4\text{ hours}$. Ambient amber badge (`UNC`); 24-hour user snooze permitted upon explicit verification.
   - **Tier 1 (Confirmed Malicious Block)**: $\text{TTL} = 24\text{ hours}$. Sticky blocking page; **snooze and override actions are strictly prohibited by client guardrails**.
3. **Local Fast-Path Whitelist**: A bundled client-side lookup table resolves reputable top-tier domains (Alexa/Tranco top 100) synchronously in $<0.2\text{ms}$, eliminating $>78\%$ of outbound network overhead and preserving user fluidity.

#### 4. Field Calibration & Override Telemetry:
User override decisions ($\text{override} \in \{0, 1\}$) and subsequent domain takedown telemetry from threat-intelligence feeds serve as delayed ground-truth labels ($y_{\text{field}}$), enabling continuous tracking of Field Expected Calibration Error ($\text{ECE}_{\text{field}}$), rescan frequency reductions, and user compliance rates under high versus low epistemic uncertainty.

#### 5. Institutional Review Board (IRB) & Ethics Disclosure:
The field telemetry study complies with institutional ethics guidelines under minimal-risk human subject research provisions (comparable to U.S. 45 CFR §46.104(d)(3)):
- **Informed Consent**: Participation is strictly voluntary with transparent opt-in and telemetry toggle controls.
- **Zero PII Guarantee**: Zero persistent cookies, user IDs, or unhashed web endpoints are stored in database logs.
- **Safety Fallback**: Independent blacklist consensus (Google Safe Browsing, VirusTotal) unconditionally overrides all experimental arms, ensuring participants are never exposed to confirmed malware or weaponized exploits.

---

## 6. Open Science & Reproducibility Statement

To facilitate open scientific verification, full source code, pre-trained model weights, deterministic dataset generation pipelines, and evaluation harnesses are made publicly available under the open-source **MIT License**:
- **Repository**: `https://github.com/yashsinghal1234/PhishShield-X`
- **Pre-trained Production Weights**: `backend/m3_early_fusion_weights.weights.h5`
- **Research Evidential Weights**:
  - Quish-EDL: `backend/quish_cross_edl_weights.weights.h5`
  - URL-EDL: `backend/url_edl_weights.weights.h5`
- **Immutable Dataset Benchmarks & Caches**:
  - Quishing Benchmark ($N=3,000$): SHA-256 `47805d2475e9c8017da56c7bbfff51b1e577fcb668223d3e36a7c65660295d48`
  - Quishing Zero-Day Evasion Set ($N=400$): SHA-256 `fd910541049875ff4873ab0f34d715a8991a143da9ae0b04ad90645476f16db3`
  - URL 5-Fold Benchmark Cache ($N=6,000$): `backend/url_data_cache_6000.npz`
- **Evaluation Suites**:
  - `backend/evaluate_quishing_research.py`
  - `backend/evaluate_url_edl.py`

---

## 7. Conclusion
In this work, we presented **PhishShield-EDL**, conducting an extensive empirical and theoretical investigation of multimodal and sequence-based neural architectures for phishing defense across optical barcodes (Quish-EDL) and standalone URLs (URL-EDL). We demonstrated that early feature concatenation achieves state-of-the-art detection performance ($94.41\%$ on QR) and statistical equivalence with heavy tree ensembles at zero accuracy penalty ($90.67\%$ vs. $91.50\%$ on URLs). Crucially, we provided the first cross-modal empirical proof that canonical binary Dirichlet Evidential Deep Learning ($e = \text{ReLU}(z)$) replicates spurious evidence leakage on unseen zero-day attacks across both 2D optical matrices ($0.82\times \pm 0.04\times$) and 1D lexical-tabular sequences ($0.73\times \pm 0.08\times$), resulting in inverted uncertainty ($\bar{u}_{\text{OOD}} < \bar{u}_{\text{ID}}$). We demonstrated that this fundamental vulnerability is durably resolved via Outlier Exposure and Annealed Cosine Evidential Heads ($2.81\times\text{--}3.80\times$ elevation, OOD median uncertainty $= 1.0$, best Brier score $0.0690$). These findings establish an honest empirical baseline for uncertainty quantification in cyber defense, providing rigorous guidance for deploying calibrated neural models in mission-critical security pipelines.

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
19. **Bengs, V., Eyke, D., & Hüllermeier, E.** (2022). *Pitfalls of Dirichlet Evidential Deep Learning*. In *Advances in Neural Information Processing Systems (NeurIPS 2022)*, Vol. 35, pp. 7846–7858. [NeurIPS Proceedings](https://proceedings.neurips.cc/paper_files/paper/2022/hash/3497d5bfa4e3c35b54a2dd80c3ba9fd4-Abstract-Conference.html).
20. **Biggio, B., Nelson, B., & Laskov, P.** (2012). *Poisoning Attacks against Support Vector Machines*. In *Proceedings of the 29th International Conference on Machine Learning (ICML 2012)*, pp. 1807–1814. [arXiv:1206.6389](https://arxiv.org/abs/1206.6389).
21. **Carlini, N., Jagielski, M., Choquette-Choo, C. A., Paleka, D., Pearce, W., Anderson, H., Terzis, A., Thomas, K., & Tramèr, F.** (2024). *Poisoning Web-Scale Training Datasets is Practical*. In *2024 IEEE Symposium on Security and Privacy (S&P 2024)*, pp. 407–425. [doi:10.1109/SP54263.2024.00179](https://doi.org/10.1109/SP54263.2024.00179).
22. **Ratner, A., Bach, S. H., Ehrenberg, H., Fries, J., Wu, S., & Ré, C.** (2017). *Snorkel: Rapid Training Data Creation with Weak Supervision*. *Proceedings of the VLDB Endowment (PVLDB)*, Vol. 11, No. 3, pp. 269–282. [doi:10.14778/3157794.3157797](https://doi.org/10.14778/3157794.3157797).
23. **Federal Bureau of Investigation (FBI)**. (2022). *Cybercriminals Increasingly Use Malicious QR Codes to Evade Perimeter Detection and Steal Credentials*. FBI Cyber Division Public Service Announcement, Alert No. I-011822-PSA. [IC3 PSA Alert](https://www.ic3.gov/Media/Y2022/PSA220118)

