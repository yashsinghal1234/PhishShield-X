# Quish-EDL Model Improvement Research Report
**Date:** October 2026
**Scope:** Improving the Quishing (QR Phishing) detection model — Quish-EDL (M6) / M3 Early Fusion (production serving head)
**Sources:** arXiv 2505.03451 (Trad & Chehab 2025), arXiv 2602.01477 (DIP-EDL), NeurIPS 2025 Flexible EDL, CAAMF (2026), EfficientNet/MobileNet comparisons, PostNet/NatPN literature

---

## 1. Current Architecture Weaknesses (Identified from Codebase)

| # | Weakness | Where | Impact |
|---|----------|-------|--------|
| W1 | **Visual stream too shallow** — single `Conv2D(16)` + `MaxPool(4x4)` + Flatten (256 units). Receptive field is tiny; no multi-scale features. | `quish_cross_edl.py:99-105`, M3 in `quishing_engine.py:336-341` | Structural phishing cues (module irregularity, ECL masking artifacts) are missed |
| W2 | **64×64 downsample destroys module detail** — `cv2.resize(gray, (64,64), INTER_AREA)` collapses a 69×69+ QR to 64×64 with heavy averaging; finder-pattern and module-spacing signals are averaged away. | `quishing_engine.py:381-383` | The visual branch sees a blurred QR — near-noise |
| W3 | **"Cross-modal co-attention" is actually just concatenation** — the named 'QuishCross-EDL (Cross-Modal Visual-Lexical Co-Attention)' fused via `concatenate()`. No attention, no cross-modal interaction. | `quish_cross_edl.py:119` | Redundant modalities; model can't learn "visual pattern contradicts payload text" (the core conflict signal) |
| W4 | **NO tabular/host features in Quish-EDL** — URL-EDL uses 34-D tabular features, Quish-EDL ignores domain age, TLD risk, entropy, brand distance at QR decision time. | `quish_cross_edl.py:94-138` | Information already computed by the pipeline is wasted |
| W5 | **Dataset homogeneity risk** — if training QRs are generated from PhishStorm URLs with one QR library, one version, one ECL, the visual stream learns *generator artifacts*, not phishing cues. | `generate_quishing_benchmark.py` | Zero-day QR styles (styled/logos/colored) → OOD → the exact failure mode EDL is supposed to flag |
| W6 | **M3 production head is plain Softmax** — calibrated (ECE 0.0236) but produces NO epistemic uncertainty; the EDL head is research-only. | `quishing_engine.py:353-357` | Production verdicts have no zero-day uncertainty signal |
| W7 | **No adversarial robustness** — QR codes are trivially adversarially perturbable (logo overlays, module swaps). No adversarial training. | training scripts | Attackers can force misclassification |
| W8 | **Feature bottleneck at 32-D** for two modalities each; Dense(48→32) fusion after concat of two 32-D vectors. | both models | Capacity starved relative to 64×64 input |

---

## 2. State-of-the-Art Evidential Deep Learning Upgrades (2024–2026)

### 2.1 DIP-EDL — Density-Informed Pseudo-Counts (arXiv 2602.01477) ⭐ Highest impact
**Problem it solves:** Standard Sensoy EDL conflates epistemic and aleatoric uncertainty → *systematic overconfidence on OOD inputs* (exactly the zero-day QR failure your project targets).
**Mechanism:** Decouple class prediction from uncertainty magnitude by (a) estimating the conditional label distribution and (b) separately estimating a marginal covariate density (e.g., via density head / normalizing-flow on features). Evidence is preserved in high-density (ID) regions and shrunk toward the uniform Dirichlet prior in low-density (OOD) regions.
**Reported results:** Highest ID accuracy (91.8%) AND best OOD calibration (best OOD Brier score with strong AUROC/AUPR) — the only method simultaneously strong at both.
**Integration cost:** Medium — add a density-estimation branch on the fused feature `h` (e.g., small normalizing flow or Mahalanobis/GMM head fitted post-hoc), multiply evidence by the density gate.
**Recommended:** YES — this directly upgrades your u = K/S zero-day signal quality.

