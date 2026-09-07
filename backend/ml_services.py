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
import ssl
import socket
import difflib
from functools import lru_cache

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

@lru_cache(maxsize=1000)
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

@lru_cache(maxsize=1000)
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

def check_ssl_certificate(url: str) -> dict:
    try:
        domain = urllib.parse.urlparse(url if url.startswith('http') else 'http://' + url).netloc
        if not domain:
            domain = url.split('/')[0]
            
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=3) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert['issuer'])
                issuer_org = issuer.get('organizationName', '')
                
                is_free_ca = any(ca in issuer_org for ca in ["Let's Encrypt", "ZeroSSL", "cPanel"])
                
                not_before = datetime.strptime(cert['notBefore'], '%b %d %H:%M:%S %Y %Z')
                age_days = (datetime.now() - not_before).days
                
                return {"is_free_ca": is_free_ca, "age_days": age_days, "error": None}
    except Exception as e:
        return {"is_free_ca": False, "age_days": None, "error": str(e)}

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

    # 0.5. Check Typosquatting
    base_domain = domain_netloc.replace("www.", "")
    for safe_domain in top_domains:
        if len(safe_domain) > 4: # Don't compare very short domains
            similarity = difflib.SequenceMatcher(None, base_domain, safe_domain).ratio()
            if 0.85 < similarity < 1.0:
                return {
                    "prediction": "Phishing",
                    "confidence": 0.95,
                    "details": f"Typosquatting detected! Domain looks like '{safe_domain}' but is '{base_domain}' (HIGH RISK)"
                }

    # 1. Check ML Models (Deep Learning PhishNet-Hybrid + Tabular Feature Model)
    ml_is_phish = False
    ml_confidence = 0.5
    deep_prob = None
    rf_prob = None

    if deep_phish_model and tokenizer:
        try:
            from tensorflow.keras.preprocessing.sequence import pad_sequences
            sequences = tokenizer.texts_to_sequences([url])
            input_len = deep_phish_model.input_shape[1] if (hasattr(deep_phish_model, 'input_shape') and deep_phish_model.input_shape[1]) else 180
            X_seq = pad_sequences(sequences, maxlen=input_len)
            deep_prob = float(deep_phish_model.predict(X_seq, verbose=0)[0][0])
        except Exception as e:
            print(f"Deep learning inference error: {e}")

    if url_model:
        try:
            rf_prob = float(url_model.predict_proba([url])[0][1])
        except Exception as e:
            print(f"Tabular model inference error: {e}")

    # Weighted Ensemble
    if deep_prob is not None and rf_prob is not None:
        combined_prob = (0.60 * deep_prob) + (0.40 * rf_prob)
    elif deep_prob is not None:
        combined_prob = deep_prob
    elif rf_prob is not None:
        combined_prob = rf_prob
    else:
        combined_prob = 0.5

    ml_is_phish = combined_prob > 0.5
    ml_confidence = combined_prob if ml_is_phish else (1.0 - combined_prob)

    # 2. Ensemble Verification with Threat Intel, Infrastructure & Heuristics
    from visual_brand_engine import check_infrastructure_risk
    infra_info = check_infrastructure_risk(url)
    age_info = check_domain_age(url)
    scrape_info = scrape_for_phishing(url)
    vt_info = check_virustotal(url)
    gsb_info = check_google_safe_browsing(url)
    ssl_info = check_ssl_certificate(url)
    
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

    # Infrastructure / Ephemeral Tunnel Penalties
    if infra_info.get("is_tunnel_ddns"):
        final_confidence = min(0.99, final_confidence + infra_info["risk_boost"])
        details.append(f"Infrastructure Risk: Hosted on ephemeral tunnel/DDNS ({infra_info.get('matched_service')}) - HIGH RISK")
        
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
        
    if ssl_info["error"] is None:
        if ssl_info["is_free_ca"] and (age_info["age_days"] is None or age_info["age_days"] < 90):
            final_confidence = min(0.99, final_confidence + 0.25)
            details.append("Uses a free SSL certificate often associated with short-lived phishing sites")
            
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

