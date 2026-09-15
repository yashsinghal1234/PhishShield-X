from sklearn.base import BaseEstimator, TransformerMixin
import re
import math
from collections import Counter
from urllib.parse import urlparse
import difflib

# Top targeted brands for homoglyph / typosquatting distance calculation
TARGET_BRANDS = [
    "google", "microsoft", "apple", "amazon", "paypal", "netflix",
    "facebook", "instagram", "twitter", "linkedin", "whatsapp",
    "wellsfargo", "chase", "bankofamerica", "citibank", "coinbase",
    "binance", "steam", "roblox", "adobe", "dropbox", "dhl", "fedex",
    "ups", "usps", "yahoo", "outlook", "icloud", "ebay", "walmart"
]

SUSPICIOUS_KEYWORDS = [
    "login", "signin", "secure", "update", "verify", "account", "banking",
    "password", "auth", "credential", "confirm", "free", "bonus", "reward",
    "support", "service", "billing", "invoice", "wallet", "recover", "unlock"
]

HIGH_RISK_TLDS = {
    "xyz", "top", "tk", "zip", "cam", "work", "click", "loan", "gq", "cf",
    "ml", "ga", "buzz", "fit", "surf", "rest", "monster", "icu", "cyou"
}

KNOWN_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bit.do", "mcaf.ee", "su.pr", "cutt.ly", "shorturl.at"
}


def calculate_entropy(text: str) -> float:
    """Calculates Shannon Entropy of a given string: H(X) = -sum(p * log2(p))."""
    if not text:
        return 0.0
    counts = Counter(text)
    length = len(text)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return float(entropy)


def max_consecutive_run(text: str, condition_func) -> int:
    """Finds maximum consecutive length of characters satisfying condition_func."""
    max_len = 0
    current_len = 0
    for char in text:
        if condition_func(char):
            current_len += 1
            max_len = max(max_len, current_len)
        else:
            current_len = 0
    return max_len


def min_brand_distance(domain: str) -> tuple:
    """
    Computes minimum Levenshtein-like similarity and distance against top target brands.
    Returns (max_similarity_ratio, has_near_typo_match).
    """
    clean_domain = domain.lower().replace("www.", "").split(".")[0]
    if not clean_domain or len(clean_domain) < 3:
        return 0.0, 0

    max_sim = 0.0
    for brand in TARGET_BRANDS:
        sim = difflib.SequenceMatcher(None, clean_domain, brand).ratio()
        if sim > max_sim:
            max_sim = sim

    # If similarity is between 0.80 and 0.99, it's a near typo match (e.g. paypa1 vs paypal)
    is_typo = 1 if (0.78 <= max_sim < 1.0) else 0
    return float(max_sim), is_typo


def detect_target_brand(domain: str):
    """
    Identifies if domain is impersonating or matching a known target brand.
    Returns brand name capitalized if detected, else None.
    """
    if not domain:
        return None
    domain_lower = domain.lower().replace("www.", "")
    parts = domain_lower.split(".")
    domain_stem = parts[0] if len(parts) <= 2 else ".".join(parts[:-1])
    
    for brand in TARGET_BRANDS:
        if brand in domain_lower:
            return brand.capitalize()
        for token in re.split(r'[\.\-_]', domain_stem):
            if len(token) >= 3:
                sim = difflib.SequenceMatcher(None, token, brand).ratio()
                if sim >= 0.78:
                    return brand.capitalize()
    return None