### 2.2 PostNet / NatPN — Normalizing-Flow Posterior Networks
Parameterize the Dirichlet via feature-space density (Normalizing Flow).
**Note:** 2024 NeurIPS audit ("Are UQ capabilities of EDL overestimated?") found neither belief-matching nor density parameterization is uniformly superior; PostNet shows strong ranking but can exhibit high OOD Brier score. DIP-EDL supersedes. Cheaper alternative: **NatPN (Natural Posterior Network)** — flow happens in a natural/real parameterization and doesn't need OOD data to train.
**Recommended:** Consider NatPN as a lighter alternative if DIP-EDL's flow branch is too heavy.

### 2.3 Flexible Evidential Deep Learning (NeurIPS 2025)
Replaces the ad-hoc Dirichlet parameterization with a flexible evidence parameterization (logit-normal style), showing that over-flat logits hurt calibration.
**Relevance to your code:** Your current fix uses softplus evidence (already better than ReLU). The temperature-scaled CosineEvidenceHead in `url_edl.py` is on the right track; port that head to Quish-EDL for strict architectural parity (currently Quish-EDL uses plain softplus, URL-EDL uses cosine margin head — inconsistency between your own M6 models).

### 2.4 Mixed Dirichlet Distributions (arXiv 2402.06160)
Distributes uncertainty over a *mixture* of Dirichlets rather than one — better represents multi-modal uncertainty (e.g., "either clearly benign oritched toward phish").
**Recommended:** Lower priority than 2.1/2.2 but useful for the research paper novelty section.

### 2.5 Post-hoc calibration for the M3 softmax head
Your M3 claims ECE 0.0236. Keep temperature scaling on a held-out set, and recheck after any architecture change. Also compute selective-risk @80% coverage — a stronger practical metric than raw ECE (found in recent EDL audit literature: temperature scaling fixes ECE but NOT selective risk).

---

## 3. Quishing-Specific State of the Art (2025–2026)

### 3.1 QR-centric detection *without payload decode* (arXiv 2505.03451, AUB 2025)
- Direct pixel/structural analysis of QR codes achieves **AUC 0.9133 (LightGBM)** without ever decoding the URL
- Feature importance shows most pixels are non-informative; only弟兄 specific regions matter (decoder-format strips, timing patterns, corner data regions)
- **Your integration opportunity:** add a cheap XGBoost/LightGBM QR-structural ensemble member as a *third* signal alongside M3 + URL analysis (you already fuse signals in `detect_qr_phishing` — this slot is open). Works even when decode fails.

### 3.2 CAAMF — Conflict-Aware Adaptive Multimodal Fusion (2026)
Directly addresses W3: instead of blind averaging, fusion weights each modality by its *reliability in this instance*, and explicitly routes *conflicts* (visual says benign, payload says phish) to a conflict-resolution path.
**Integration:** replace `concatenate()` with (a) per-modality confidence scoring, (b) gated fusion `h = w_v·f_v + w_l·f_l + w_conf·abs(f_v−f_l)`, (c) this is cheap (a few Dense layers) and directly targets the core deception case: legit-looking QR image wrapping a malicious payload.

### 3.3 Incremental/continual learning & adaptive retraining (Sci Reports 2026; ACM 3802927)
- QR phishing campaigns evolve fast; static models decay
- Your Phase-4 `evaluate_active_learning_triage` is already designed for this — extend it: Tier-2 quarantine outputs feed a periodic incremental retraining job (e.g., monthly incremental fit with new labels) rather than full retrain
- Use EDL uncertainty as the *sampling priority* for human review (active learning: label the highest-u samples first — maximizes label efficiency)

### 3.4 Transformer / distilled lightweight models
Emerging 2026 literature (Contra-KD, SwiftURL) shows small transformer char-models with contrastive pretraining beating CNNs on malicious-URL lexical tasks. For Quish-EDL's lexical stream: replace the CNN char-branch with a small 2-layer transformer encoder + contrastive pretraining on all historical payloads. Keep it ≤ 1M params to stay mobile-friendly.

