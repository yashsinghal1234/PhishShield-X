import random
import joblib
import os
import whois
import urllib.parse
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import base64
from dotenv import load_dotenv

load_dotenv()

# Load models if they exist
email_model = None
url_model = None
top_domains = set()

try:
    if os.path.exists("email_model.pkl"):
        email_model = joblib.load("email_model.pkl")
    if os.path.exists("url_model.pkl"):
        from features import URLFeatureExtractor # Needs to be imported for joblib to unpickle
        url_model = joblib.load("url_model.pkl")
    
    # Load whitelist
    if os.path.exists("data/top_domains.txt"):
        with open("data/top_domains.txt", "r") as f:
            for line in f:
                top_domains.add(line.strip().lower())
except Exception as e:
    print(f"Error loading models or whitelist: {e}")

def check_domain_age(url: str) -> dict:
    try:
        domain = urllib.parse.urlparse(url).netloc
        if not domain:
            domain = url.split('/')[0]
            
        w = whois.whois(domain)
        creation_date = w.creation_date
        if type(creation_date) is list:
            creation_date = creation_date[0]
            
        if creation_date:
            if isinstance(creation_date, str):
                from dateutil import parser
                try:
                    creation_date = parser.parse(creation_date)
                except:
                    pass
            if hasattr(creation_date, 'tzinfo') and creation_date.tzinfo is not None:
                creation_date = creation_date.replace(tzinfo=None)
            
            age_days = (datetime.now() - creation_date).days
            return {"age_days": age_days, "error": None}
        return {"age_days": None, "error": "Creation date not found"}
    except Exception as e:
        return {"age_days": None, "error": str(e)}

def scrape_for_phishing(url: str) -> dict:
    # A simple heuristic web scraper
    try:
        if not url.startswith('http'):
            url = 'http://' + url
            
        # Give it a 5 second timeout so the API doesn't hang
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Heuristics:
        # 1. Asking for password
        has_password_field = len(soup.find_all('input', type='password')) > 0
        # 2. Hidden iframes
        has_hidden_iframe = len(soup.find_all('iframe', style=lambda value: value and 'display:none' in value.replace(' ', ''))) > 0
        
        score = 0
        if has_password_field: score += 1
        if has_hidden_iframe: score += 1
        
        return {"score": score, "error": None}
    except Exception as e:
        return {"score": 0, "error": str(e)}

