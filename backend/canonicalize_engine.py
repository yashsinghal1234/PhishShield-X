"""
Deterministic Canonicalization & Evasion Normalization Engine.
Implements:
1. IDN / Punycode decoding (idna.decode) and confusable skeleton mapping to Latin.
2. Target brand edit-distance calculation against normalized skeletons.
3. Nested open-redirect unwrapping (extracts inner URL from redirect parameters).
4. Host infrastructure categorization (raw IPv4, non-standard ports, ephemeral tunnels, dynamic DNS).
"""

import re
import idna
from urllib.parse import urlparse, parse_qs, unquote
import unicodedata

TARGET_BRANDS = [
    "google", "microsoft", "apple", "amazon", "paypal", "netflix",
    "facebook", "instagram", "twitter", "linkedin", "whatsapp",
    "wellsfargo", "chase", "bankofamerica", "citibank", "coinbase",
    "binance", "steam", "roblox", "adobe", "dropbox", "dhl", "fedex"
]

KNOWN_TUNNELS_AND_DDNS = {
    "ngrok.io", "ngrok-free.app", "ngrok.app", "trycloudflare.com", "localtunnel.me",
    "duckdns.org", "no-ip.com", "ddns.net", "pages.dev", "workers.dev",
    "firebaseapp.com", "web.app", "glitch.me", "replit.dev"
}

# Unicode confusable character map (Cyrillic/Greek lookalikes to Latin skeletons)
CONFUSABLE_MAP = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K',
    'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
    'а́': 'a', 'е́': 'e', 'і́': 'i', 'о́': 'o', 'у́': 'y'
}

def unwrap_redirect(url: str) -> str:
    """Unwraps nested destination URLs from open redirect parameters."""
    u = url.strip()
    # Check for parameters like url=, q=, u=, dest=, target=, link=
    redirect_params = ['q', 'url', 'u', 'dest', 'destination', 'target', 'link', 'r']
    try:
        parsed = urlparse(u if '://' in u else f'http://{u}')
        qs = parse_qs(parsed.query)
        for param in redirect_params:
            if param in qs and len(qs[param]) > 0:
                inner = qs[param][0]
                if re.match(r'^(https?://|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', inner):
                    return inner.strip()
    except Exception:
        pass
    return u

def decode_and_skeletonize_domain(domain: str) -> tuple:
    """
    Decodes Punycode (xn--) and maps confusable glyphs to Latin ASCII skeletons.
    Returns: (decoded_domain, skeleton_domain, is_punycode, has_confusables)
    """
    is_puny = False
    has_conf = False
    clean = domain.lower().strip()
    
    # 1. Punycode decoding
    parts = clean.split('.')
    decoded_parts = []
    for p in parts:
        if p.startswith('xn--'):
            is_puny = True
            try:
                decoded_parts.append(idna.decode(p))
            except Exception:
                decoded_parts.append(p)
        else:
            decoded_parts.append(p)
    decoded_domain = '.'.join(decoded_parts)
    
    # 2. Confusable mapping to Latin skeleton
    skeleton_chars = []
    for char in decoded_domain:
        if char in CONFUSABLE_MAP:
            skeleton_chars.append(CONFUSABLE_MAP[char])
            has_conf = True
        else:
            skeleton_chars.append(char)
    skeleton_domain = ''.join(skeleton_chars)
    
    return decoded_domain, skeleton_domain, is_puny, has_conf

def compute_brand_impersonation(skeleton_domain: str) -> dict:
    """Computes minimum edit distance to target brands from the skeleton domain."""
    import difflib
    # Extract main SLD
    parts = skeleton_domain.split('.')
    sld = parts[0] if len(parts) > 1 else skeleton_domain
    sld_clean = re.sub(r'[^a-z0-9]', '', sld.lower())
    
    best_brand = None
    best_sim = 0.0
    for brand in TARGET_BRANDS:
        sim = difflib.SequenceMatcher(None, sld_clean, brand).ratio()
        if sim > best_sim:
            best_sim = sim
            best_brand = brand
            
    is_impersonation = False
    # If high similarity (>= 0.78) but not exact official domain
    if 0.75 <= best_sim < 1.0 and len(sld_clean) >= 4:
        is_impersonation = True
        
    return {
        "best_matched_brand": best_brand,
        "brand_similarity": float(best_sim),
        "is_impersonation": is_impersonation
    }

