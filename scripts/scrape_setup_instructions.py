#!/usr/bin/env python3
"""
Scrape Setup sections from MuscleWiki for exercises missing setup_instructions.
Outputs English content to /tmp/setup_to_translate.json for inline translation.
"""
import subprocess, json, re, time

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"

def db_query(sql):
    r = subprocess.run(
        ["curl","-s","-X","POST",SUPABASE_URL,
         "-H",f"Authorization: Bearer {SUPABASE_TOKEN}",
         "-H","Content-Type: application/json",
         "-d",json.dumps({"query":sql})],
        capture_output=True,text=True
    )
    return json.loads(r.stdout)

def scrape_setup(slug):
    r = subprocess.run(
        ["firecrawl","scrape",f"https://musclewiki.com/exercise/{slug}","--only-main-content"],
        capture_output=True, text=True
    )
    content = r.stdout
    if "Page not Found" in content or len(content) < 200:
        return None
    setup_match = re.search(r'\*\*Setup\*\*(.*?)(?:\*\*Performing|\Z)', content, re.DOTALL)
    if not setup_match:
        return None
    lines = [l.strip() for l in setup_match.group(1).strip().split("\n")
             if l.strip() and not re.match(r'^\d+\.', l.strip())
             and not l.strip().startswith("[") and not l.strip().startswith("!")]
    text = " ".join(lines[:6]).strip()
    return text if len(text) > 30 else None

def main():
    with open("/tmp/czech_slug_map.json") as f:
        slug_map = json.load(f)

    # Exercises needing setup_instructions (have description but no setup)
    rows = db_query(
        "SELECT id, name FROM exercises WHERE (setup_instructions IS NULL OR trim(setup_instructions)='') "
        "AND description IS NOT NULL AND trim(description)!='' ORDER BY name"
    )
    print(f"Exercises needing setup: {len(rows)}\n")

    results = []
    no_slug = []
    no_setup = []

    for ex in rows:
        name = ex["name"]
        slugs = slug_map.get(name)
        if not slugs:
            no_slug.append(name)
            continue

        setup = None
        for slug in slugs:
            print(f"  {name} [{slug}]...", end=" ", flush=True)
            setup = scrape_setup(slug)
            if setup:
                print(f"✓ ({len(setup)} chars)")
                break
            print("no setup")
            time.sleep(0.3)

        if setup:
            results.append({"id": ex["id"], "name": name, "setup_en": setup})
        else:
            no_setup.append(name)

        time.sleep(0.4)

    with open("/tmp/setup_to_translate.json", "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n=== Results ===")
    print(f"  Has setup text:  {len(results)}")
    print(f"  No slug mapped:  {len(no_slug)}")
    print(f"  No setup on MW:  {len(no_setup)}")
    print(f"\nSaved to /tmp/setup_to_translate.json")

if __name__ == "__main__":
    main()
