import random
import joblib
import os
import whois
import urllib.parse
import requests
from bs4 import BeautifulSoup
import pickle
from datetime import datetime
import base64
from dotenv import load_dotenv
import cv2
import numpy as np

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
        
    # Load deep learning models
    deep_phish_model = None
    tokenizer = None
    if os.path.exists("deep_phish_model.h5"):
        import tensorflow as tf
        deep_phish_model = tf.keras.models.load_model("deep_phish_model.h5")
    if os.path.exists("tokenizer.pkl"):
        with open("tokenizer.pkl", "rb") as handle:
            tokenizer = pickle.load(handle)
    
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
    
    if deep_phish_model and tokenizer:
        try:
            from tensorflow.keras.preprocessing.sequence import pad_sequences
            sequences = tokenizer.texts_to_sequences([url])
            X = pad_sequences(sequences, maxlen=200)
            prob = float(deep_phish_model.predict(X, verbose=0)[0][0])
            ml_is_phish = prob > 0.5
            ml_confidence = prob if ml_is_phish else (1 - prob) # deep model outputs prob of phish
        except Exception as e:
            print(f"Deep learning error: {e}")
    elif url_model:
        try:
            prob = url_model.predict_proba([url])[0][1]
            ml_is_phish = prob > 0.5
            ml_confidence = prob if ml_is_phish else (1 - prob)
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
        
    if final_confidence > 0.74:
        final_prediction = "Phishing"
        reported_confidence = final_confidence
    elif final_confidence > 0.40:
        final_prediction = "Suspicious"
        reported_confidence = final_confidence
    else:
        final_prediction = "Safe"
        reported_confidence = 1.0 - final_confidence
    
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
        "confidence": reported_confidence,
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

def detect_qr_phishing(decoded_url: str, img=None) -> dict:
    """
    Multimodal Hybrid QR Phishing Detection.
    Combines visual structural analysis with lexical URL payload analysis.
    """
    details = []
    anomaly_score = 0.0
    
    # 1. Non-standard Payload Protocol Check
    upper_url = decoded_url.upper()
    is_standard_url = upper_url.startswith('HTTP://') or upper_url.startswith('HTTPS://')
    
    if not is_standard_url:
        if upper_url.startswith('WIFI:') or upper_url.startswith('SMSTO:') or upper_url.startswith('TEL:') or upper_url.startswith('MAILTO:'):
            anomaly_score += 0.4
            details.append("Payload Anomaly: Non-standard protocol designed to trigger device actions (e.g., WIFI, SMS)")
        else:
            anomaly_score += 0.2
            details.append("Payload Anomaly: Unrecognized or missing URL protocol scheme")
            
    # 2. URL Shortener Check & Unrolling
    final_url_to_analyze = decoded_url
    try:
        parsed = urllib.parse.urlparse(decoded_url if is_standard_url else 'http://' + decoded_url)
        domain = parsed.netloc.lower()
        shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly', 'bit.do', 'mcaf.ee', 'su.pr']
        
        # We always attempt to unroll if it's a standard URL to catch custom shorteners
        if is_standard_url:
            try:
                response = requests.head(decoded_url, allow_redirects=True, timeout=3)
                if response.url != decoded_url:
                    final_url_to_analyze = response.url
                    # If it unrolled to a different domain, it's definitely a redirect/shortener
                    if urllib.parse.urlparse(response.url).netloc.lower() != domain:
                        anomaly_score += 0.35
                        details.append(f"Payload Anomaly: URL Redirect/Shortener unrolled to {urllib.parse.urlparse(response.url).netloc}")
            except Exception:
                # If head request fails, fallback to checking hardcoded list
                if any(shortener in domain for shortener in shorteners):
                    anomaly_score += 0.35
                    details.append("Payload Anomaly: Known URL Shortener detected.")
    except Exception as e:
        pass
        
    # 3. Base Payload Analysis
    payload_result = detect_url_phishing(final_url_to_analyze)
    base_confidence = payload_result["confidence"]
    details.append(payload_result["details"])
    
    # 4. Visual Structural Analysis
    if img is not None:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Attackers use high ECL to embed large central logos. 
            # Look for large continuous contours (excluding the 3 position squares).
            total_area = img.shape[0] * img.shape[1]
            large_contours = 0
            
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > (total_area * 0.05): # Contour taking up > 5% of the image
                    large_contours += 1
                    
            if large_contours > 3:
                anomaly_score += 0.25
                details.append("Visual Anomaly: Suspiciously large central structures detected (Possible malicious logo masking)")
            
            # Density check
            black_pixels = np.sum(thresh == 255)
            density = black_pixels / total_area
            if density > 0.6 or density < 0.2:
                anomaly_score += 0.15
                details.append("Visual Anomaly: Abnormal module density (Potentially manipulated encoding)")
                
        except Exception as e:
            details.append(f"Visual analysis failed: {str(e)}")
            
    # 3. Multimodal Fusion Engine
    final_confidence = min(1.0, base_confidence + anomaly_score)
    
    if final_confidence > 0.74:
        final_prediction = "Phishing"
    elif final_confidence > 0.40:
        final_prediction = "Suspicious"
    else:
        final_prediction = "Safe"
        
    return {
        "prediction": final_prediction,
        "confidence": final_confidence,
        "details": " | ".join(details)
    }

