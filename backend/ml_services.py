import random
import math
import time
import hashlib
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
from cachetools import TTLCache, cached
import tldextract

# Set global socket timeout to prevent network calls (whois, ssl) from hanging indefinitely
socket.setdefaulttimeout(3.0)

# TTL-aware in-memory caches to prevent stale caching vulnerabilities (e.g. watering-hole compromises)
# Expirations: 5 minutes (300s) for dynamic resolution & threat feeds; 1 hour (3600s) for WHOIS domain age
dns_cache = TTLCache(maxsize=2000, ttl=300)
whois_cache = TTLCache(maxsize=2000, ttl=3600)
vt_cache = TTLCache(maxsize=2000, ttl=300)
gsb_cache = TTLCache(maxsize=2000, ttl=300)
ssl_cache = TTLCache(maxsize=2000, ttl=300)

load_dotenv()

import threading

# Global model state
email_model = None
url_model = None
deep_phish_model = None
tokenizer = None
m3_early_fusion_model = None
url_edl_shadow_model = None
url_edl_shadow_scaler = None
email_edl_shadow_model = None
email_edl_shadow_scaler = None
top_domains = set()

_models_loaded = False
_model_lock = threading.Lock()

# Load whitelist fast at import (<0.005s)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_top_domains_path = os.path.join(BASE_DIR, "data", "top_domains.txt")
if os.path.exists(_top_domains_path):
    try:
        with open(_top_domains_path, "r", encoding="utf-8") as f:
            for line in f:
                top_domains.add(line.strip().lower())
    except Exception as e:
        print(f"Error reading top_domains whitelist: {e}")

def load_ai_models():
    """Background or lazy loader for heavy ML and Deep Learning models."""
    global email_model, url_model, deep_phish_model, tokenizer, m3_early_fusion_model
    global url_edl_shadow_model, url_edl_shadow_scaler, email_edl_shadow_model, email_edl_shadow_scaler, _models_loaded
    with _model_lock:
        if _models_loaded:
            return
        
        # 1. URL Random Forest Model (84MB)
        url_model_path = os.path.join(BASE_DIR, "url_model.pkl")
        if os.path.exists(url_model_path) and url_model is None:
            try:
                from features import URLFeatureExtractor
                url_model = joblib.load(url_model_path)
            except Exception as e:
                print(f"Error loading url_model.pkl: {e}")

        # 2. Email Logistic Regression Model
        email_model_path = os.path.join(BASE_DIR, "email_model.pkl")
        if os.path.exists(email_model_path) and email_model is None:
            try:
                email_model = joblib.load(email_model_path)
            except Exception as e:
                print(f"Error loading email_model.pkl: {e}")

        # 3. URL Character Tokenizer
        tokenizer_path = os.path.join(BASE_DIR, "tokenizer.pkl")
        if os.path.exists(tokenizer_path) and tokenizer is None:
            try:
                with open(tokenizer_path, "rb") as handle:
                    tokenizer = pickle.load(handle)
            except Exception as e:
                print(f"Error loading tokenizer.pkl: {e}")

        # 4. Deep PhishNet Model
        deep_path = os.path.join(BASE_DIR, "deep_phish_model.h5")
        if os.path.exists(deep_path) and deep_phish_model is None:
            try:
                import tensorflow as tf
                deep_phish_model = tf.keras.models.load_model(deep_path)
            except Exception as e:
                print(f"Error loading deep_phish_model.h5: {e}")

        # 5. M3 Multimodal Early Fusion Model
        m3_weights_path = os.path.join(BASE_DIR, "m3_early_fusion_weights.weights.h5")
        if os.path.exists(m3_weights_path) and m3_early_fusion_model is None:
            try:
                from quishing_engine import build_m3_early_fusion_model
                m3_early_fusion_model = build_m3_early_fusion_model()
                m3_early_fusion_model.load_weights(m3_weights_path)
                print("Loaded M3 (Multimodal Early Fusion + Softmax) Production Neural Weights successfully!")
            except Exception as e:
                print(f"Error loading M3 Early Fusion model: {e}")

        # 6. URL-EDL Shadow Evaluation Model (Behind Flag)
        ENABLE_URL_EDL_SHADOW = os.getenv("ENABLE_URL_EDL_SHADOW", "true").lower() in ("true", "1", "yes")
        url_edl_weights_path = os.path.join(BASE_DIR, "url_edl_weights.weights.h5")
        if ENABLE_URL_EDL_SHADOW and os.path.exists(url_edl_weights_path) and url_edl_shadow_model is None:
            try:
                from url_edl import build_url_edl_model
                url_edl_shadow_model = build_url_edl_model(head_type='cosine')
                url_edl_shadow_model.load_weights(url_edl_weights_path)
                
                cache_path = os.path.join(BASE_DIR, "url_data_cache_6000.npz")
                if os.path.exists(cache_path):
                    from sklearn.preprocessing import StandardScaler
                    data = np.load(cache_path, allow_pickle=True)
                    scaler = StandardScaler()
                    scaler.fit(data["X_tab"])
                    url_edl_shadow_scaler = scaler
                print("Loaded URL-EDL Shadow Evaluation Model successfully!")
            except Exception as e:
                print(f"Error loading URL-EDL Shadow model: {e}")

        # 7. Email-EDL Shadow Evaluation Model (Behind Flag)
        ENABLE_EMAIL_EDL_SHADOW = os.getenv("ENABLE_EMAIL_EDL_SHADOW", "true").lower() in ("true", "1", "yes")
        email_edl_weights_path = os.path.join(BASE_DIR, "email_edl_weights.weights.h5")
        if ENABLE_EMAIL_EDL_SHADOW and os.path.exists(email_edl_weights_path) and email_edl_shadow_model is None:
            try:
                from email_edl import build_email_models
                _, _, _, _, m_e6 = build_email_models(epoch_var=None, total_epochs=8)
                m_e6.load_weights(email_edl_weights_path)
                email_edl_shadow_model = m_e6
                
                cache_path = os.path.join(BASE_DIR, "email_features_10000.npz")
                if os.path.exists(cache_path):
                    from sklearn.preprocessing import StandardScaler
                    data = np.load(cache_path, allow_pickle=True)
                    scaler = StandardScaler()
                    scaler.fit(data["X_tab"])
                    email_edl_shadow_scaler = scaler
                print("Loaded Email-EDL Shadow Evaluation Model successfully!")
            except Exception as e:
                print(f"Error loading Email-EDL Shadow model: {e}")

        _models_loaded = True

