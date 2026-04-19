#!/usr/bin/env python3
"""
Translate English exercise descriptions to Czech using Claude API.
Usage: python3 scripts/translate_descriptions.py [--dry-run] [--limit N]
"""

import subprocess
import json
import os
import time
import argparse

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

ENGLISH_WORDS = {"the","and","your","you","with","from","this","that","are","have",
                 "will","can","use","set","keep","place","position","start","end",
                 "back","body","hands","feet","hold","make","sure","then","into",
                 "down","upper","lower","each","both","one","two","side","while"}

def db_query(sql: str) -> list:
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", SUPABASE_URL,
         "-H", f"Authorization: Bearer {SUPABASE_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": sql})],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)


def is_english(text: str) -> bool:
    words = text.lower().split()
    hits = sum(1 for w in words if w in ENGLISH_WORDS)
    return hits >= 3


def translate(name: str, description: str) -> str:
    prompt = f"""Přelož tento anglický popis cviku "{name}" do češtiny pro fitness aplikaci.

Zachovej číslování kroků (1. 2. 3. ...) pokud jsou v originále.
Piš přirozeně česky, prakticky a stručně.
Vrať POUZE přeložený text, bez vysvětlení.

Originál:
{description}"""

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 600,
        "messages": [{"role": "user", "content": prompt}]
    }

    result = subprocess.run(
        ["curl", "-s", "-X", "POST", "https://api.anthropic.com/v1/messages",
         "-H", f"x-api-key: {ANTHROPIC_API_KEY}",
         "-H", "anthropic-version: 2023-06-01",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True, text=True
    )

    data = json.loads(result.stdout)
    if "content" in data and data["content"]:
        return data["content"][0]["text"].strip()
    print(f"  API error: {data}")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set")
        return

    rows = db_query("SELECT id, name, description FROM exercises WHERE description IS NOT NULL AND trim(description) != '' ORDER BY name")
    to_translate = [r for r in rows if is_english(r["description"])]
    print(f"English descriptions to translate: {len(to_translate)}\n")

    if args.limit:
        to_translate = to_translate[:args.limit]

    stats = {"ok": 0, "fail": 0}

    for ex in to_translate:
        print(f"  {ex['name']}...", end=" ", flush=True)
        translated = translate(ex["name"], ex["description"])
        if translated:
            print(f"✓")
            if args.dry_run:
                print(f"    {translated[:100]}")
            else:
                safe = translated.replace("'", "''")
                db_query(f"UPDATE exercises SET description = '{safe}', updated_at = NOW() WHERE id = '{ex['id']}'")
            stats["ok"] += 1
        else:
            print("FAIL")
            stats["fail"] += 1
        time.sleep(0.2)

    print(f"\n=== Done ===")
    print(f"  Translated: {stats['ok']}")
    print(f"  Failed:     {stats['fail']}")


if __name__ == "__main__":
    main()
