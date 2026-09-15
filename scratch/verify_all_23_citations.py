import urllib.request
import json
import urllib.parse
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# The 23 citations from manuscript
citation_queries = [
    {
        "key": "trad2025",
        "title": "Detecting Quishing: A Deep Learning and Optical Character Recognition Approach",
        "arxiv": "2501.00000" # check arxiv if available
    },
    {
        "key": "sensoy2018",
        "title": "Evidential Deep Learning to Quantify Classification Uncertainty",
        "authors_hint": "Sensoy, Kaplan, Kandemir"
    },
    {
        "key": "cic2025",
        "title": "CIC-Trap4Phish",
        "manual_note": "Benchmark Dataset from Canadian Institute for Cybersecurity, UNB (2025)"
    },
    {
        "key": "sadiq2025",
        "title": "Large-Scale QR Phishing and Visual Matrix Anomaly Dataset",
        "authors_hint": "Sadiq"
    },
    {
        "key": "galadima2025",
        "doi": "10.17632/cmhh7744sp.1",
        "title": "Dataset of 1000 Images of Malicious and Benign QR Codes 2025"
    },
    {
        "key": "krombholz2014",
        "doi": "10.1007/978-3-319-07620-1_8",
        "title": "QR Code Security: A Survey of Attacks and Challenges for Usable Security"
    },
    {
        "key": "vidas2013",
        "title": "QRishing: The Susceptibility of Smartphone Users to QR Code Phishing Attacks",
        "doi": "10.1007/978-3-642-41320-9_4"
    },
    {
        "key": "peter2023",
        "title": "Quishing in the wild: Analyzing modern mobile QR phishing campaigns",
        "doi": None
    },
    {
        "key": "alaubidy2024",
        "title": "Structural anomaly detection and visual watermarking for QR code authenticity",
        "doi": None
    },
    {
        "key": "lin2021",
        "title": "Phishpedia: A Hybrid Deep Learning-Based Approach to Visually Identify Phishing Webpages",
        "doi": None
    },
    {
        "key": "abdelnabi2020",
        "doi": "10.1145/3372297.3417233",
        "title": "VisualPhishNet: Zero-Day Phishing Website Detection by Visual Similarity"
    },
    {
        "key": "chiew2024",
        "title": "PhishIntention: Visual-Semantic Intent Extraction for Phishing Identification",
        "doi": None
    },
    {
        "key": "sahoo2017",
        "doi": "10.1145/3307384",
        "title": "Malicious URL Detection using Machine Learning: A Survey"
    },
    {
        "key": "guo2017",
        "title": "On Calibration of Modern Neural Networks",
        "doi": None
    },
    {
        "key": "malinin2018",
        "title": "Predictive Uncertainty Estimation via Prior Networks",
        "doi": None
    },
    {
        "key": "charpentier2020",
        "title": "Posterior Network: Normalizing Flow for Uncertainty Estimation in Deep Learning",
        "doi": None
    },
    {
        "key": "hendrycks2019",
        "title": "Deep Anomaly Detection with Outlier Exposure",
        "doi": None
    },
    {
        "key": "bao2021",
        "doi": "10.1109/ICCV48922.2021.01305",
        "title": "Evidential Deep Learning for Open Set Action Recognition"
    },
    {
        "key": "ulmer2023",
        "title": "Assessing Evidential Deep Learning for Out-of-Distribution Detection",
        "doi": None
    },
    {
        "key": "biggio2012",
        "title": "Poisoning Attacks against Support Vector Machines",
        "doi": None
    },
    {
        "key": "carlini2023",
        "doi": "10.1109/SP46215.2023.10179304",
        "title": "Poisoning Web-Scale Training Datasets is Consequentially Easy"
    },
    {
        "key": "ratner2017",
        "doi": "10.14778/3157794.3157797",
        "title": "Snorkel: Rapid Training Data Creation with Weak Supervision"
    },
    {
        "key": "fbi2024",
        "title": "Cyber Criminals Increasingly Using QR Codes to Evade Perimeter Detection",
        "manual_note": "FBI Cyber Division, Public Service Announcement / Flash Alert"
    }
]

def fetch_by_doi(doi):
    url = f"https://api.crossref.org/works/{doi}"
    req = urllib.request.Request(url, headers={'User-Agent': 'PhishShieldAudit/1.0 (mailto:audit@phishshield.org)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            msg = json.loads(r.read().decode('utf-8'))['message']
            authors = []
            for a in msg.get('author', []):
                given = a.get('given', '')
                family = a.get('family', '')
                name = f"{given} {family}".strip() if (given or family) else a.get('name', '')
                authors.append(name)
            return {
                'source': 'Crossref DOI',
                'title': msg.get('title', [''])[0],
                'authors': authors,
                'container': msg.get('container-title', [''])[0],
                'year': msg.get('published-print', msg.get('published-online', msg.get('created', {}))).get('date-parts', [[None]])[0][0],
                'volume': msg.get('volume'),
                'issue': msg.get('issue'),
                'page': msg.get('page'),
                'doi': msg.get('DOI')
            }
    except Exception as e:
        return {'error': f"DOI error: {e}"}

def fetch_by_openalex(title_query):
    url = f"https://api.openalex.org/works?filter=title.search:{urllib.parse.quote(title_query)}&per_page=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'mailto:audit@phishshield.org'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
            results = data.get('results', [])
            if results:
                item = results[0]
                authors = [a['author']['display_name'] for a in item.get('authorships', [])]
                venue = item.get('primary_location', {}).get('source', {}).get('display_name') if item.get('primary_location', {}).get('source') else None
                if not venue and item.get('host_venue'):
                    venue = item.get('host_venue', {}).get('name')
                biblio = item.get('biblio', {})
                return {
                    'source': 'OpenAlex Title Search',
                    'title': item.get('title'),
                    'authors': authors,
                    'container': venue,
                    'year': item.get('publication_year'),
                    'volume': biblio.get('volume'),
                    'issue': biblio.get('issue'),
                    'page': f"{biblio.get('first_page')}-{biblio.get('last_page')}" if biblio.get('first_page') else None,
                    'doi': item.get('doi')
                }
    except Exception as e:
        return {'error': f"OpenAlex error: {e}"}
    return None

verified_records = {}

for c in citation_queries:
    key = c['key']
    doi = c.get('doi')
    title = c.get('title')
    rec = None
    if doi:
        rec = fetch_by_doi(doi)
    if not rec or 'error' in rec:
        if title:
            rec = fetch_by_openalex(title)
    
    verified_records[key] = {
        'input': c,
        'verified': rec
    }
    print(f"=== {key} ===")
    print(json.dumps(verified_records[key], indent=2, ensure_ascii=False))
    print("\n")
    time.sleep(0.3)

with open('scratch/all_23_verified_citations.json', 'w', encoding='utf-8') as f:
    json.dump(verified_records, f, indent=2, ensure_ascii=False)

print("Saved all 23 records to scratch/all_23_verified_citations.json")
