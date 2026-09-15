import urllib.request
import json
import urllib.parse
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def query_openalex_exact(title):
    try:
        url = f"https://api.openalex.org/works?filter=title.search:{urllib.parse.quote(title)}&per_page=3"
        req = urllib.request.Request(url, headers={'User-Agent': 'mailto:phishshield_researcher@gmail.com'})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode('utf-8'))
            results = data.get('results', [])
            matches = []
            for item in results:
                authors = [a['author']['display_name'] for a in item.get('authorships', [])]
                venue = item.get('primary_location', {}).get('source', {}).get('display_name') if item.get('primary_location', {}).get('source') else (item.get('host_venue', {}).get('name') if item.get('host_venue') else None)
                matches.append({
                    'title': item.get('title'),
                    'authors': authors,
                    'year': item.get('publication_year'),
                    'venue': venue,
                    'doi': item.get('doi')
                })
            return matches
    except Exception as e:
        return [{'error': str(e)}]

def query_crossref_doi(doi):
    try:
        url = f"https://api.crossref.org/works/{doi}"
        req = urllib.request.Request(url, headers={'User-Agent': 'PhishShieldAudit/1.0 (mailto:audit@phishshield.org)'})
        with urllib.request.urlopen(req, timeout=8) as r:
            msg = json.loads(r.read().decode('utf-8'))['message']
            authors = []
            for a in msg.get('author', []):
                given = a.get('given', '')
                family = a.get('family', '')
                name = f"{given} {family}".strip() if (given or family) else a.get('name', '')
                authors.append(name)
            return {
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
        return {'error': str(e)}

items_to_audit = [
    ("krombholz2014", "10.1007/978-3-319-07620-1_8", "QR code security: A survey of attacks and challenges for usable security"),
    ("vidas2013", "10.1007/978-3-642-41320-9_4", "QRishing: The Susceptibility of Smartphone Users to QR Code Phishing Attacks"),
    ("abdelnabi2020", "10.1145/3372297.3417233", "VisualPhishNet: Zero-Day Phishing Website Detection by Visual Similarity"),
    ("sahoo2017", "10.1145/3307384", "Malicious URL Detection using Machine Learning: A Survey"),
    ("carlini2023", "10.1109/SP54263.2024.00179", "Poisoning Web-Scale Training Datasets is Practical"),
    ("ratner2017", "10.14778/3157794.3157797", "Snorkel: Rapid Training Data Creation with Weak Supervision"),
    ("bao2021", "10.1109/ICCV48922.2021.01310", "Evidential Deep Learning for Open Set Action Recognition"),
    ("galadima2025", "10.17632/cmhh7744sp.1", "Dataset of 1000 Images of Malicious and Benign QR Codes 2025"),
    ("sensoy2018", None, "Evidential Deep Learning to Quantify Classification Uncertainty"),
    ("guo2017", None, "On Calibration of Modern Neural Networks"),
    ("malinin2018", None, "Predictive Uncertainty Estimation via Prior Networks"),
    ("charpentier2020", None, "Posterior Network: Normalizing Flow for Uncertainty Estimation in Deep Learning"),
    ("hendrycks2019", None, "Deep Anomaly Detection with Outlier Exposure"),
    ("biggio2012", None, "Poisoning Attacks against Support Vector Machines"),
    ("ulmer2023", None, "Assessing Evidential Deep Learning for Out-of-Distribution Detection"),
    ("lin2021", None, "Phishpedia: A Hybrid Deep Learning-Based Approach to Visually Identify Phishing Webpages")
]

results = {}
for key, doi, title in items_to_audit:
    print(f"Checking {key}...", flush=True)
    if doi:
        cr = query_crossref_doi(doi)
        results[key] = cr
    else:
        oa = query_openalex_exact(title)
        results[key] = oa
    print(f"Done {key}.", flush=True)

with open('scratch/verified_primary_sources.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("ALL DONE SUCCESS!", flush=True)