class URLFeatureExtractor(BaseEstimator, TransformerMixin):
    """
    Advanced 34-Dimensional Cybersecurity Feature Extractor for Phishing URL Analysis.
    Captures Shannon Entropy, Lexical Ratios, Brand Homoglyphs, Obfuscation, and Structural Patterns.
    """

    FEATURE_NAMES = [
        "url_length",
        "domain_length",
        "path_length",
        "query_length",
        "domain_entropy",
        "path_entropy",
        "num_dots_domain",
        "num_dots_path",
        "num_hyphens_domain",
        "num_hyphens_path",
        "num_underscores",
        "num_slashes_path",
        "num_question_marks",
        "num_equals",
        "num_ampersands",
        "num_at_symbols",
        "num_percent_hex",
        "num_digits_domain",
        "num_digits_path",
        "digit_letter_ratio",
        "vowel_consonant_ratio",
        "max_consecutive_digits",
        "max_consecutive_consonants",
        "is_ip_address",
        "is_https",
        "is_shortener",
        "is_high_risk_tld",
        "subdomain_depth",
        "has_double_slash_path",
        "max_brand_similarity",
        "is_brand_typosquat",
        "keyword_count_domain",
        "keyword_count_path",
        "special_char_density"
    ]

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        features = []
        for url in X:
            url_str = str(url).strip()
            if not url_str:
                features.append([0.0] * len(self.FEATURE_NAMES))
                continue

            if not url_str.startswith(("http://", "https://")):
                url_parsed_str = "http://" + url_str
            else:
                url_parsed_str = url_str

            try:
                parsed = urlparse(url_parsed_str)
                domain = (parsed.netloc or "").lower().split(":")[0]
                path = parsed.path or ""
                query = parsed.query or ""
                scheme = (parsed.scheme or "").lower()
            except Exception:
                domain = ""
                path = url_str
                query = ""
                scheme = ""

            lower_url = url_str.lower()
            lower_domain = domain.lower()
            lower_path = path.lower()

            # 1. Structural Lengths
            url_len = len(url_str)
            domain_len = len(domain)
            path_len = len(path)
            query_len = len(query)

            # 2. Shannon Entropy
            domain_ent = calculate_entropy(domain)
            path_ent = calculate_entropy(path)

            # 3. Delimiter & Special Character Frequencies
            num_dots_domain = domain.count(".")
            num_dots_path = path.count(".")
            num_hyphens_domain = domain.count("-")
            num_hyphens_path = path.count("-")
            num_underscores = url_str.count("_")
            num_slashes_path = path.count("/")
            num_question_marks = url_str.count("?")
            num_equals = url_str.count("=")
            num_ampersands = url_str.count("&")
            num_at_symbols = url_str.count("@")
            num_percent_hex = url_str.count("%")

            # 4. Digits & Lexical Ratios
            digits_domain = sum(c.isdigit() for c in domain)
            digits_path = sum(c.isdigit() for c in path)
            total_digits = digits_domain + digits_path
            total_letters = sum(c.isalpha() for c in url_str)
            digit_letter_ratio = (total_digits / total_letters) if total_letters > 0 else 0.0

            vowels = sum(c in "aeiou" for c in lower_url)
            consonants = sum(c.isalpha() and c not in "aeiou" for c in lower_url)
            vowel_consonant_ratio = (vowels / consonants) if consonants > 0 else 0.0

            # 5. Consecutive Runs
            max_digits = max_consecutive_run(lower_url, lambda c: c.isdigit())
            max_consonants = max_consecutive_run(lower_url, lambda c: c.isalpha() and c not in "aeiou")

            # 6. IP Address in Domain
            is_ip = 1 if re.search(r"^(?:\d{1,3}\.){3}\d{1,3}$", domain) or re.search(r"0x[0-9a-fA-F]+", domain) else 0

            # 7. Protocol & Shortener
            is_https = 1 if scheme == "https" else 0
            clean_dom = domain.replace("www.", "")
            is_shortener = 1 if clean_dom in KNOWN_SHORTENERS else 0

            # 8. TLD Risk Profiling
            tld = domain.split(".")[-1] if "." in domain else ""
            is_high_risk_tld = 1 if tld in HIGH_RISK_TLDS else 0

            # 9. Subdomain Depth
            subdomain_depth = max(0, domain.count(".") - 1)

            # 10. Obfuscation & Redirect Trick
            has_double_slash_path = 1 if "//" in path else 0

            # 11. Brand Distance & Typosquatting
            max_brand_sim, is_brand_typo = min_brand_distance(domain)

            # 12. Sensitive Keywords
            keyword_count_domain = sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in lower_domain)
            keyword_count_path = sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in lower_path)

            # 13. Special Character Density
            special_chars = sum(not c.isalnum() for c in url_str)
            special_char_density = (special_chars / url_len) if url_len > 0 else 0.0

            features.append([
                float(url_len),
                float(domain_len),
                float(path_len),
                float(query_len),
                domain_ent,
                path_ent,
                float(num_dots_domain),
                float(num_dots_path),
                float(num_hyphens_domain),
                float(num_hyphens_path),
                float(num_underscores),
                float(num_slashes_path),
                float(num_question_marks),
                float(num_equals),
                float(num_ampersands),
                float(num_at_symbols),
                float(num_percent_hex),
                float(digits_domain),
                float(digits_path),
                digit_letter_ratio,
                vowel_consonant_ratio,
                float(max_digits),
                float(max_consonants),
                float(is_ip),
                float(is_https),
                float(is_shortener),
                float(is_high_risk_tld),
                float(subdomain_depth),
                float(has_double_slash_path),
                max_brand_sim,
                float(is_brand_typo),
                float(keyword_count_domain),
                float(keyword_count_path),
                special_char_density
            ])

        return features
