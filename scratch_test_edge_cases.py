import requests
import json

tests = [
    {
        "name": "Case 1: Fresh Brand-Neutral Domain",
        "url": "https://sunrise-bakery-shop.com",
        "desc": "Newly registered / privacy-protected startup site with clean content & no brand name"
    },
    {
        "name": "Case 2: Brand-Adjacent / Fair-Use Domain",
        "url": "https://apple-enthusiast-blog.com",
        "desc": "Informational fan blog referencing 'Apple' without scam keywords or abusive TLD"
    },
    {
        "name": "Case 3: Established Reputable Domain (Case A)",
        "url": "fullstackopen.com/en/part1/component_state_event_handlers",
        "desc": "Established 2,706-day domain with unusual educational slug"
    },
    {
        "name": "Case 4: Active Brand Phishing Lure (Case B)",
        "url": "http://paypal-security-update.xyz/login",
        "desc": "Typosquatted brand + high-abuse .xyz TLD + security update harvesting path"
    }
]

for t in tests:
    print(f"\n========================================================")
    print(f"{t['name']}: {t['url']}")
    print(f"Context: {t['desc']}")
    print(f"--------------------------------------------------------")
    try:
        r = requests.post("http://localhost:8000/api/detect/url", json={"url": t["url"]}, timeout=30).json()
        print(f"Verdict:    {r['prediction']} (Confidence: {r['confidence']*100:.1f}%)")
        print(f"Details:    {r['details']}")
    except Exception as e:
        print(f"Error: {e}")
