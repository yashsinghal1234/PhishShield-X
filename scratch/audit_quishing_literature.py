import urllib.request
import json
import urllib.parse
import sys
import xml.etree.ElementTree as ET

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def fetch_arxiv_query(q):
    url = f"http://export.arxiv.org/api/query?search_query={urllib.parse.quote(q)}&max_results=3"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            xml_str = r.read().decode('utf-8')
            root = ET.fromstring(xml_str)
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            entries = []
            for entry in root.findall('atom:entry', ns):
                title = entry.find('atom:title', ns).text.strip().replace('\n', ' ')
                authors = [a.find('atom:name', ns).text for a in entry.findall('atom:author', ns)]
                published = entry.find('atom:published', ns).text
                id_url = entry.find('atom:id', ns).text
                entries.append({'title': title, 'authors': authors, 'published': published, 'id': id_url})
            return entries
    except Exception as e:
        return [{'error': str(e)}]

def fetch_crossref_exact_title(title):
    url = f"https://api.crossref.org/works?query.bibliographic={urllib.parse.quote(title)}&rows=3"
    req = urllib.request.Request(url, headers={'User-Agent': 'mailto:phishshield_audit@gmail.com'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
            items = data.get('message', {}).get('items', [])
            res = []
            for item in items:
                authors = []
                for a in item.get('author', []):
                    given = a.get('given', '')
                    family = a.get('family', '')
                    name = f"{given} {family}".strip() if (given or family) else a.get('name', '')
                    authors.append(name)
                res.append({
                    'title': item.get('title', [''])[0],
                    'authors': authors,
                    'container': item.get('container-title', [''])[0],
                    'year': item.get('published-print', item.get('published-online', item.get('created', {}))).get('date-parts', [[None]])[0][0],
                    'doi': item.get('DOI')
                })
            return res
    except Exception as e:
        return [{'error': str(e)}]

print("--- Searching Trad & Chehab on arXiv ---")
trad_res = fetch_arxiv_query("ti:\"Detecting Quishing Attacks\" OR au:\"Chehab\"")
print(json.dumps(trad_res, indent=2))

print("\n--- Searching Peter Quishing in the wild ---")
peter_res = fetch_crossref_exact_title("Quishing in the wild: Analyzing modern mobile QR phishing campaigns")
print(json.dumps(peter_res, indent=2))

print("\n--- Searching Al-Aubidy Structural anomaly detection QR code ---")
alaubidy_res = fetch_crossref_exact_title("Structural Anomaly Detection and Visual Watermarking for QR Code Authenticity")
print(json.dumps(alaubidy_res, indent=2))

print("\n--- Searching Sadiq QR Phishing Visual Matrix ---")
sadiq_res = fetch_crossref_exact_title("Large-Scale QR Phishing and Visual Matrix Anomaly Dataset")
print(json.dumps(sadiq_res, indent=2))