def detect_eml_phishing(file_bytes: bytes) -> dict:
    import email
    from email import policy
    
    try:
        msg = email.message_from_bytes(file_bytes, policy=policy.default)
        
        details = []
        anomaly_score = 0.0
        
        # 1. Header Analysis
        auth_results = str(msg.get('Authentication-Results', '')).lower()
        if 'spf=fail' in auth_results or 'spf=softfail' in auth_results:
            anomaly_score += 0.4
            details.append("Header Anomaly: SPF Authentication Failed (Sender IP not authorized)")
            
        if 'dkim=fail' in auth_results:
            anomaly_score += 0.4
            details.append("Header Anomaly: DKIM Signature Failed (Email may have been tampered with or spoofed)")
            
        if 'dmarc=fail' in auth_results:
            anomaly_score += 0.5
            details.append("Header Anomaly: DMARC Policy Failed (High probability of spoofing)")
            
        # 2. Mismatch Analysis
        from_header = str(msg.get('From', ''))
        return_path = str(msg.get('Return-Path', ''))
        
        def extract_domain(addr):
            if '@' in addr:
                return addr.split('@')[-1].strip('<>')
            return ''
            
        from_domain = extract_domain(from_header)
        return_domain = extract_domain(return_path)
        
        if from_domain and return_domain and from_domain.lower() != return_domain.lower():
            anomaly_score += 0.5
            details.append(f"Header Anomaly: 'From' domain ({from_domain}) does not match 'Return-Path' ({return_domain}). Classic spoofing tactic.")
            
        # 3. Body Extraction for ML
        body_content = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == 'text/plain' or content_type == 'text/html':
                    try:
                        body_content += part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                    except:
                        pass
        else:
            try:
                body_content = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', errors='ignore')
            except:
                pass
                
        if not body_content:
            body_content = str(msg.get('Subject', ''))
            
        # 3.5 Fake Job/Internship Detection
        job_keywords = ["internship", "job offer", "hiring", "salary", "work from home", "remote job", "interview", "recruitment"]
        is_job_email = any(kw in body_content.lower() for kw in job_keywords)
        
        if is_job_email and from_domain:
            free_email_providers = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com"]
            if from_domain.lower() in free_email_providers:
                anomaly_score += 0.3
                details.append("Job Scam Heuristic: Job offer sent from a free personal email provider (High Risk)")
            else:
                age_info = check_domain_age(from_domain)
                if age_info["age_days"] is not None and age_info["age_days"] < 180:
                    anomaly_score += 0.4
                    details.append(f"Job Scam Heuristic: Job offer from a newly registered corporate domain ({age_info['age_days']} days old)")
                    
        # 4. Base ML Analysis
        ml_result = detect_email_phishing(body_content)
        
        if ml_result["prediction"] == "Safe":
            base_ml_confidence = 1.0 - ml_result["confidence"]
        else:
            base_ml_confidence = ml_result["confidence"]
            
        final_confidence = min(0.99, base_ml_confidence + anomaly_score)
        
        if final_confidence > 0.74:
            final_prediction = "Phishing"
        elif final_confidence > 0.40:
            final_prediction = "Suspicious"
        else:
            final_prediction = "Safe"
            
        details.append(ml_result['details'])
        
        return {
            "prediction": final_prediction,
            "confidence": final_confidence if final_prediction != "Safe" else 1.0 - final_confidence,
            "details": " | ".join(details)
        }
        
    except Exception as e:
        return {"prediction": "Error", "confidence": 0, "details": f"Failed to parse EML file: {str(e)}"}

