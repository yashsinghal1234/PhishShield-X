# PhishShield-X 🛡️

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

> **PhishShield-X** is a comprehensive, multi-modal phishing detection platform designed to analyze URLs, Emails, and QR codes using state-of-the-art **Deep Learning** and **Real-Time Threat Intelligence**. 

Designed to operate like an enterprise-grade security operations center (SOC) tool, it uses a Defense-in-Depth approach to evaluate threats and prevent false positives by categorizing threats into a sophisticated **Three-Tier System**.

---

## 🧠 How It Works (The Defense-in-Depth Pipeline)

When a URL is submitted to PhishShield-X, it goes through a multi-layered interrogation process in milliseconds:

### 1. The Bouncer (Whitelist)
Before invoking heavy machine learning or API calls, the system checks the domain against a massive database of the top 100,000 safest global websites (e.g., `google.com`, `github.com`). If it matches, the system immediately flags it as Safe to ensure blazing-fast performance on legitimate traffic.

### 2. The Brain (Deep Learning CNN)
If the URL isn't whitelisted, it gets processed by a custom-trained **1D Convolutional Neural Network (CNN)**.
* The URL string is tokenized into character sequences.
* The Neural Network looks for complex, hidden structural patterns (like strange character entropy, obfuscation tricks, or keyword stuffing).
* It outputs a raw probability score (e.g., 99.5% confident it's phishing based on structure).

### 3. The Detectives (Threat Intelligence APIs)
Simultaneously, the backend queries real-time cybersecurity databases to check the URL's reputation:
* **VirusTotal API:** Checks over 70 global security vendors to see if the URL is actively spreading malware.
* **Google Safe Browsing:** Cross-references the URL with Google's massive blacklist of dangerous sites.

### 4. The Interrogation (Live Heuristics)
* **Domain Age (WHOIS):** Phishing domains are usually spin-ups that only last a few days. If the domain is under 30 days old, the threat score drastically increases.
* **Typosquatting & Homograph Engine:** A string-similarity algorithm checks if the domain is trying to impersonate a famous brand (e.g., `googIe.com` vs `google.com`), flagging highly deceptive URLs instantly.
* **SSL/TLS Analysis:** It actively queries the target server's SSL certificate. A free, 90-day certificate (like Let's Encrypt) combined with a newly registered domain is penalized heavily as typical phishing behavior.
* **Live Scraper:** The backend visits the webpage using BeautifulSoup and looks for immediate red flags in the HTML code, such as hidden iframes or suspicious password fields.

### 5. The Judge (Three-Tier Classification & Override)
The system combines all this evidence into a final decision using a **Three-Tier Risk System**:
* ✅ **Safe (0% - 40%):** Both the ML model and live APIs agree the site is clean.
* ⚠️ **Suspicious (41% - 74%):** Conflicting evidence! For example, if the ML model thinks the URL *looks* highly malicious, but all live API checks (VirusTotal, Google) come back clean, the system triggers the **Override Logic**. It gives the site the benefit of the doubt, lowering the threat score from a hard block to a "Suspicious" warning.
* 🚨 **Phishing (>75%):** High certainty of a threat. Either the ML model is extremely confident and APIs agree, or a major API issued a hard block (which immediately overrides everything to 99% Phishing).

### 6. The QR Decoder (Quishing Detection)
When a QR code is uploaded, the system utilizes a **Multimodal Fusion Engine**:
* **Visual Structural Analysis:** OpenCV checks the QR code's module density and looks for large, suspicious central contours often used by attackers to mask fake logos (like a bank logo) via high Error Correction Levels (ECL).
* **Lexical Payload Analysis:** Extracts the hidden payload and checks for non-standard URI schemes (e.g., `WIFI:`, `SMSTO:`) designed to exploit device features.
* **URL Unrolling:** If a URL is found, the backend actively sends a `HEAD` request to "unroll" it. This defeats custom or obscure URL shorteners that attackers use to keep the QR code's matrix simple. The *unrolled* destination is then sent through the normal URL detection pipeline.

### 7. The Email Spoofing & Fraud Engine
When an email is analyzed, the system parses the raw `.eml` headers alongside the text body:
* **Authentication Validation (SPF/DKIM/DMARC):** Automatically parses the `Authentication-Results` header to detect if the email was cryptographically tampered with or sent from an unauthorized server.
* **Return-Path Mismatch:** Compares the visible `From` domain against the hidden `Return-Path` to detect classic spoofing impersonation.
* **Fake Job/Internship Heuristics:** Detects recruitment scams by identifying job-related keywords originating from free email providers (Gmail, Yahoo) or newly registered corporate domains.

---

## ✨ Features

- **Multi-Modal Detection:** Analyze raw URLs, paste suspicious Email text, or upload QR codes (Quishing detection).
- **Explainable AI (XAI):** The dashboard doesn't just give you a score—it gives you a detailed breakdown of *why* a threat was flagged (e.g., "VirusTotal flagged as Malicious by 4 vendors" or "Domain is very new (2 days) - HIGH RISK").
- **Premium UI:** A sleek, glassmorphic Black and Silver dashboard built with React and Tailwind CSS.
- **Analytics:** Real-time pie charts and stat counters track the volume of Safe, Suspicious, and Phishing scans.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Recharts, Lucide-React |
| **Backend** | FastAPI (Python), SQLite |
| **Machine Learning** | TensorFlow/Keras (1D CNN), Scikit-Learn |
| **Threat Intelligence** | BeautifulSoup4, Python-Whois, Google Safe Browsing API, VirusTotal API |

---

## 🚀 Installation & Setup

### 🐳 Quick Start (Docker - Recommended)
The entire project (Frontend + Backend) is fully containerized. If you have Docker Desktop installed, simply run:
```bash
docker-compose up --build
```
This single command handles all dependency installation, database creation, and networking automatically!

### Manual Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   
   # Mac/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` folder and add your API keys:
   ```env
   VT_API_KEY=your_virustotal_key
   GSB_API_KEY=your_google_safe_browsing_key
   ```
5. **Train the Deep Learning Model:** Place your dataset (`malicious_phish.csv`) into the `backend/data/` folder and run the training script. This will generate the `deep_phish_model.h5` and `tokenizer.pkl` files.
   ```bash
   python model_training.py
   ```
6. Start the FastAPI server:
   ```bash
   python -m uvicorn main:app --reload
   ```

### Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

The application will now be running locally. Open your browser and navigate to the localhost port provided by Vite (usually `http://localhost:5173`) to view the PhishShield-X dashboard!
