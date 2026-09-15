import urllib.request
import urllib.parse
import json
import sys

# Exact DOI or title searches to guarantee exact matches
exact_queries = [
    {"key": "sensoy2018", "doi": "10.5555/3327757.3327771", "query": "Evidential Deep Learning to Quantify Classification Uncertainty Sensoy"},
    {"key": "krombholz2014", "doi": "10.1007/978-3-319-07620-1_8", "query": "QR Code Security: A Survey of Attacks and Challenges for Usable Security Krombholz"},
    {"key": "vidas2013", "doi": "10.1007/978-3-642-41320-9_4", "query": "QRishing: The Susceptibility of Smartphone Users to QR Code Phishing Attacks Vidas"},
    {"key": "lin2021", "doi": None, "query": "Phishpedia: A Hybrid Deep Learning-Based Approach to Visually Identify Phishing Webpages"},
    {"key": "abdelnabi2020", "doi": "10.1145/3372297.3417233", "query": "VisualPhishNet: Zero-Day Phishing Website Detection by Visual Similarity Abdelnabi"},
    {"key": "sahoo2017", "doi": "10.1145/3344289", "query": "Malicious URL Detection using Machine Learning: A Survey Sahoo"},
    {"key": "guo2017", "doi": "10.5555/3305381.3305518", "query": "On Calibration of Modern Neural Networks Guo Pleiss"},
    {"key": "malinin2018", "doi": None, "query": "Predictive Uncertainty Estimation via Prior Networks Malinin Gales"},
    {"key": "charpentier2020", "doi": None, "query": "Posterior Network: Normalizing Flow for Uncertainty Estimation in Deep Learning Charpentier"},
    {"key": "hendrycks2019", "doi": None, "query": "Deep Anomaly Detection with Outlier Exposure Hendrycks Mazeika"},
    {"key": "ulmer2023", "doi": None, "query": "Assessing Evidential Deep Learning for Out-of-Distribution Detection Ulmer"},
    {"key": "biggio2012", "doi": "10.5555/3042573.3042761", "query": "Poisoning Attacks against Support Vector Machines Biggio Nelson Laskov"},
    {"key": "carlini2023", "doi": "10.1109/SP46215.2023.10179300", "query": "Poisoning Web-Scale Training Datasets is Consequentially Easy Carlini"},
    {"key": "ratner2017", "doi": "10.14778/3157794.3157797", "query": "Snorkel: Rapid Training Data Creation with Weak Supervision Ratner Bach"},
    {"key": "galadima2025", "doi": "10.17632/cmhh7744sp.1", "query": "Dataset of 1000 Images of Malicious and Benign QR codes 2025 Galadima"}
]

verified_list = []

for item in exact_queries:
    key = item["key"]
    if item.get("doi"):
        url = f"https://api.openalex.org/works/https://doi.org/{item['doi']}"
    else:
        encoded = urllib.parse.quote(item["query"])
        url = f"https://api.openalex.org/works?search={encoded}&per_page=1"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'mailto:research@phishshield.org'})
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))
        doc = data if item.get("doi") else (data['results'][0] if data.get('results') else None)
        if doc:
            title = doc.get("title", "")
            authors = [a['author']['display_name'] for a in doc.get("authorships", [])]
            year = doc.get("publication_year", "")
            venue = doc.get("primary_location", {}).get("source", {}).get("display_name", "") if doc.get("primary_location") and doc.get("primary_location").get("source") else ""
            doi = doc.get("doi", "")
            verified_list.append({
                "key": key,
                "title": title,
                "authors": authors,
                "year": year,
                "venue": venue,
                "doi": doi
            })
    except Exception as e:
        print(f"Error on {key}: {e}", file=sys.stderr)

with open("scratch/clean_citation_audit.json", "w", encoding="utf-8") as f:
    json.dump(verified_list, f, indent=2, ensure_ascii=False)

print(f"Successfully audited {len(verified_list)} papers with clean UTF-8 metadata!")