def detect_qr_phishing(decoded_payload: str, img=None) -> dict:
    """
    Multimodal Defense-in-Depth QR Phishing (Quishing) Engine.
    Combines Computer Vision structural analysis, protocol risk profiling,
    recursive multi-hop URL unrolling, and PhishNet-Hybrid deep semantic evaluation.
    """
    from quishing_engine import (
        analyze_qr_visual_structure,
        analyze_payload_protocol,
        recursively_unroll_url
    )

    details = []
    quishing_anomaly_score = 0.0

    # 1. Payload & Protocol Analysis
    proto_info = analyze_payload_protocol(decoded_payload)
    quishing_anomaly_score += proto_info["protocol_risk"]
    if proto_info["anomalies"]:
        details.extend(proto_info["anomalies"])

    # 2. Visual Structural Integrity Analysis (OpenCV)
    if img is not None:
        visual_info = analyze_qr_visual_structure(img)
        quishing_anomaly_score += visual_info["visual_risk_score"]
        if visual_info["anomalies"]:
            details.extend(visual_info["anomalies"])

    # 3. Recursive URL Unrolling & Destination Analysis
    if proto_info["target_url"]:
        final_url, redirect_chain, redirect_risk = recursively_unroll_url(proto_info["target_url"])
        quishing_anomaly_score += redirect_risk
        if len(redirect_chain) > 1:
            details.append(f"Cloaking Detected: QR shortener redirected through {len(redirect_chain)-1} hops to destination: {urllib.parse.urlparse(final_url).netloc}")

        # 4. Deep URL Phishing Inference (PhishNet-Hybrid + 34D Features)
        url_eval = detect_url_phishing(final_url)
        if url_eval["prediction"] == "Safe":
            base_confidence = 1.0 - url_eval["confidence"]
        else:
            base_confidence = url_eval["confidence"]
        details.append(url_eval["details"])
    else:
        # Non-URL payload (e.g. WiFi, SMS, Payment)
        base_confidence = 0.40 if proto_info["matched_scheme"] else 0.20

    # 5. Multimodal Decision Fusion
    final_confidence = min(0.99, base_confidence + quishing_anomaly_score)

    if final_confidence > 0.74:
        final_prediction = "Phishing"
    elif final_confidence > 0.40:
        final_prediction = "Suspicious"
    else:
        final_prediction = "Safe"

    return {
        "prediction": final_prediction,
        "confidence": final_confidence if final_prediction != "Safe" else 1.0 - final_confidence,
        "details": " | ".join(details)
    }

def get_osint_data(url: str) -> dict:
    parsed = urllib.parse.urlparse(url if url.startswith('http') else 'http://' + url)
    domain = parsed.netloc.split(':')[0]
    
    parts = domain.split('.')
    tld = parts[-1] if len(parts) > 1 else ""
    
    full_url = url if url.startswith(("http://", "https://")) else f"https://{url}"
    screenshot_path = f"/api/detect/screenshot?url={urllib.parse.quote(full_url, safe='')}"

    osint = {
        "ip_address": None,
        "location": None,
        "asn": None,
        "hosting_provider": None,
        "tld": tld,
        "screenshot_url": screenshot_path,
        "brand": None,
        "certificate_details": None
    }
    
    # Try fetching SSL Details
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=3) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                
                # Extract Brand (Issuer Organization)
                issuer_org = "--"
                for field in cert.get('issuer', []):
                    for k, v in field:
                        if k == 'organizationName':
                            issuer_org = v
                            break
                            
                # Extract Certificate Details (Subject Alt Names)
                san_list = []
                for k, v in cert.get('subjectAltName', []):
                    san_list.append(v)
                
                if issuer_org != "--":
                    osint["brand"] = issuer_org
                
                if san_list:
                    osint["certificate_details"] = f"{issuer_org}: " + ", ".join(san_list[:3]) + ("..." if len(san_list) > 3 else "")
                    
    except Exception as e:
        print(f"SSL error: {e}")
    
    try:
        ip = socket.gethostbyname(domain)
        osint["ip_address"] = ip
        
        geo_resp = requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
        if geo_resp.status_code == 200:
            geo_data = geo_resp.json()
            if geo_data.get("status") == "success":
                osint["location"] = f"{geo_data.get('city', '')}, {geo_data.get('country', '')}".strip(", ")
                isp_full = geo_data.get('isp', '')
                osint["hosting_provider"] = isp_full.split(' ')[0] if isp_full else None
                
                as_info = geo_data.get("as", "")
                if as_info:
                    osint["asn"] = as_info.split(' ')[0].replace("AS", "")
    except Exception as e:
        print(f"OSINT error: {e}")
        
    return osint