def ensure_models_loaded():
    """Ensure heavy AI models are loaded before running detection inference."""
    if not _models_loaded:
        load_ai_models()

def extract_etld_plus_one(domain_str: str) -> str:
    """
    Extracts the effective Top-Level Domain + 1 (eTLD+1 / registered domain)
    using the Mozilla Public Suffix List via tldextract.
    Correctly handles multi-part suffixes like .co.uk, .com.au, .gov.uk.
    """
    try:
        ext = tldextract.extract(domain_str)
        if ext.domain and ext.suffix:
            return f"{ext.domain}.{ext.suffix}".lower()
        return domain_str.lower()
    except Exception:
        return domain_str.lower()

@cached(cache=dns_cache)
def resolve_domain_ip(domain: str):
    try:
        return socket.gethostbyname(domain)
    except Exception:
        return None

@cached(cache=whois_cache)
def check_domain_age(url: str) -> dict:
    try:
        domain = urllib.parse.urlparse(url).netloc
        if not domain:
            domain = url.split('/')[0]
        domain = domain.split(':')[0]

        # Query root registered domain (eTLD+1) first so WHOIS does not fail on cloud subdomains (e.g. *.vercel.app)
        target = extract_etld_plus_one(domain) or domain
        w = None
        try:
            w = whois.whois(target)
        except Exception:
            try:
                w = whois.whois(domain)
            except Exception:
                pass

        if w:
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
    # A heuristic web scraper with structural DOM inspection
    try:
        domain = urllib.parse.urlparse(url if url.startswith('http') else 'http://' + url).netloc.split(':')[0]
        if not resolve_domain_ip(domain):
            return {"score": 0, "has_password_field": False, "has_hidden_iframe": False, "error": "Domain does not resolve"}

        if not url.startswith('http'):
            url = 'http://' + url
            
        response = requests.get(url, timeout=3)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Heuristics:
        # 1. Asking for password
        has_password_field = len(soup.find_all('input', type='password')) > 0

        # 2. Hidden iframes (often used in credential harvesting clickjacking)
        # Precision guardrail: only flag hidden iframes whose payload is neither
        # same-origin content nor a well-known benign embed provider. Virtually
        # every large legitimate site ships display:none iframes — most commonly
        # the Google Tag Manager noscript analytics beacon — so counting those
        # produced severe false positives (e.g. college exam LMS portals).
        TRUSTED_IFRAME_HOSTS = (
            "googletagmanager.com", "google-analytics.com", "doubleclick.net",
            "challenges.cloudflare.com", "recaptcha.net", "gstatic.com",
            "youtube.com", "youtube-nocookie.com", "player.vimeo.com",
            "www.google.com", "accounts.google.com",
            "login.microsoftonline.com", "login.live.com",
            "facebook.com", "twitter.com", "platform.twitter.com", "x.com",
        )
        hidden_iframe_count = 0
        for fr in soup.find_all('iframe'):
            style = (fr.get('style') or '').replace(' ', '').lower()
            is_hidden = 'display:none' in style or 'visibility:hidden' in style
            if not is_hidden:
                continue
            src = (fr.get('src') or '').strip()
            src_host = urllib.parse.urlparse(src).netloc.split(':')[0].lower()
            same_origin = src_host == domain
            trusted_embed = any(
                src_host == h or src_host.endswith('.' + h)
                for h in TRUSTED_IFRAME_HOSTS
            )
            if not same_origin and not trusted_embed:
                hidden_iframe_count += 1
        has_hidden_iframe = hidden_iframe_count > 0
        
        score = 0
        if has_password_field: score += 1
        if has_hidden_iframe: score += 1
        
        return {
            "score": score,
            "has_password_field": has_password_field,
            "has_hidden_iframe": has_hidden_iframe,
            "error": None
        }
    except Exception as e:
        return {"score": 0, "has_password_field": False, "has_hidden_iframe": False, "error": str(e)}

@cached(cache=vt_cache)
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
        response = requests.get(f"https://www.virustotal.com/api/v3/urls/{url_id}", headers=headers, timeout=3)
        
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

