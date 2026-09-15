import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

dois = {
    'krombholz2014': '10.1007/978-3-319-07620-1_8',
    'vidas2013': '10.1007/978-3-642-41320-9_4',
    'amoah2022': '10.5120/ijca2022922425',
    'agrawal2021': '10.1109/ANTS52808.2021.9936948',
    'abdelnabi2020': '10.1145/3372297.3417233',
    'sahoo2017': '10.1145/3307384',
    'bao2021': '10.1109/ICCV48922.2021.01310',
    'carlini2024': '10.1109/SP54263.2024.00179',
    'ratner2017': '10.14778/3157794.3157797',
    'galadima2025': '10.17632/cmhh7744sp.1'
}

for k, doi in dois.items():
    url = f'https://api.crossref.org/works/{doi}'
    req = urllib.request.Request(url, headers={'User-Agent': 'PhishShieldBibCheck/1.0 (mailto:admin@phishshield.org)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            msg = json.loads(r.read().decode('utf-8'))['message']
            title = msg.get('title', [''])[0]
            container = msg.get('container-title', [''])[0]
            vol = msg.get('volume')
            issue = msg.get('issue')
            page = msg.get('page')
            authors = [f"{a.get('given', '')} {a.get('family', '')}".strip() for a in msg.get('author', [])]
            print(f'=== {k} ===')
            print(f'DOI: {doi}')
            print(f'Title: {title}')
            print(f'Authors: {authors}')
            print(f'Container: {container}')
            print(f'Volume: {vol} | Issue: {issue} | Page: {page}')
            print()
    except Exception as e:
        print(f'=== {k} === ERROR: {e}\n')
