import urllib.request
import json
import urllib.parse
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def search_oa(query):
    url = f"https://api.openalex.org/works?search={urllib.parse.quote(query)}&per_page=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'mailto:audit@phishshield.org'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode('utf-8'))
            if d.get('results'):
                item = d['results'][0]
                authors = [a['author']['display_name'] for a in item.get('authorships', [])]
                bib = item.get('biblio', {})
                first_p = bib.get('first_page')
                last_p = bib.get('last_page')
                pages = f"{first_p}-{last_p}" if first_p and last_p else first_p
                return {
                    'title': item.get('title'),
                    'authors': authors,
                    'year': item.get('publication_year'),
                    'venue': item.get('primary_location', {}).get('source', {}).get('display_name') if item.get('primary_location', {}).get('source') else None,
                    'volume': bib.get('volume'),
                    'issue': bib.get('issue'),
                    'pages': pages,
                    'doi': item.get('doi')
                }
    except Exception as e:
        return {'error': str(e)}
    return None

queries = [
    ("charpentier2020", "Posterior Network Normalizing Flow Uncertainty Charpentier Zugner Gunnemann"),
    ("ulmer2023", "Trust Which Evidence Dennis Ulmer Christian Hardmeier Jes Frellsen"),
    ("ulmer_prior_posterior", "Prior and Posterior Networks Dennis Ulmer"),
    ("liu2024_phishintention", "PhishIntention Visual-Semantic Ruofan Liu Yun Lin Dinil Mon Divakaran Jin Song Dong"),
    ("sahoo2017", "Malicious URL Detection Machine Learning Survey Doyen Sahoo Chenghao Liu Steven Hoi"),
    ("peter2023", "Quishing in the wild Analyzing modern mobile QR phishing campaigns"),
    ("alaubidy2024", "Structural Anomaly Detection Visual Watermarking QR Code")
]

results = {}
for key, q in queries:
    res = search_oa(q)
    results[key] = res
    print(f"=== {key} ===")
    print(json.dumps(res, indent=2, ensure_ascii=False))

with open('scratch/detailed_checks.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("Finished detailed check.")