---

## 4. Visual Backbone Modernization (W1, W2 fixes)

| Option | Params | Why | Cost |
|--------|--------|-----|------|
| **EfficientNet-B0 (grayscale-adapted)** | ~4M (5.3M w/ head) | Best accuracy-per-FLOP; publishes consistently above MobileNet on small-image classification | Highest but acceptable server-side |
| **MobileNetV3-Small** | ~2.5M | Depthwise separable convs; designed for constrained inference | Medium |
| **CNN with 3 scale-branches (47→96→128 px)** | ~100K | Preserves module detail, cheap | Lowest |
| **Keep 64×64 but bicubic / nearest-neighbor + multi-crop** | — | Zero architecture change | Trivial |

**Concrete minimum-viable fix for W2:** Stop downsampling 64×64 once. Use the *padded_white variant returned by `robust_decode_qr`* as the network input (it IS the crisp decoded variant), resize to **96×96 nearest/bicubic**, keep aspect ratio, and pass along with module-grid normalization. Change IMG_SHAPE to (96,96,1).

**Strong fix for W1:** Replace the single-Conv2D visual stream with a 3-stage depthwise-separable CNN:
```
Input(96,96,1)
→ DWConv(3x3)+PWConv(24) +RELU, maxpool2   # module-level detail
→ DWConv(5x5)+PWConv(48)  +RELU, maxpool2  # region-level (finder patterns)
→ DWConv(3x3)+PWConv(64)  +RELU, GAP       # global structure
→ Dense(64)
```
~50K params — far below M3's real budget, dramatically stronger features.

---

## 5. Data Strategy (W5, W7 fixes)

1. **Diversify QR generation:** your benchmark generator should sweep: version {3,7,13,21,30}, ECL {L,M,Q,H}, style {standard, colored bg, rounded modules, logo-embedded, painted dots}, quiet-zone {0, 4, 10}, and 3+ generator libraries. Log the generation params as *conditional metadata* so the model can't use them as shortcuts (train with random param dropout).
2. **Real-capture augmentation:** perspective warp (±25°), Gaussian/PSF blur, JPEG 40-90, screen-moire pattern, paper-print noise, low light. Your auto-QR scan path gets these from real screenshots — training data must match.
3. **OOD holdout set for calibration:** curate ~2K OOD samples (non-QR images, non-URL payload QRs: WIFI/VCARD/plaintext, ultra-styled designer QRs) strictly excluded from training. Mandatory to honestly report AUROC/FPR@95 for the uncertainty claim — this is the metric reviewers will probe.
4. **Adversarial robustness:** add PGD-7 adversarial training on the visual stream (ε≈8/255 on grayscale) — QR codes' binary structure makes them *easier* to perturb, not harder.
5. **Balance decode-failure handling:** train the model to output *high uncertainty* (not a guess) on partially decoded/damaged QRs — feeds naturally into your EDL loss via the OOD term.

## 6. Training Recipe Improvements

- **Cosine LR schedule + warmup + AdamW (wd=5e-4)** instead of plain Adam (your current scripts use adam)
- **Label smoothing 0.05** for ID samples in the softmax M3 head
- **SWA / checkpoint averaging** over final 3 epochs (free ~0.3-0.8% accuracy on small datasets)
- **Strict architectural parity enforcement:** align Quish-EDL with URL-EDL's CosineEvidenceHead (tau=0.2, margin=0.2, scale=10) — right now your two flagship models use different evidence heads; the research paper should explain WHY if intentional, otherwise unify
- **Multi-task evidence:** add an auxiliary head predicting "decodability" (can robust_decode succeed) on the visual stream — improves feature quality and doubles as a confidence prior at inference

## 7. System-Level / Architecture Improvements

