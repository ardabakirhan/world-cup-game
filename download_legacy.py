# -*- coding: utf-8 -*-
"""Download FC25/FC24 candidate datasets via kagglehub and inspect schemas."""
import csv
import os
import sys

import kagglehub

CANDIDATES = [
    "aniss7/fifa-player-data-from-sofifa-2025-06-03",  # FC25, sofifa schema?
    "stefanoleone992/ea-sports-fc-24-complete-player-dataset",  # FC24, known schema
]

for ds in CANDIDATES:
    try:
        path = kagglehub.dataset_download(ds)
    except Exception as e:
        print(f"{ds}: DOWNLOAD FAILED: {e}")
        continue
    print(f"\n=== {ds} -> {path}")
    for root, _, files in os.walk(path):
        for fn in files:
            fp = os.path.join(root, fn)
            size = os.path.getsize(fp)
            print(f"  {fn}  {size/1e6:.1f} MB")
            if fn.endswith(".csv") and size > 100_000:
                with open(fp, encoding="utf-8", errors="replace") as f:
                    rd = csv.reader(f)
                    hdr = next(rd)
                    n = sum(1 for _ in rd)
                print(f"    rows={n}")
                print(f"    cols={hdr[:25]}{'...' if len(hdr) > 25 else ''}")
sys.stdout.flush()
