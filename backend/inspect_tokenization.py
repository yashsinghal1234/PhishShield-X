import os
import pickle
import numpy as np

with open("backend/tokenizer.pkl", "rb") as f:
    tokenizer = pickle.load(f)

print("Tokenizer word index length:", len(tokenizer.word_index))
print("Tokenizer word index sample:", list(tokenizer.word_index.items())[:20])

sample_urls = [
    "http://en.wikipedia.org/wiki/Phishing",
    "http://amazon.com/login",
    "http://paypa1-secure-auth.xyz/verify",
    "WIFI:S:Executive_Guest_Wifi;T:WPA;P:CorpHarvest!99;;",
    "data:text/html;base64,PHNjcmlwdD53aW5kb3cubG9jYXRpb249J2h0dHA6Ly9waGlzaC54eXonPC9zY3JpcHQ+",
    "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b"
]

for s in sample_urls:
    seq = tokenizer.texts_to_sequences([s])[0]
    print(f"\nPayload: {s[:40]}... (len: {len(s)})")
    print(f"Token seq (len: {len(seq)}): {seq[:20]}...")
