#!/usr/bin/env python3
"""
Generate Czech exercise descriptions using Claude API for exercises without descriptions.
Usage: python3 scripts/generate_descriptions.py [--dry-run] [--limit N]
"""

import subprocess
import json
import os
import time
import argparse

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def db_query(sql: str) -> list:
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", SUPABASE_URL,
         "-H", f"Authorization: Bearer {SUPABASE_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": sql})],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)


def generate_description(exercise_name: str) -> str:
    prompt = f"""Napiš stručný popis cviku "{exercise_name}" v češtině pro fitness aplikaci.

Formát: 2-4 věty. Nejprve postup provedení, pak tip na správnou techniku.
Piš jednoduše, prakticky, bez zbytečných slov. Žádné nadpisy, jen prostý text."""

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 300,
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


def update_description(exercise_id: str, description: str, dry_run: bool):
    safe = description.replace("'", "''")
    sql = f"UPDATE exercises SET description = '{safe}', updated_at = NOW() WHERE id = '{exercise_id}'"
    if dry_run:
        print(f"  [DRY RUN] {sql[:80]}...")
        return
    db_query(sql)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set")
        return

    exercises = db_query(
        "SELECT id, name FROM exercises WHERE description IS NULL OR trim(description) = '' ORDER BY name"
    )
    print(f"Found {len(exercises)} exercises without descriptions\n")

    if args.limit:
        exercises = exercises[:args.limit]

    stats = {"ok": 0, "fail": 0}

    for ex in exercises:
        name = ex["name"]
        ex_id = ex["id"]
        print(f"  Generating: {name}...", end=" ", flush=True)

        desc = generate_description(name)
        if desc:
            print(f"✓ ({len(desc)} chars)")
            if not args.dry_run:
                print(f"    {desc[:80]}...")
            update_description(ex_id, desc, args.dry_run)
            stats["ok"] += 1
        else:
            print("FAIL")
            stats["fail"] += 1

        time.sleep(0.3)

    print(f"\n=== Done ===")
    print(f"  Generated: {stats['ok']}")
    print(f"  Failed:    {stats['fail']}")


if __name__ == "__main__":
    main()