def analyze_host_infrastructure(url: str) -> dict:
    """Analyzes if host uses raw IP, custom ports, or dynamic tunnel services."""
    u = url.strip()
    # Extract host
    host_match = re.search(r'^(?:https?://)?([^/:]+)(?::(\d+))?', u)
    if not host_match:
        return {"is_ip": False, "has_custom_port": False, "is_tunnel": False}
        
    host = host_match.group(1).lower()
    port = host_match.group(2)
    
    is_ip = bool(re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', host))
    has_custom_port = bool(port and port not in ['80', '443'])
    
    is_tunnel = False
    for t in KNOWN_TUNNELS_AND_DDNS:
        if host == t or host.endswith('.' + t):
            is_tunnel = True
            break
            
    return {
        "host": host,
        "is_ip": is_ip,
        "has_custom_port": has_custom_port,
        "is_tunnel": is_tunnel
    }

def canonicalize_url_advanced(raw_url: str) -> dict:
    """
    Full canonicalization pipeline:
    1. Unwraps nested redirect parameters
    2. Decodes Punycode & maps confusables
    3. Analyzes infrastructure (IP, ports, tunnels)
    4. Computes brand impersonation metrics
    """
    unwrapped = unwrap_redirect(raw_url)
    was_redirect = (unwrapped != raw_url)
    
    # Strip scheme and www for representation
    u_norm = re.sub(r'^[a-zA-Z]+://', '', unwrapped)
    u_norm = re.sub(r'^www\.', '', u_norm, flags=re.IGNORECASE).rstrip('/')
    
    domain_part = u_norm.split('/')[0] if '/' in u_norm else u_norm
    dec_dom, skel_dom, is_puny, has_conf = decode_and_skeletonize_domain(domain_part)
    brand_info = compute_brand_impersonation(skel_dom)
    infra_info = analyze_host_infrastructure(unwrapped)
    
    return {
        "raw_url": raw_url,
        "unwrapped_url": unwrapped,
        "was_redirect": was_redirect,
        "normalized_url": u_norm,
        "decoded_domain": dec_dom,
        "skeleton_domain": skel_dom,
        "is_punycode": is_puny,
        "has_confusables": has_conf,
        "is_ip": infra_info["is_ip"],
        "has_custom_port": infra_info["has_custom_port"],
        "is_tunnel": infra_info["is_tunnel"],
        "brand_match": brand_info["best_matched_brand"],
        "brand_similarity": brand_info["brand_similarity"],
        "is_brand_impersonation": brand_info["is_impersonation"]
    }

if __name__ == "__main__":
    test_urls = [
        "xn--microsft-z3a.com/login/oauth2",
        "google.com/url?q=http://malicious-credential-stealer.com/auth",
        "192.168.1.105:8080/login.php?user=admin",
        "secure-login-token-99812.ngrok-free.app/signin",
        "mit.edu/research/computing-culture"
    ]
    for tu in test_urls:
        res = canonicalize_url_advanced(tu)
        print(f"\nRaw: {tu}")
        print(f" -> Unwrapped: {res['unwrapped_url']} (Redirect: {res['was_redirect']})")
        print(f" -> Skeleton: {res['skeleton_domain']} (Punycode: {res['is_punycode']}, Brand: {res['brand_match']} Sim={res['brand_similarity']:.2f}, Impersonation={res['is_brand_impersonation']})")
        print(f" -> Infra: IP={res['is_ip']}, Tunnel={res['is_tunnel']}, CustomPort={res['has_custom_port']}")