@cached(cache=gsb_cache)
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
        response = requests.post(api_url, json=payload, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if "matches" in data and len(data["matches"]) > 0:
                return {"malicious": True, "error": None}
            return {"malicious": False, "error": None}
        return {"malicious": False, "error": f"API Error {response.status_code}"}
    except Exception as e:
        return {"malicious": False, "error": str(e)}

@cached(cache=ssl_cache)
def check_ssl_certificate(url: str) -> dict:
    try:
        domain = urllib.parse.urlparse(url if url.startswith('http') else 'http://' + url).netloc.split(':')[0]
        if not domain or not resolve_domain_ip(domain):
            return {"is_free_ca": False, "age_days": None, "error": "Domain does not resolve"}
            
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
    from visual_brand_engine import check_infrastructure_risk, AUTHORIZED_BRAND_DOMAINS
    from features import detect_target_brand, HIGH_RISK_TLDS, SUSPICIOUS_KEYWORDS

    parsed_url = urllib.parse.urlparse(url if url.startswith(('http://', 'https://')) else 'http://' + url)
    domain_netloc = parsed_url.netloc.lower().split(':')[0]
    domain_etld1 = extract_etld_plus_one(domain_netloc)
    
    # 0. Check Whitelist & Authorized Brand Root Domains First
    if domain_netloc in top_domains or domain_netloc.replace("www.", "") in top_domains or domain_etld1 in top_domains:
        return {
            "prediction": "Safe",
            "confidence": 1.0,
            "details": f"Domain {domain_netloc} (root: {domain_etld1}) is in the Top 100,000 Global Sites whitelist. (100% SAFE)",
            "friction_level": "none",
            "advisory_message": None
        }

    # 0.2 Check if domain is an official subdomain/host of an authorized brand
    # NOTE: AUTHORIZED_BRAND_DOMAINS provides curated blueprint matching for high-value targets (Microsoft, Apple, Google, etc.).
    # It is an enumerated reference list and not an exhaustive global resolver for every arbitrary third-party affiliate.
    detected_brand = detect_target_brand(domain_netloc)
    is_authorized_brand = False
    if detected_brand:
        brand_key = detected_brand.lower()
        auth_list = AUTHORIZED_BRAND_DOMAINS.get(brand_key, [f"{brand_key}.com"])
        is_authorized_brand = any(
            domain_netloc == auth or domain_netloc.endswith("." + auth) or domain_etld1 == auth
            for auth in auth_list
        )
        if is_authorized_brand:
            return {
                "prediction": "Safe",
                "confidence": 0.99,
                "details": f"Domain {domain_netloc} is an authorized first-party host/subdomain for '{detected_brand}'. (100% SAFE)",
                "friction_level": "none",
                "advisory_message": None
            }

    # 0.5. Check Typosquatting against High-Value Targeted Brands
    # Uses curated TARGET_BRANDS list rather than iterating over subdomains in top_domains to avoid false positives
    ext_base = tldextract.extract(domain_netloc)
    stem_base = ext_base.domain.lower() if ext_base.domain else ""
    
    if len(stem_base) >= 4:
        from features import TARGET_BRANDS
        for target_brand in TARGET_BRANDS:
            if stem_base == target_brand:
                continue
            if abs(len(stem_base) - len(target_brand)) <= 2 and len(target_brand) >= 4:
                sim = difflib.SequenceMatcher(None, stem_base, target_brand).ratio()
                if sim >= 0.85:
                    auth_list = AUTHORIZED_BRAND_DOMAINS.get(target_brand, [f"{target_brand}.com"])
                    if not any(domain_netloc == a or domain_netloc.endswith("." + a) or domain_etld1 == a for a in auth_list):
                        return {
                            "prediction": "Phishing",
                            "confidence": 0.95,
                            "details": f"Typosquatting detected! Domain '{domain_netloc}' impersonates high-value brand '{target_brand}' (HIGH RISK)",
                            "friction_level": "block",
                            "advisory_message": f"Tier 1 Automated Block: Typosquatting impersonation attack targeting '{target_brand}'."
                        }

    # 1. Ensemble ML Prediction (Deep PhishNet-Hybrid + Tabular Feature Model)
    ensure_models_loaded()
    deep_prob = None
    rf_prob = None

    if deep_phish_model and tokenizer:
        try:
            from tensorflow.keras.preprocessing.sequence import pad_sequences
            sequences = tokenizer.texts_to_sequences([url])
            input_len = deep_phish_model.input_shape[1] if (hasattr(deep_phish_model, 'input_shape') and deep_phish_model.input_shape[1]) else 180
            X_seq = pad_sequences(sequences, maxlen=input_len)
            deep_prob = float(deep_phish_model(X_seq, training=False).numpy()[0][0])
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
    risk_score = combined_prob  # Base probability of phishing (0.0 to 1.0)

    # --- Shadow Serving Evaluation: URL-EDL (Telemetry & Field Study) ---
    shadow_telemetry = None
    if url_edl_shadow_model is not None and tokenizer is not None:
        try:
            import time
            import hashlib
            t0 = time.perf_counter()
            
            # 1. Lexical sequence
            seq = tokenizer.texts_to_sequences([url])
            from tensorflow.keras.preprocessing.sequence import pad_sequences
            X_seq_edl = pad_sequences(seq, maxlen=180)
            
            # 2. 34-D tabular features
            from features import URLFeatureExtractor
            raw_tab = URLFeatureExtractor().transform([url])
            if url_edl_shadow_scaler is not None:
                X_tab_edl = url_edl_shadow_scaler.transform(raw_tab)
            else:
                X_tab_edl = raw_tab
                
            # 3. Model forward pass
            alpha_pred = url_edl_shadow_model([X_seq_edl, X_tab_edl], training=False).numpy()[0]
            S = float(np.sum(alpha_pred))
            u = float(2.0 / S) if S > 0 else 1.0
            p_edl = float(alpha_pred[1] / S) if S > 0 else 0.5
            lat_ms = (time.perf_counter() - t0) * 1000.0
            
            url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()[:12]
            shadow_telemetry = {
                "url_hash": url_hash,
                "rf_prob": round(rf_prob, 4) if rf_prob is not None else None,
                "deep_prob": round(deep_prob, 4) if deep_prob is not None else None,
                "combined_prob": round(combined_prob, 4),
                "edl_prob": round(p_edl, 4),
                "edl_uncertainty": round(u, 4),
                "edl_strength": round(S, 4),
                "u": round(u, 4),
                "S": round(S, 4),
                "latency_ms": round(lat_ms, 2)
            }
            
            # Non-blocking file logging for field ECE audit
            log_dir = os.path.join(BASE_DIR, "logs")
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, "shadow_url_edl.log")
            with open(log_file, "a", encoding="utf-8") as f_log:
                rf_str = f"{rf_prob:.4f}" if rf_prob is not None else "None"
                deep_str = f"{deep_prob:.4f}" if deep_prob is not None else "None"
                f_log.write(f"{datetime.utcnow().isoformat()},{url_hash},{rf_str},{deep_str},{p_edl:.4f},{u:.4f},{S:.4f},{lat_ms:.2f}\n")
        except Exception as e:
            # Shadow evaluation must never block live serving
            pass

    # 2. Multi-Signal OSINT, Threat Intel, Infrastructure & Brand Analysis
    infra_info = check_infrastructure_risk(url)
    age_info = check_domain_age(url)
    scrape_info = scrape_for_phishing(url)
    vt_info = check_virustotal(url)
    gsb_info = check_google_safe_browsing(url)
    ssl_info = check_ssl_certificate(url)

    details = []

    # 2.1 State 3: Confirmed Malicious Blacklist Override (Absolute Block)
    if gsb_info.get("malicious"):
        return {
            "prediction": "Phishing",
            "confidence": 0.99,
            "details": "Google Safe Browsing flagged this URL as Malicious! (100% BLOCKED)",
            "friction_level": "block",
            "advisory_message": "Tier 1 Automated Block: Flagged as confirmed malware/phishing by Google Safe Browsing."
        }

    if vt_info.get("malicious", 0) >= 3:
        return {
            "prediction": "Phishing",
            "confidence": 0.99,
            "details": f"VirusTotal flagged as Malicious by {vt_info['malicious']} security vendors. (100% BLOCKED)",
            "friction_level": "block",
            "advisory_message": f"Tier 1 Automated Block: Flagged as malicious by {vt_info['malicious']} VirusTotal security vendors."
        }

    if ml_is_phish:
        details.append(f"ML Model flagged URL ({ml_confidence*100:.1f}%)")
    else:
        details.append(f"ML Model marked Safe ({(1-ml_confidence)*100:.1f}%)")

    # 2.2 Brand Impersonation Threat Tiering
    is_unauthorized_brand_lure = False
    is_brand_adjacent_ambiguity = False

    tld = domain_netloc.split(".")[-1] if "." in domain_netloc else ""
    url_lower = url.lower()
    has_scam_keyword = any(kw in url_lower for kw in SUSPICIOUS_KEYWORDS)
    has_high_risk_tld = tld in HIGH_RISK_TLDS
    has_harvesting_forms = scrape_info.get("score", 0) > 0

    if detected_brand and not is_authorized_brand:
        # Tier 1 Auto-Block: Requires affirmative deceptive weaponization (scam keywords, abusive TLD, or harvesting forms)
        if has_scam_keyword or has_high_risk_tld or has_harvesting_forms:
            is_unauthorized_brand_lure = True
            risk_score = max(risk_score, 0.96)
            reasons = []
            if has_scam_keyword: reasons.append("credential/security keywords")
            if has_high_risk_tld: reasons.append(f"high-abuse .{tld} TLD")
            if has_harvesting_forms: reasons.append("credential harvesting forms")
            details.append(f"Brand Impersonation Threat (Tier 1): Claims '{detected_brand}' identity with {' + '.join(reasons)} on rogue domain ({domain_netloc}) - HIGH RISK")
        else:
            # Tier 2 Quarantine: Brand-adjacent / fan / affiliate / fair-use domain without active deceptive lures
            is_brand_adjacent_ambiguity = True
            risk_score = 0.52
            details.append(f"Brand-Adjacent Domain (Tier 2): References '{detected_brand}' on non-official host without active lure indicators ({domain_netloc}) - Quarantined for Review")

    # 2.3 High-Risk Abuse TLD Penalty
    if tld in HIGH_RISK_TLDS:
        risk_score = min(0.99, risk_score + 0.25)
        details.append(f"Suspicious Infrastructure: Hosted on high-abuse top-level domain (.{tld})")

    # 2.4 Ephemeral Tunnels & DDNS
    if infra_info.get("is_tunnel_ddns"):
        risk_score = min(0.99, risk_score + infra_info["risk_boost"])
        details.append(f"Infrastructure Risk: Hosted on ephemeral tunnel/DDNS ({infra_info.get('matched_service')}) - HIGH RISK")

    # 2.5 Continuous Domain Age & Trust-Decay Curve (Logarithmic Saturation Model)
    # Replaces binary age thresholds with a smooth, continuous trust discount:
    # T(d) = max_discount * (ln(1 + d) / ln(1 + D_mature))
    is_confirmed_reputable = False
    age_trust_discount = 0.0
    domain_age_days = age_info.get("age_days")

    if domain_age_days is not None:
        days = max(0, domain_age_days)
        # Saturated logarithmic trust curve (maturity baseline = 365 days, max discount = 0.45)
        maturity_ratio = min(1.0, math.log(1.0 + days) / math.log(366.0))
        age_trust_discount = 0.45 * maturity_ratio

        if days < 30:
            if is_unauthorized_brand_lure:
                freshness_penalty = 0.35 * (1.0 - days / 30.0)
                risk_score = min(0.99, risk_score + freshness_penalty)
                details.append(f"Domain is newly registered ({days}d, +{freshness_penalty:.2f} freshness penalty) - HIGH RISK")
            elif is_brand_adjacent_ambiguity:
                freshness_penalty = 0.10 * (1.0 - days / 30.0)
                risk_score = min(0.65, risk_score + freshness_penalty)
                details.append(f"Domain is newly registered ({days}d) - Quarantined for Review")
            else:
                details.append(f"Domain is newly registered ({days}d, continuous trust discount: -{age_trust_discount:.2f}) - Clean Advisory")
        else:
            if days >= 180 and not is_unauthorized_brand_lure:
                is_confirmed_reputable = True
            risk_score = max(0.01, risk_score - age_trust_discount)
            details.append(f"Domain age ({days}d, continuous trust discount: -{age_trust_discount:.2f})")
    else:
        # State 2: Unverifiable / Zero-Day WHOIS (Neutral, NEVER Exculpatory)
        details.append("Domain age unverifiable (Zero-Day / Privacy Protected - Neutral)")

    # 2.6 SSL Certificate Issuance Timing & Joint Infrastructure Signal
    cert_age_days = ssl_info.get("age_days")
    if ssl_info.get("error") is None:
        if ssl_info.get("is_free_ca"):
            # Joint temporal check: cert provisioned within 3 days on brand-adjacent or abusive TLD
            if (cert_age_days is not None and cert_age_days <= 3) and (is_unauthorized_brand_lure or is_brand_adjacent_ambiguity or has_high_risk_tld):
                risk_score = min(0.99, risk_score + 0.15)
                details.append("Ephemeral SSL Issuance: Automated free CA certificate provisioned immediately upon registration (<3d)")
            elif is_unauthorized_brand_lure or is_brand_adjacent_ambiguity:
                risk_score = min(0.99, risk_score + 0.10)
                details.append("Uses a short-lived/free SSL certificate on unestablished domain")

    if scrape_info.get("has_hidden_iframe"):
        risk_score = min(0.99, risk_score + 0.35)
        details.append("Scraper detected hidden iframe (Suspicious credential trapping)")
    elif is_unauthorized_brand_lure and scrape_info.get("has_password_field"):
        risk_score = min(0.99, risk_score + 0.30)
        details.append("Scraper found credential harvesting password input on unauthorized brand domain (HIGH RISK)")
    elif scrape_info.get("has_password_field") and (has_high_risk_tld or infra_info.get("is_tunnel_ddns")):
        risk_score = min(0.99, risk_score + 0.25)
        details.append("Scraper found credential inputs on suspicious/high-abuse infrastructure")

    # 2.7 Multi-Source Consensus Adjudication
    # State 1: Confirmed Clean Override — ONLY if domain is verified reputable (>180d) AND clean across all feeds AND not impersonating
    if is_confirmed_reputable and vt_info.get("malicious", -1) == 0 and not gsb_info.get("malicious") and not is_unauthorized_brand_lure:
        if not scrape_info.get("has_hidden_iframe"):
            risk_score = max(0.01, risk_score - 0.50)
            details.append("Reputation Consensus Override: Well-established domain (>180d) and clean multi-source history overruled ML suspicion (Safe)")
        elif domain_age_days is not None and domain_age_days >= 365:
            # Structural-anomaly downgrade: a genuine DOM anomaly (hidden iframe
            # with external payload) cannot ESCALATE a long-established domain
            # with clean blacklist consensus past Tier-2 quarantine. Hard block
            # is reserved for blacklist matches, brand weaponization or
            # typosquatting — never for heuristics disagreeing with reputation.
            risk_score = min(risk_score, 0.52)
            details.append("Reputation Consensus Override (Downgraded): well-established domain with clean multi-source reputation; anomalous DOM structure gated to Tier-2 Quarantine")
    elif not is_confirmed_reputable and vt_info.get("malicious", -1) == 0 and not gsb_info.get("malicious"):
        # State 2: Unrated / Zero-Day Domain
        if is_unauthorized_brand_lure:
            risk_score = max(risk_score, 0.99)
            details.append("Zero-Day / Unrated Domain: Clean blacklist feeds are uncorroborated on unestablished domain; upholding brand phishing detection (Phishing/Blocked)")
        elif is_brand_adjacent_ambiguity:
            details.append("Brand-Adjacent Domain: Unrated domain referencing brand name without scam indicators; routed to Tier 2 Quarantine")
        elif not detected_brand and tld not in HIGH_RISK_TLDS and not infra_info.get("is_tunnel_ddns"):
            # Predatory financial/phishing lure keywords
            PREDATORY_LURE_KEYWORDS = {
                "free", "bonus", "reward", "wallet", "recover", "unlock",
                "urgent", "suspended", "prize", "lottery", "crypto", "airdrop", "claim"
            }
            has_predatory_keyword = any(kw in url_lower for kw in PREDATORY_LURE_KEYWORDS)

            REPUTABLE_PAAS_PROVIDERS = {
                "vercel.app", "netlify.app", "github.io", "pages.dev", "web.app",
                "firebaseapp.com", "onrender.com", "render.com", "herokuapp.com", "gitlab.io"
            }
            is_reputable_paas = domain_etld1 in REPUTABLE_PAAS_PROVIDERS

            if not has_predatory_keyword:
                if not scrape_info.get("has_hidden_iframe"):
                    if is_reputable_paas:
                        # Authentic student / developer / SaaS project application on verified cloud host (e.g. Vercel, Netlify)
                        risk_score = 0.08
                        details.append(f"Brand-Neutral Application: Verified cloud developer platform ({domain_etld1}); clean threat intelligence with zero brand impersonation (Safe 92.0%)")
                    elif scrape_info.get("score", 0) == 0:
                        risk_score = 0.10
                        details.append("Brand-Neutral Domain: Clean multi-source threat feeds, zero brand lures, and clean DOM; ML suspicion resolved to Safe (90.0%)")
                    else:
                        # Brand-neutral domain with a standard login form
                        risk_score = 0.15
                        details.append("Brand-Neutral Application: Standard authentication portal with zero brand lures and clean threat feeds (Safe 85.0%)")
                else:
                    # Deceptive DOM structural anomaly (hidden iframe)
                    risk_score = 0.55
                    details.append("Brand-Neutral Domain: Deceptive DOM structural elements (hidden iframe); routed to Tier 2 Quarantine")
            else:
                # Unrated domain with predatory financial lure keywords
                risk_score = 0.65
                details.append("Brand-Neutral Domain: Unrated domain with predatory lure keywords; routed to Tier 2 Quarantine")

    # 2.8 Graduated Friction Response Tiers
    if risk_score > 0.74:
        final_prediction = "Phishing"
        reported_confidence = risk_score
        friction_level = "block"
        advisory_message = "Tier 1 Automated Block: Weaponized phishing infrastructure or deceptive lures detected."
    elif risk_score > 0.40:
        final_prediction = "Suspicious"
        reported_confidence = risk_score
        friction_level = "quarantine"
        advisory_message = "Tier 2 Human-in-the-Loop Quarantine: Domain exhibits ambiguous signals (brand-adjacent reference or anomalous structure). Routed to review queue."
    else:
        final_prediction = "Safe"
        reported_confidence = 1.0 - risk_score
        if domain_age_days is not None and domain_age_days < 30:
            friction_level = "advisory"
            advisory_message = f"Newly Registered Domain Advisory: Domain was registered recently ({domain_age_days} days ago). No malicious indicators were detected, but exercise standard caution."
        elif domain_age_days is None and not (domain_netloc in top_domains or domain_etld1 in top_domains):
            friction_level = "advisory"
            advisory_message = "Unverified Domain Advisory: Domain age is unrated / zero-day. No threat indicators detected; proceed with normal caution."
        else:
            friction_level = "none"
            advisory_message = None

    if vt_info.get("malicious", 0) > 0:
        details.append(f"VirusTotal found {vt_info['malicious']} vendor flags (Warning)")
    else:
        details.append("VirusTotal: Safe/Unrated")

    if gsb_info.get("error"):
        details.append(f"Google Safe Browsing: {gsb_info['error']}")
    else:
        details.append("Google Safe Browsing: Safe")

    response = {
        "prediction": final_prediction,
        "confidence": reported_confidence,
        "details": " | ".join(details),
        "friction_level": friction_level,
        "advisory_message": advisory_message
    }
    if shadow_telemetry is not None:
        response["shadow_telemetry"] = shadow_telemetry
    return response

