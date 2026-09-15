import urllib.request
import json
import urllib.parse
import sys

citations = [
    {
        "id": "trad2025",
        "query": "Detecting Quishing: A Deep Learning and Optical Character Recognition Approach Ali Trad",
        "doi": None
    },
    {
        "id": "sensoy2018",
        "query": "Evidential Deep Learning to Quantify Classification Uncertainty Sensoy Kaplan",
        "doi": None
    },
    {
        "id": "cic2025",
        "query": "CIC-Trap4Phish Canadian Institute for Cybersecurity",
        "doi": None
    },
    {
        "id": "sadiq2025",
        "query": "QR Phishing Visual Matrix Anomaly Dataset Muhammad Sadiq",
        "doi": None
    },
    {
        "id": "galadima2025",
        "query": "Dataset of 1000 Images of Malicious and Benign QR Codes 2025 Galadima",
        "doi": "10.17632/cmhh7744sp.1"
    },
    {
        "id": "krombholz2014",
        "query": "QR code security: A survey of attacks and challenges for usable security Krombholz",
        "doi": "10.1007/978-3-319-07620-1_8"
    },
    {
        "id": "vidas2013",
        "query": "QRishing: The Susceptibility of Smartphone Users to QR Code Phishing Attacks Vidas",
        "doi": None
    },
    {
        "id": "peter2023",
        "query": "Quishing in the wild: Analyzing modern mobile QR phishing campaigns",
        "doi": None
    },
    {
        "id": "alaubidy2024",
        "query": "Structural anomaly detection and visual watermarking for QR code authenticity",
        "doi": None
    },
    {
        "id": "lin2021",
        "query": "Phishpedia: A Hybrid Deep Learning-Based Approach to Visually Identify Phishing Webpages",
        "doi": None
    },
    {
        "id": "abdelnabi2020",
        "query": "VisualPhishNet: Zero-Day Phishing Website Detection by Visual Similarity Abdelnabi",
        "doi": "10.1145/3372297.3417233"
    },
    {
        "id": "chiew2024",
        "query": "PhishIntention: Visual-Semantic Intent Extraction for Phishing Identification Liu Lin",
        "doi": "10.1109/TIFS.2024.3355555" # query if doi unknown
    },
    {
        "id": "sahoo2017",
        "query": "Malicious URL Detection using Machine Learning: A Survey Sahoo Liu Hoi",
        "doi": "10.1145/3307384"
    },
    {
        "id": "guo2017",
        "query": "On Calibration of Modern Neural Networks Guo Pleiss Sun Weinberger",
        "doi": None
    },
    {
        "id": "malinin2018",
        "query": "Predictive Uncertainty Estimation via Prior Networks Malinin Gales",
        "doi": None
    },
    {
        "id": "charpentier2020",
        "query": "Posterior Network: Normalizing Flow for Uncertainty Estimation Charpentier",
        "doi": None
    },
    {
        "id": "hendrycks2019",
        "query": "Deep Anomaly Detection with Outlier Exposure Hendrycks Mazeika Dietterich",
        "doi": None
    },
    {
        "id": "bao2021",
        "query": "Evidential Deep Learning for Open Set Action Recognition Bao Yu Kong",
        "doi": "10.1109/ICCV48922.2021.01305"
    },
    {
        "id": "ulmer2023",
        "query": "Assessing Evidential Deep Learning for Out-of-Distribution Detection Ulmer Hardmeier Frellsen",
        "doi": None
    },
    {
        "id": "biggio2012",
        "query": "Poisoning Attacks against Support Vector Machines Biggio Nelson Laskov",
        "doi": None
    },
    {
        "id": "carlini2023",
        "query": "Poisoning Web-Scale Training Datasets is Consequentially Easy Carlini Jagielski",
        "doi": "10.1109/SP46215.2023.10179304"
    },
    {
        "id": "ratner2017",
        "query": "Snorkel: Rapid Training Data Creation with Weak Supervision Ratner Bach",
        "doi": "10.14778/3157794.3157797"
    }
]

def search_crossref_by_query(query):
    encoded = urllib.parse.quote(query)
    url = f"https://api.crossref.org/works?query={encoded}&rows=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'PhishShieldAudit/1.0 (mailto:admin@phishshield.org)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
            items = data.get('message', {}).get('items', [])
            if items:
                item = items[0]
                authors = []
                for a in item.get('author', []):
                    given = a.get('given', '')
                    family = a.get('family', '')
                    authors.append(f"{given} {family}".strip() if given or family else a.get('name', ''))
                return {
                    'title': item.get('title', [''])[0],
                    'authors': authors,
                    'container': item.get('container-title', [''])[0],
                    'year': item.get('published-print', item.get('published-online', item.get('created', {}))).get('date-parts', [[None]])[0][0],
                    'volume': item.get('volume'),
                    'issue': item.get('issue'),
                    'page': item.get('page'),
                    'doi': item.get('DOI')
                }
    except Exception as e:
        return {'error': str(e)}
    return None

results = {}
for c in citations:
    cid = c['id']
    q = c['query']
    print(f"Auditing {cid}: '{q}'...", flush=True)
    res = search_crossref_by_query(q)
    results[cid] = res
    print(f"-> {res}\n", flush=True)

with open('scratch/citation_audit_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)
print("Finished audit.")