1. **Route high-u samples to the LLM cross-check** (`Trad & Chehab 2024-2025 show LLM ensembles are SOTA for ambiguous phishing`): when `u ≥ 0.70`, send the decoded payload + screenshot metadata to an LLM for second opinion; blend verndorly. Cost-capped by the fact that <10% of scans typically exceed the threshold.
2. **LightGBM QR-structural ensemble member** (§3.1): AUC 0.9133 without decoding; nearly free at inference; excellent complement because it doesn't share failure modes with the CNN.
3. **Uncertainty-gated OSINT spending:** currently VT/GSB/scrape fire on every scan. Gate aggressive OSINT calls (VT, screenshot) on model-level signals (deep_prob + edl_prob both mid-band) — this cuts latency on clearly benign AND escalates on truly ambiguous, and dramatically reduces Render API costs.
4. **Continual learning pipeline:** monthly incremental refit using Tier-1/Tier-3 auto-labeled triage data (your triage tiers are already well-designed for this), with rollback guard if ECE degrades on a frozen validation slice.

---

## 8. Prioritized Implementation Roadmap

| Priority | Item | Effort | Expected gain |
|----------|------|--------|--------------|
| P0 | Fix W2 (use decoded crisp variant + 96×96) & W1 (depthwise-separable 3-stage backbone) | 1-2 days | +3-8% accuracy on stylized/captured QRs |
| P0 | Build honest OOD holdout (real non-QR + styled QRs) and report AUROC/FPR@95 | 1 day | Scientific credibility of uncertainty claims |
| P0 | Diversify QR generation sweep + real-capture augmentation | 2 days | Big gain in real-world robustness |
| P1 | Replace concat fusion with conflict-aware gated fusion (CAAMF-lite) | 1 day | +1-3% on cross-modal conflict cases |
| P1 | Port CosineEvidenceHead to Quish-EDL (parity with URL-EDL) | 0.5 day | Cleaner paper, better calibration |
| P1 | Add DIP-EDL style density branch for OOD-shrinkage evidence | 2-3 days | +5-15% OOD AUROC, honest u |
| P2 | LightGBM QR-structural third signal in decision fusion | 1 day | +1-2% AUC, works when decode fails |
| P2 | PGD-7 adversarial training | 1 day | Robustness against evasive QRs |
| P2 | LLM second-opinion routing for u ≥ 0.70 | 1 day | Recovers zero-day catches |
| P3 | NatPN / Mixed-Dirichlet variant as ablation | 2-3 days | Paper novelty section |
| P3 | Small transformer lexical stream + contrastive pretraining | 3-5 days | Marginal but publishable |

---

## 9. Key Citations

1. Sensoy, Kaplan, Kandemir — *Evidential Deep Learning to Quantify Classification Uncertainty*, NeurIPS 2018 (your base)
2. Carlotti, Gligić, Farahi — *Density-Informed Pseudo-Counts for Calibrated Evidential Deep Learning (DIP-EDL)*, arXiv:2602.01477 — **primary recommendation**
3. *Uncertainty Estimation by Flexible Evidential Deep Learning*, NeurIPS 2025
4. *Improved EDL via a Mixture of Dirichlet Distributions*, arXiv:2402.06160
5. Trad, Chehab — *Detecting Quishing Attacks with ML Techniques Through QR Code Analysis*, arXiv:2505.03451 (2025)
6. Nigam, Bhandari — *CAAMF: Conflict-Aware Adaptive Multimodal Fusion for QR Code Phishing Detection*, JTCSST 2026
7. Kritika — *Systematic Literature Review on DL approaches for QR phishing detection*, J. Cyber Sec. Tech. 2026
8. Alsulami et al. — *Efficient Malicious QR Code Detection Using Advanced DL*, CMES 2025
9. Almousa, Alsuhibany — *QR code security: adaptive retraining for dynamic URL threat detection*, Sci Reports 2026
10. *Are UQ Capabilities of Evidential Deep Learning Overestimated?* NeurIPS 2024 (calibration audit)
