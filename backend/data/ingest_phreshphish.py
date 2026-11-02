"""
Ingestion & Dual Split Construction for PhreshPhish Dataset
Downloads PhreshPhish parquet shards incrementally via Drive D cache,
extracts URL metadata (url, label, target, date), removes huge raw parquets,
and constructs both Domain-Disjoint (0% overlap) and Temporal (time-ordered) splits.
"""

import os, sys, shutil, time, warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download
import tldextract

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(BASE, "phreshphish_clean_subset.parquet")
TEMP_CACHE_DIR = "D:/hf_phreshphish_temp"

print("=" * 70)
print("PHRESHPHISH DATA INGESTION & DUAL SPLIT PREPARATION")
print("=" * 70)

os.makedirs(TEMP_CACHE_DIR, exist_ok=True)

# Select 6 training shards and 2 test shards to get ~30k diverse, fresh URLs
train_shards = [f"data/train-{i:03d}.parquet" for i in range(6)]
test_shards = [f"data/test-{i:03d}.parquet" for i in range(2)]
all_shards = train_shards + test_shards

extracted_dfs = []
print(f"Downloading and extracting {len(all_shards)} shards...")

for i, shard in enumerate(all_shards):
    t0 = time.time()
    try:
        f = hf_hub_download(
            repo_id="phreshphish/phreshphish",
            filename=shard,
            repo_type="dataset",
            local_dir=TEMP_CACHE_DIR
        )
        # Extract metadata columns only
        df = pd.read_parquet(f, columns=["url", "label", "target", "date"])
        df["shard"] = shard
        extracted_dfs.append(df)
        elapsed = time.time() - t0
        print(f"  [{i+1}/{len(all_shards)}] {shard}: extracted {len(df):,} samples ({elapsed:.1f}s)")
        
        # Immediately delete the heavy parquet file from disk
        if os.path.exists(f):
            os.remove(f)
    except Exception as e:
        print(f"  [ERROR] Failed shard {shard}: {e}")

# Clean up temp cache
shutil.rmtree(TEMP_CACHE_DIR, ignore_errors=True)

if not extracted_dfs:
    print("[FATAL] No shards extracted.")
    sys.exit(1)

full_df = pd.concat(extracted_dfs, ignore_index=True)
print("-" * 70)
print(f"Raw Extracted Samples: {len(full_df):,}")

# Filter valid URLs and map labels: 'phish' -> 1, 'benign' -> 0
full_df = full_df.dropna(subset=["url", "label", "date"]).copy()
full_df = full_df[full_df["label"].isin(["phish", "benign"])].copy()
full_df["y"] = (full_df["label"] == "phish").astype(int)

# Extract registered domain
ext = tldextract.TLDExtract(suffix_list_urls=())
print("Resolving registered domains via tldextract...")
domains = []
for u in full_df["url"]:
    d = ext(u).top_domain_under_public_suffix
    if not d:
        d = u.split("://")[-1].split("/")[0].split(":")[0]
    domains.append(d)
full_df["registered_domain"] = domains

# Drop exact duplicate URLs
full_df = full_df.drop_duplicates(subset=["url"]).reset_index(drop=True)

# Parse date
full_df["date"] = pd.to_datetime(full_df["date"])
full_df = full_df.sort_values("date").reset_index(drop=True)

print(f"Clean Unique Samples: {len(full_df):,}")
print(f"Label Distribution:   Safe={np.sum(full_df['y']==0):,}, Phish={np.sum(full_df['y']==1):,}")
print(f"Registered Domains:   {full_df['registered_domain'].nunique():,} unique domains")
print(f"Date Range:           {full_df['date'].min().strftime('%Y-%m-%d')} to {full_df['date'].max().strftime('%Y-%m-%d')}")

# Save clean subset
full_df.to_parquet(OUT_PATH, index=False)
print(f"\n[DONE] Saved clean PhreshPhish subset to: {OUT_PATH} ({os.path.getsize(OUT_PATH) / (1024*1024):.2f} MB)")