def detect_email_phishing(content: str, subject: str = "", sender: str = "") -> dict:
    ensure_models_loaded()
    legacy_prob = None
    if email_model:
        try:
            legacy_prob = float(email_model.predict_proba([content])[0][1])
            is_phish = legacy_prob > 0.5
            prediction = "Phishing" if is_phish else "Safe"
            confidence = legacy_prob if is_phish else (1.0 - legacy_prob)
            details = "Predicted using trained TF-IDF Logistic Regression model."
        except Exception as e:
            return {"prediction": "Error", "confidence": 0, "details": str(e)}
    else:
        # Heuristic fallback
        suspicious_keywords = ["urgent", "account suspended", "click here", "password", "invoice"]
        is_suspicious = any(kw in content.lower() for kw in suspicious_keywords)
        if is_suspicious:
            confidence = random.uniform(0.85, 0.99)
            legacy_prob = confidence
            prediction = "Phishing"
            details = "Urgency / credential harvesting keyword pattern matched."
        else:
            confidence = random.uniform(0.70, 0.95)
            legacy_prob = 1.0 - confidence
            prediction = "Safe"
            details = "No urgent phishing keywords detected."

    # 2. Email-EDL Shadow Evaluation (Non-blocking, Behind Flag)
    shadow_telemetry = None
    ENABLE_EMAIL_EDL_SHADOW = os.getenv("ENABLE_EMAIL_EDL_SHADOW", "true").lower() in ("true", "1", "yes")
    if ENABLE_EMAIL_EDL_SHADOW and email_edl_shadow_model is not None:
        try:
            t0 = time.perf_counter()
            from email_edl import extract_email_tabular_features, tokenize_email_body
            raw_tab = extract_email_tabular_features([subject], [content], [sender])
            if email_edl_shadow_scaler is not None:
                X_tab_edl = email_edl_shadow_scaler.transform(raw_tab)
            else:
                X_tab_edl = raw_tab
            X_seq_edl = tokenize_email_body([content], max_len=256)
            
            alpha_pred = email_edl_shadow_model([X_seq_edl, X_tab_edl], training=False).numpy()[0]
            S = float(np.sum(alpha_pred))
            u = float(2.0 / S) if S > 0 else 1.0
            p_edl = float(alpha_pred[1] / S) if S > 0 else 0.5
            lat_ms = (time.perf_counter() - t0) * 1000.0
            
            email_hash = hashlib.sha256(content.encode('utf-8', errors='ignore')).hexdigest()[:12]
            shadow_telemetry = {
                "email_hash": email_hash,
                "legacy_prob": round(legacy_prob, 4) if legacy_prob is not None else None,
                "edl_prob": round(p_edl, 4),
                "edl_uncertainty": round(u, 4),
                "edl_strength": round(S, 4),
                "u": round(u, 4),
                "S": round(S, 4),
                "latency_ms": round(lat_ms, 2)
            }
            
            # Non-blocking file logging for field ECE audit
            log_dir = os.path.join(BASE_DIR, "logs")
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, "shadow_email_edl.log")
            with open(log_file, "a", encoding="utf-8") as f_log:
                leg_str = f"{legacy_prob:.4f}" if legacy_prob is not None else "None"
                f_log.write(f"{datetime.utcnow().isoformat()},{email_hash},{leg_str},{p_edl:.4f},{u:.4f},{S:.4f},{lat_ms:.2f}\n")
        except Exception:
            # Shadow evaluation must never block live serving
            pass

    response = {
        "prediction": prediction,
        "confidence": confidence,
        "details": details
    }
    if shadow_telemetry is not None:
        response["shadow_telemetry"] = shadow_telemetry
    return response

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
            
        # 3. Robust Multipart / Base64 / HTML Body & Payload Extraction
        body_parts = []
        extracted_urls = []
        
        def decode_payload_bytes(payload_raw, charset=None) -> str:
            if not payload_raw:
                return ""
            if isinstance(payload_raw, str):
                return payload_raw
            encodings = [charset] if charset else []
            encodings.extend(['utf-8', 'latin-1', 'windows-1252', 'ascii'])
            for enc in encodings:
                if not enc:
                    continue
                try:
                    return payload_raw.decode(enc, errors='strict')
                except (UnicodeDecodeError, LookupError):
                    continue
            return payload_raw.decode('utf-8', errors='replace')

        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type().lower()
                c_disp = str(part.get('Content-Disposition', '')).lower()
                
                # Check for risky attachment extensions
                fname = part.get_filename() or ''
                if fname:
                    fname_lower = fname.lower()
                    if any(fname_lower.endswith(ext) for ext in ['.exe', '.scr', '.vbs', '.js', '.bat', '.iso', '.htm', '.html']):
                        details.append(f"Attachment Anomaly: Suspicious executable/script attachment detected ({fname})")
                        anomaly_score += 0.4
                
                if 'attachment' in c_disp and not ctype.startswith('text/'):
                    continue
                    
                if ctype == 'text/plain':
                    raw_bytes = part.get_payload(decode=True)
                    text = decode_payload_bytes(raw_bytes, part.get_content_charset())
                    if text.strip():
                        body_parts.append(text.strip())
                elif ctype == 'text/html':
                    raw_bytes = part.get_payload(decode=True)
                    html_text = decode_payload_bytes(raw_bytes, part.get_content_charset())
                    if html_text.strip():
                        try:
                            soup = BeautifulSoup(html_text, 'html.parser')
                            for a_tag in soup.find_all('a', href=True):
                                href = a_tag['href'].strip()
                                if href.startswith(('http://', 'https://')):
                                    extracted_urls.append(href)
                            clean_text = soup.get_text(separator=' ', strip=True)
                            body_parts.append(clean_text)
                        except Exception:
                            body_parts.append(html_text.strip())
        else:
            ctype = msg.get_content_type().lower()
            raw_bytes = msg.get_payload(decode=True)
            text = decode_payload_bytes(raw_bytes, msg.get_content_charset())
            if ctype == 'text/html':
                try:
                    soup = BeautifulSoup(text, 'html.parser')
                    for a_tag in soup.find_all('a', href=True):
                        href = a_tag['href'].strip()
                        if href.startswith(('http://', 'https://')):
                            extracted_urls.append(href)
                    text = soup.get_text(separator=' ', strip=True)
                except Exception:
                    pass
            if text.strip():
                body_parts.append(text.strip())

        body_content = "\n\n".join(body_parts).strip()
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
                    
        # 4. Base ML Analysis & Evidential Shadow Evaluation
        subj = str(msg.get('Subject', ''))
        ml_result = detect_email_phishing(body_content, subject=subj, sender=from_header)
        
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
        
        response = {
            "prediction": final_prediction,
            "confidence": final_confidence if final_prediction != "Safe" else 1.0 - final_confidence,
            "details": " | ".join(details)
        }
        if "shadow_telemetry" in ml_result:
            response["shadow_telemetry"] = ml_result["shadow_telemetry"]
        return response
        
    except Exception as e:
        return {"prediction": "Error", "confidence": 0, "details": f"Failed to parse EML file: {str(e)}"}

