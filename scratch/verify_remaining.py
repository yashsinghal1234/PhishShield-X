import urllib.request
import json
import urllib.parse
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def query_openalex(title_query):
    url = f"https://api.openalex.org/works?search={urllib.parse.quote(title_query)}&per_page=3"
    req = urllib.request.Request(url, headers={'User-Agent': 'mailto:audit_team@phishshield.org'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
            results = data.get('results', [])
            matches = []
            for item in results:
                authors = [a['author']['display_name'] for a in item.get('authorships', [])]
                venue = item.get('primary_location', {}).get('source', {}).get('display_name') if item.get('primary_location', {}).get('source') else None
                if not venue and item.get('host_venue'):
                    venue = item.get('host_venue', {}).get('name')
                biblio = item.get('biblio', {})
                matches.append({
                    'title': item.get('title'),
                    'authors': authors,
                    'year': item.get('publication_year'),
                    'venue': venue,
                    'volume': biblio.get('volume'),
                    'issue': biblio.get('issue'),
                    'page': f"{biblio.get('first_page')}-{biblio.get('last_page')}" if biblio.get('first_page') else None,
                    'doi': item.get('doi')
                })
            return matches
    except Exception as e:
        return [{'error': str(e)}]

targets = [
    ("sahoo2017", "Malicious URL Detection using Machine Learning: A Survey"),
    ("charpentier2020", "Posterior Network: Normalizing Flow for Uncertainty Estimation"),
    ("ulmer2023", "Assessing Evidential Deep Learning for Out-of-Distribution Detection"),
    ("chiew2024_phishintention", "PhishIntention: Visual-Semantic Approach to Identify Phishing"),
    ("chiew2024_tifs", "PhishIntention Liu Lin Divakaran Dong"),
    ("trad2025", "Detecting Quishing: A Deep Learning and Optical Character Recognition Approach"),
    ("sadiq2025", "Visual Matrix Anomaly Detection in QR Phishing"),
    ("galadima2025", "1000 Images of Malicious and Benign QR Codes 2025 Mendeley")
]

res = {}
for k, q in targets:
    print(f"Searching for {k}: {q}...", flush=True)
    res[k] = query_openalex(q)
    print(f"Done {k}.", flush=True)

with open('scratch/remaining_verified.json', 'w', encoding='utf-8') as f:
    json.dump(res, f, indent=2, ensure_ascii=False)
print("Saved remaining verified to scratch/remaining_verified.json")
