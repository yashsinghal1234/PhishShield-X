# PhishShield-X

PhishShield-X is a comprehensive, multi-modal phishing detection platform designed to analyze URLs, Emails, and QR codes using state-of-the-art Ensemble Machine Learning and Threat Intelligence.

## Features
- **URL Phishing Detection**: An advanced ensemble pipeline that evaluates URLs using:
  - Global Top 100k Domains Whitelist (Bypasses ML for trusted domains like YouTube, Google)
  - VirusTotal API Integration
  - Google Safe Browsing API Integration
  - WHOIS Domain Age Analysis
  - Live Webpage Heuristic Scraper (Checks for hidden iframes and password fields)
  - Random Forest Machine Learning Model (Lexical component separation achieving 95%+ accuracy)
- **Email Phishing Detection**: ML Model for scanning email contents.
- **QR Code Scanning**: Upload QR codes to extract and scan URLs against the threat pipeline.
- **Modern Dashboard**: A sleek, real-time React dashboard for monitoring scans.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Recharts, Lucide Icons.
- **Backend**: FastAPI, Python, Scikit-Learn, SQLite, BeautifulSoup4, Python-Whois.

## Installation & Setup

### Backend
1. Navigate to the `backend` directory: `cd backend`
2. Create and activate a virtual environment: 
   - Windows: `python -m venv venv` then `.\venv\Scripts\Activate.ps1`
   - Mac/Linux: `python3 -m venv venv` then `source venv/bin/activate`
3. Install the required Python packages: `pip install -r requirements.txt`
4. Create a `.env` file in the backend folder and add your API keys:
   ```env
   VT_API_KEY=your_virustotal_key
   GSB_API_KEY=your_google_safe_browsing_key
   ```
5. **Train the ML Model:** Place your `malicious_phish.csv` file into `backend/data/` and run `python train_url_model.py`. This will generate the `url_model.pkl` file (it takes about 1-2 minutes).
6. Run the backend server: `uvicorn main:app --reload`

### Frontend
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
