import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json

arxiv_queries = [
    ("sensoy2018", "Evidential Deep Learning to Quantify Classification Uncertainty"),
    ("sahoo2017", "Malicious URL Detection using Machine Learning: A Survey"),
    ("guo2017", "On Calibration of Modern Neural Networks"),
    ("malinin2018", "Predictive Uncertainty Estimation via Prior Networks"),
    ("charpentier2020", "Posterior Network: Normalizing Flow for Uncertainty Estimation in Deep Learning"),
    ("hendrycks2019", "Deep Anomaly Detection with Outlier Exposure"),
    ("bao2021", "Evidential Deep Learning for Open Set Action Recognition"),
    ("ulmer2023", "Assessing Evidential Deep Learning for Out-of-Distribution Detection"),
    ("biggio2012", "Poisoning Attacks against Support Vector Machines"),
    ("carlini2023", "Poisoning Web-Scale Training Datasets is Consequentially Easy"),
    ("chiew2024", "PhishIntention: A Visual-Semantic Approach for Phishing Webpage Detection"),
    ("peter2023", "Quishing in the Wild: Analyzing Modern Mobile QR Phishing Campaigns"),
    ("alaubidy2024", "Structural Anomaly Detection and Visual Watermarking for QR Code Authenticity")
]

print("=" * 80)
print("QUERYING ARXIV AND OFFICIAL REPOSITORIES")
print("=" * 80)

results = {}

for key, title in arxiv_queries:
    clean_title = title.replace(":", " ").replace("-", " ")
    q = f'ti:"{clean_title}"'
    url = f"http://export.arxiv.org/api/query?search_query={urllib.parse.quote(q)}&max_results=1"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=10)
        tree = ET.fromstring(resp.read())
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entry = tree.find('atom:entry', ns)
        if entry is not None:
            t = entry.find('atom:title', ns).text.strip().replace("\n", " ")
            authors = [a.find('atom:name', ns).text.strip() for a in entry.findall('atom:author', ns)]
            published = entry.find('atom:published', ns).text[:4]
            results[key] = {
                "title": t,
                "authors": authors,
                "year": published
            }
            print(f"[{key}] FOUND ON ARXIV:")
            print(f"  Title: {t}")
            print(f"  Authors: {', '.join(authors)}")
            print(f"  Year: {published}")
            print("-" * 60)
        else:
            print(f"[{key}] NOT FOUND on arXiv with query: {clean_title}")
    except Exception as e:
        print(f"[{key}] Error: {e}")

with open("scratch/arxiv_audit_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