def check_virustotal(url: str) -> dict:
    VT_API_KEY = os.getenv("VT_API_KEY")
    if not VT_API_KEY:
        return {"malicious": 0, "error": "No API Key"}
    try:
        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        headers = {
            "accept": "application/json",
            "x-apikey": VT_API_KEY
        }
        response = requests.get(f"https://www.virustotal.com/api/v3/urls/{url_id}", headers=headers, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            stats = data['data']['attributes']['last_analysis_stats']
            return {"malicious": stats.get('malicious', 0), "error": None}
        elif response.status_code == 404:
            return {"malicious": 0, "error": None}
        else:
            return {"malicious": 0, "error": f"API Error {response.status_code}"}
    except Exception as e:
        return {"malicious": 0, "error": str(e)}

def check_google_safe_browsing(url: str) -> dict:
    GSB_API_KEY = os.getenv("GSB_API_KEY")
    if not GSB_API_KEY:
        return {"malicious": False, "error": "No API Key"}
    try:
        api_url = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={GSB_API_KEY}"
        payload = {
            "client": {
                "clientId": "phishshield-x",
                "clientVersion": "1.0.0"
            },
            "threatInfo": {
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [
                    {"url": url}
                ]
            }
        }
        response = requests.post(api_url, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if "matches" in data and len(data["matches"]) > 0:
                return {"malicious": True, "error": None}
            return {"malicious": False, "error": None}
        return {"malicious": False, "error": f"API Error {response.status_code}"}
    except Exception as e:
        return {"malicious": False, "error": str(e)}

def detect_url_phishing(url: str) -> dict:
    parsed_url = urllib.parse.urlparse(url if url.startswith('http') else 'http://' + url)
    domain_netloc = parsed_url.netloc.lower()
    
    # 0. Check Whitelist First
    if domain_netloc in top_domains or domain_netloc.replace("www.", "") in top_domains:
        return {
            "prediction": "Safe",
            "confidence": 1.0,
            "details": f"Domain {domain_netloc} is in the Top 100,000 Global Sites whitelist. (100% SAFE)"
        }

    # 1. Check ML Model first
    ml_is_phish = False
    ml_confidence = 0.5 # Default middle ground if model fails
    
    if url_model:
        try:
            prob = url_model.predict_proba([url])[0][1]
            ml_is_phish = prob > 0.5
            ml_confidence = prob
        except:
            pass
            
    # 2. Ensemble Verification
    age_info = check_domain_age(url)
    scrape_info = scrape_for_phishing(url)
    vt_info = check_virustotal(url)
    gsb_info = check_google_safe_browsing(url)
    
    final_confidence = ml_confidence
    details = []
    
    # Absolute Blacklist override
    if gsb_info.get("malicious"):
        return {
            "prediction": "Phishing",
            "confidence": 0.99,
            "details": "Google Safe Browsing flagged this URL as Malicious! (100% BLOCKED)"
        }
        
    if vt_info.get("malicious", 0) >= 3:
        return {
            "prediction": "Phishing",
            "confidence": 0.99,
            "details": f"VirusTotal flagged as Malicious by {vt_info['malicious']} security vendors. (100% BLOCKED)"
        }
        
    if ml_is_phish:
        details.append(f"ML Model flagged URL ({ml_confidence*100:.1f}%)")
    else:
        details.append(f"ML Model marked Safe ({(1-ml_confidence)*100:.1f}%)")
        
    if age_info["age_days"] is not None:
        days = age_info["age_days"]
        if days < 30:
            final_confidence = min(0.99, final_confidence + 0.4) # Add 40% suspicion
            details.append(f"Domain is very new ({days} days) - HIGH RISK")
        elif days > 365:
            final_confidence = max(0.01, final_confidence - 0.4) # Subtract 40% suspicion
            details.append(f"Domain is well-established ({days} days) - SAFE")
    else:
        details.append("Domain age unverifiable")
        
    if scrape_info["score"] > 0:
        final_confidence = min(0.99, final_confidence + 0.3 * scrape_info["score"])
        details.append(f"Scraper found {scrape_info['score']} suspicious elements")
        
    # Clean APIs Override
    if vt_info.get("malicious", -1) == 0 and not gsb_info.get("malicious") and scrape_info.get("score") == 0:
        final_confidence = max(0.01, final_confidence - 0.35)
        details.append("Passed all API and Live Checks (Safe) - Overriding ML suspicion")
        
    final_prediction = "Phishing" if final_confidence > 0.5 else "Safe"
    
    if vt_info.get("malicious", 0) > 0:
        details.append(f"VirusTotal found {vt_info['malicious']} vendor flags (Warning)")
    else:
        details.append("VirusTotal: Safe/Unrated")
        
    if gsb_info.get("error"):
        details.append(f"Google Safe Browsing: {gsb_info['error']}")
    else:
        details.append("Google Safe Browsing: Safe")
    
    return {
        "prediction": final_prediction,
        "confidence": final_confidence if final_prediction == "Phishing" else (1 - final_confidence),
        "details": " | ".join(details)
    }

def detect_email_phishing(content: str) -> dict:
    if email_model:
        try:
            prob = email_model.predict_proba([content])[0][1]
            is_phish = prob > 0.5
            return {
                "prediction": "Phishing" if is_phish else "Safe",
                "confidence": prob if is_phish else (1 - prob),
                "details": "Predicted using trained TF-IDF Logistic Regression model."
            }
        except Exception as e:
             return {"prediction": "Error", "confidence": 0, "details": str(e)}

    # Dummy fallback
    suspicious_keywords = ["urgent", "account suspended", "click here", "password", "invoice"]
    is_suspicious = any(kw in content.lower() for kw in suspicious_keywords)
    
    if is_suspicious:
        confidence = random.uniform(0.85, 0.99)
        prediction = "Phishing"
        details = "WARNING: No real model found. Using DUMMY keyword matcher."
    else:
        confidence = random.uniform(0.70, 0.95)
        prediction = "Safe"
        details = "WARNING: No real model found. Using DUMMY keyword matcher."

    return {
        "prediction": prediction,
        "confidence": confidence,
        "details": details
    }

def detect_qr_phishing(decoded_url: str) -> dict:
    """
    Passes decoded QR URL to the URL model.
    """
    return detect_url_phishing(decoded_url)