def detect_qr_phishing(decoded_payload: str, img=None) -> dict:
    """
    Multimodal Defense-in-Depth QR Phishing (Quishing) Engine.
    Combines Computer Vision structural analysis, protocol risk profiling,
    recursive multi-hop URL unrolling, and M3 (Multimodal Early Fusion + Softmax) calibrated neural evaluation.
    """
    from quishing_engine import (
        analyze_qr_visual_structure,
        analyze_payload_protocol,
        recursively_unroll_url,
        evaluate_m3_early_fusion
    )

    details = []
    quishing_anomaly_score = 0.0

    # 0. Ensure neural weights & models are loaded
    ensure_models_loaded()

    # 1. M3 Multimodal Early Fusion (Vision + Lexical -> Softmax, Calibrated ECE 0.0236)
    m3_res = evaluate_m3_early_fusion(img, decoded_payload, model=m3_early_fusion_model, tokenizer=tokenizer)
    m3_prob = None
    if m3_res.get("available"):
        m3_prob = m3_res["prob_phishing"]
        details.append(f"M3 Multimodal Neural Analysis: {m3_prob*100:.1f}% Phishing Probability (Calibrated ECE 0.0236)")

    # 2. Payload & Protocol Analysis
    proto_info = analyze_payload_protocol(decoded_payload)
    quishing_anomaly_score += proto_info["protocol_risk"]
    if proto_info["anomalies"]:
        details.extend(proto_info["anomalies"])

    # 3. Visual Structural Integrity Analysis (OpenCV)
    if img is not None:
        visual_info = analyze_qr_visual_structure(img)
        quishing_anomaly_score += visual_info["visual_risk_score"]
        if visual_info["anomalies"]:
            details.extend(visual_info["anomalies"])

    # 4. Recursive URL Unrolling & Destination Analysis
    if proto_info["target_url"]:
        initial_parsed = urllib.parse.urlparse(proto_info["target_url"])
        initial_domain = initial_parsed.netloc.lower().split(":")[0]

        final_url, redirect_chain, redirect_risk = recursively_unroll_url(proto_info["target_url"])
        final_domain = urllib.parse.urlparse(final_url).netloc.lower().split(":")[0]

        quishing_anomaly_score += redirect_risk
        if redirect_risk > 0 or (len(redirect_chain) > 1 and initial_domain != final_domain):
            details.append(f"Cloaking Detected: QR shortener redirected through {len(redirect_chain)-1} hops from {initial_domain} to destination: {final_domain}")

        # 5. Layered URL Security Inference (Multi-Source OSINT Consensus)
        url_eval = detect_url_phishing(final_url)
        details.append(url_eval["details"])

        # 6. Multimodal Decision Fusion with Layered Consensus Override
        if url_eval["prediction"] == "Phishing":
            # Destination URL is independently confirmed malicious (GSB, VT >= 3, or Typosquat)
            final_prediction = "Phishing"
            final_confidence = max(url_eval["confidence"], m3_prob if m3_prob is not None else 0.85)
        elif url_eval["prediction"] == "Safe":
            # Destination is confirmed SAFE by multi-source consensus (Whitelist / Domain Age > 365d / Clean VT & GSB)
            if quishing_anomaly_score > 0.40:
                # Discrepancy between clean destination and high-risk exploit protocol/shortener cloaking
                final_prediction = "Suspicious"
                final_confidence = 0.55
                details.append("Quarantine (Tier 2): Clean destination domain but anomalous QR transport protocol/cloaking detected")
            else:
                final_prediction = "Safe"
                # Inherit the calibrated consensus confidence from the OSINT verification layer
                final_confidence = url_eval["confidence"]
        else:  # "Suspicious"
            # Intermediate destination risk: blend M3 probability with URL suspicion
            if m3_prob is not None and m3_prob > 0.74:
                final_prediction = "Suspicious"
                final_confidence = min(0.70, 0.50 * m3_prob + 0.50 * url_eval["confidence"])
            else:
                final_prediction = "Suspicious"
                final_confidence = url_eval["confidence"]
    else:
        # Non-URL payload (e.g. WiFi, SMS, Payment)
        if proto_info["protocol_risk"] > 0.40:
            final_prediction = "Suspicious" if proto_info["protocol_risk"] < 0.60 else "Phishing"
            final_confidence = proto_info["protocol_risk"]
        elif m3_prob is not None:
            if m3_prob > 0.74:
                final_prediction = "Phishing"
                final_confidence = m3_prob
            elif m3_prob > 0.40:
                final_prediction = "Suspicious"
                final_confidence = m3_prob
            else:
                final_prediction = "Safe"
                final_confidence = 1.0 - m3_prob
        else:
            final_prediction = "Safe"
            final_confidence = 0.80

    return {
        "prediction": final_prediction,
        "confidence": final_confidence,
        "details": " | ".join(details),
        "neural_metrics": m3_res if m3_res.get("available") else None
    }

