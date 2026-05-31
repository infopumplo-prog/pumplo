#!/usr/bin/env python3
"""
Scrape full MuscleWiki content (steps + setup) for 27 exercises.
Outputs JSON for manual translation.
"""
import subprocess, json, re, time

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"

# Czech name → MuscleWiki slug(s)
SLUG_MAP = {
    "Bench press":                          ["barbell-bench-press"],
    "Bicepsový zdvih":                      ["dumbbell-curl", "barbell-curl"],
    "Bicepsový zdvih na kabelu":            ["cable-bicep-curl", "cable-curl"],
    "Bulharský dřep s jednoručkami":        ["dumbbell-bulgarian-split-squat", "kettlebell-bulgarian-split-squat"],
    "Curling stroj (Panatta)":              ["machine-preacher-curl", "machine-bicep-curl"],
    "Goblet dřep s jednoručkou":            ["dumbbell-goblet-squat", "kettlebell-goblet-squat"],
    "Hip thrust s jednoručkou":             ["dumbbell-hip-thrust", "barbell-hip-thrust"],
    "Hyperextenze":                         ["back-extension", "barbell-good-morning"],
    "Hyperextenze hýždí":                   ["back-extension", "glute-ham-raise"],
    "Kladivový zdvih":                      ["dumbbell-hammer-curl"],
    "Předpažení s jednoručkami":            ["dumbbell-front-raise"],
    "Přítah":                               ["dumbbell-single-arm-row", "cable-seated-row"],
    "Přítah kolen k hrudníku":              ["crunch", "lying-crunch"],
    "Přítah v předklonu s jednoručkami":    ["dumbbell-row-bilateral", "dumbbell-single-arm-row"],
    "Rovnováha na jedné noze":              ["single-leg-romanian-deadlift"],
    "Rozpažení s jednoručkami":             ["dumbbell-fly", "dumbbell-chest-fly"],
    "Rumunský mrtvý tah na bootybuilder pásu": ["barbell-romanian-deadlift"],
    "Rumunský mrtvý tah s jednoručkami":    ["dumbbell-romanian-deadlift"],
    "Šikmý tlak s jednoručkami":            ["dumbbell-incline-press", "dumbbell-incline-bench-press"],
    "Sklapovačky na lavičce":               ["crunch", "decline-crunch"],
    "Stojatý multidřep (Panatta)":          ["smith-machine-squat"],
    "Super curl stroj (Panatta)":           ["machine-preacher-curl"],
    "Tlak s jednoručkami":                  ["dumbbell-bench-press", "dumbbell-chest-press"],
    "Únos":                                 ["machine-hip-abduction", "cable-standing-hip-abduction"],
    "Výskok na box":                        ["box-jump"],
    "Zdvih lýtek vsedě (Panatta)":          ["machine-seated-calf-raise", "seated-calf-raise"],
    "Zdvih lýtek vstoje (Panatta)":         ["machine-calf-raise", "standing-calf-raise"],
}


def db_query(sql):
    r = subprocess.run(
        ["curl", "-s", "-X", "POST", SUPABASE_URL,
         "-H", f"Authorization: Bearer {SUPABASE_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": sql})],
        capture_output=True, text=True
    )
    return json.loads(r.stdout)


def scrape_full(slug):
    url = f"https://musclewiki.com/exercise/{slug}"
    r = subprocess.run(
        ["firecrawl", "scrape", url, "--only-main-content"],
        capture_output=True, text=True
    )
    content = r.stdout
    if "Page not Found" in content or "404" in content or len(content) < 200:
        return None

    # Extract numbered steps
    steps = []
    for line in content.split("\n"):
        line = line.strip()
        m = re.match(r'^([1-9])([\w\s].*)', line)
        if m and len(line) > 8:
            steps.append(f"{m.group(1)}. {m.group(2).strip()}")
    steps = steps[:6]

    # Extract Setup section
    setup_match = re.search(r'\*\*Setup\*\*(.*?)(?:\*\*Performing|\Z)', content, re.DOTALL)
    setup_text = ""
    if setup_match:
        raw = setup_match.group(1).strip()
        # Remove numbered list items (those are setup steps, keep prose)
        lines = [l.strip() for l in raw.split("\n") if l.strip() and not re.match(r'^\d+\.', l.strip())]
        # Remove markdown links and image refs
        lines = [l for l in lines if not l.startswith("[") and not l.startswith("!")]
        setup_text = " ".join(lines[:6])  # max ~6 sentences

    # Extract Performing section
    perf_match = re.search(r'\*\*Performing[^*]*\*\*(.*?)(?:\n\n\[|\Z)', content, re.DOTALL)
    perf_text = ""
    if perf_match:
        raw = perf_match.group(1).strip()
        lines = [l.strip() for l in raw.split("\n") if l.strip() and not l.startswith("[") and not l.startswith("!")]
        perf_text = " ".join(lines[:4])

    return {
        "steps": "\n".join(steps) if steps else None,
        "setup": setup_text or None,
        "performing": perf_text or None,
    }


def main():
    # Get IDs from DB
    rows = db_query("SELECT id, name FROM exercises ORDER BY name")
    id_map = {}
    for r in rows:
        id_map.setdefault(r["name"], []).append(r["id"])

    results = []
    for czech_name, slugs in SLUG_MAP.items():
        ids = id_map.get(czech_name, [])
        if not ids:
            print(f"  NOT IN DB: {czech_name}")
            continue

        scraped = None
        used_slug = None
        for slug in slugs:
            print(f"  {czech_name} → {slug}...", end=" ", flush=True)
            scraped = scrape_full(slug)
            if scraped and scraped["steps"]:
                used_slug = slug
                print("✓")
                break
            print("miss")
            time.sleep(0.3)

        if scraped and scraped["steps"]:
            for ex_id in ids:
                results.append({
                    "id": ex_id,
                    "name": czech_name,
                    "slug": used_slug,
                    "steps": scraped["steps"],
                    "setup": scraped["setup"],
                    "performing": scraped["performing"],
                })
        else:
            print(f"  FAILED: {czech_name}")

        time.sleep(0.5)

    with open("/tmp/scraped_27.json", "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved {len(results)} records to /tmp/scraped_27.json")


if __name__ == "__main__":
    main()