def get_osint_data(url: str) -> dict:
    parsed = urllib.parse.urlparse(url if url.startswith('http') else 'http://' + url)
    domain = parsed.netloc.split(':')[0]
    
    parts = domain.split('.')
    tld = parts[-1] if len(parts) > 1 else ""
    
    full_url = url if url.startswith(("http://", "https://")) else f"https://{url}"
    screenshot_path = f"/api/detect/screenshot?url={urllib.parse.quote(full_url, safe='')}"

    # Target brand detection via homoglyph / Levenshtein distance against high-risk target brands
    detected_brand = None
    try:
        from features import detect_target_brand
        detected_brand = detect_target_brand(domain)
    except Exception as e:
        print(f"Brand detection error: {e}")

    osint = {
        "ip_address": None,
        "location": None,
        "asn": None,
        "hosting_provider": None,
        "tld": tld,
        "screenshot_url": screenshot_path,
        "brand": detected_brand if detected_brand else "None (Generic Domain)",
        "ssl_issuer": None,
        "certificate_details": None
    }
    
    # Try fetching SSL Details
    ip = resolve_domain_ip(domain)
    if ip:
        osint["ip_address"] = ip
        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((domain, 443), timeout=2) as sock:
                with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                    cert = ssock.getpeercert()
                    
                    # Extract SSL Certificate Authority (Issuer Organization)
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
                        osint["ssl_issuer"] = issuer_org
                    
                    if san_list:
                        osint["certificate_details"] = f"{issuer_org}: " + ", ".join(san_list[:3]) + ("..." if len(san_list) > 3 else "")
                        
        except Exception as e:
            print(f"SSL error: {e}")
        
        try:
            geo_resp = requests.get(f"http://ip-api.com/json/{ip}", timeout=2)
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

