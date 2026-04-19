#!/usr/bin/env python3
"""
Scrape exercise descriptions from MuscleWiki and update Supabase database.
Usage: python3 scripts/scrape_exercises.py [--dry-run] [--limit N]
"""

import subprocess
import json
import re
import time
import sys
import argparse

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"
MUSCLEWIKI_BASE = "https://musclewiki.com/exercise"

# Mapping: our exercise name -> MuscleWiki slug(s) to try (in order)
# Slugs verified via firecrawl search against musclewiki.com/exercise/*
EXERCISE_MAP = {
    # Cardio / equipment
    "airbike": ["cardio-assault-bike-arms-only", "cardio-assault-bike"],
    "bike": ["stationary-bike", "cardio-stationary-bike"],
    "orbitrek": None,
    "Rowing": ["cardio-row-erg-rower"],
    "Run": None,
    "sprint": None,
    "stairs walk": None,
    "Walk": None,
    "stationary bike": ["stationary-bike", "cardio-stationary-bike"],
    "stepper": None,

    # Stretches - skip
    "Calf stretch": None,
    "Gluteus Stretch": None,
    "Hamstring Stretch": None,
    "Neck Stretch": None,
    "Pelvis Flexors Stretch": None,
    "frontsupport to downward dog": None,

    # Bodyweight / compound
    "pullup": ["pull-ups"],
    "chinup": ["chin-ups"],
    "Dips": ["parralel-bar-dips", "bench-dips"],
    "Dips with assisted bands": ["machine-assisted-dip", "bodyweight-box-assisted-dips"],
    "Assisted dips": ["machine-assisted-dip", "bodyweight-box-assisted-dips"],
    "assisted machine pullup": ["machine-assisted-pull-up", "bodyweight-assisted-pull-up"],
    "band assisted pullup": ["machine-assisted-pull-up", "bodyweight-assisted-pull-up"],
    "squat": ["barbell-squat"],
    "lunges with bag": ["barbell-forward-lunge"],
    "kickback": ["cable-standing-glute-kickback"],
    "knee raises": ["hanging-knee-raises"],
    "toes to bar": ["hanging-knee-raises"],
    "Deadbug": ["dead-bug"],
    "Scapula": ["scapular-retraction"],
    "wall ball": ["wall-ball"],
    "tire flip": None,
    "sled push": None,
    "sled pull": None,
    "sissi squat": ["machine-sissy-squat"],
    "powersquat": ["machine-hack-squat"],
    "pullover": ["dumbbell-pullover"],
    "Windmill": ["windmill"],
    "Y raise": ["band-shoulder-y-raise"],
    "Shoulder Shrugs": ["dumbbell-shrug"],
    "shoulder press": ["barbell-overhead-press", "dumbbell-overhead-press"],
    "box step ups": ["step-up-knee-drive"],
    "hip abduction": ["machine-hip-abduction"],
    "pendlay row": ["barbell-bent-over-row"],
    "reverse flyes": ["dumbbell-rear-delt-fly"],
    "reverse cable flyes": ["cable-high-reverse-fly"],
    "seated cable rows": ["machine-seated-cable-row"],

    # Hanging / deadhang
    "deadhang eg raise": ["hanging-knee-raises"],
    "deadhang knee raise": ["hanging-knee-raises"],
    "deadhang leg raise": ["hanging-knee-raises"],
    "hanging knee raise": ["hanging-knee-raises"],

    # Platform / barbell
    "platform deadlift": ["barbell-deadlift"],
    "platform Romanian deadlift": ["barbell-romanian-deadlift"],
    "platform trapbar deadlift": ["barbell-deadlift"],
    "incline bench press": ["barbell-incline-bench-press"],
    "bench sit ups": None,

    # Leg machine
    "Leg extension": ["machine-leg-extension"],
    "leg press": ["machine-leg-press"],
    "Leg press": ["machine-leg-press"],
    "unilateral leg extension": ["machine-leg-extension"],
    "unilateral hamstring curls": ["machine-hamstring-curl"],
    "hamstring curls": ["machine-hamstring-curl", "machine-seated-hamstring-curl"],
    "Leverage latpulldown": ["machine-pulldown"],
    "lat machine": ["machine-pulldown"],
    "widegrip lat pulldown": ["machine-pulldown"],
    "underhand lat pulldown": ["machine-pulldown"],

    # Cable
    "cable chest flyes": ["cable-pec-fly", "cable-bench-chest-fly"],
    "cable kickback": ["cable-standing-glute-kickback"],
    "standing cable triceps extension behind the head": ["cable-rope-overhead-tricep-extension", "cable-single-arm-overhead-tricep-extension"],
    "Unilateral cable front raises": ["cable-rope-front-raise"],
    "unilateral cable lateral raises": ["cable-low-single-arm-lateral-raise"],
    "unilateral triceps extension": ["cable-rope-pushdown"],
    "triceps extension unilateral": ["cable-rope-pushdown"],

    # EZ bar
    "biceps curls EZ bar": ["ez-bar-curl"],
    "skull crush with EZ bar": ["barbell-skullcrusher"],
    "triceps extension EZ bar": ["barbell-skullcrusher"],
    "triceps extension with EZ bar": ["barbell-skullcrusher"],
    "standing biceps curl with EZ bar": ["ez-bar-curl"],

    # Dumbbell (DB.)
    "DB. backward raises": ["dumbbell-lateral-raise"],
    "DB. lunges": ["dumbbell-forward-lunge"],
    "DB. Pull": ["dumbbell-single-arm-row"],
    "DB. Shoulder Press": ["dumbbell-seated-overhead-press"],
    "DB. skull crush": ["dumbbell-decline-skullcrusher"],
    "DB. triceps extension behind the head": ["dumbbell-overhead-tricep-extension"],
    "DB. unilateral hip thrust": ["barbell-single-leg-hip-thrust"],
    "DB. unilateral Romanian deadlift": ["dumbbell-romanian-deadlift"],
    "Hammer biceps curl": ["dumbbell-hammer-curl"],
    "unilateral DB. Pull": ["dumbbell-single-arm-row"],

    # Free weight / hip thrust
    "free weight hip thrust": ["barbell-hip-thrust"],
    "hip thrust with bag": ["barbell-hip-thrust"],
    "standing hip thrust": ["barbell-hip-thrust"],

    # Half rack (= standard barbell exercises)
    "half rack band over rows": ["barbell-bent-over-row"],
    "half rack bench press": ["barbell-bench-press"],
    "half rack chin up": ["chin-ups"],
    "half rack hip thrust": ["barbell-hip-thrust"],
    "half rack incline bench press": ["barbell-incline-bench-press"],
    "half rack lunges": ["barbell-forward-lunge"],
    "half rack pull up": ["pull-ups"],
    "half rack Romanian deadlift": ["barbell-romanian-deadlift"],
    "half rack seated shoulder press ": ["barbell-overhead-press"],
    "half rack squat": ["barbell-squat"],
    "half rack strict press": ["barbell-overhead-press"],

    # Kettlebell
    "Kettlebell bench row": ["kettlebell-single-arm-row"],
    "Kettlebell bend over rows": ["dumbbell-row-bilateral"],
    "Kettlebell biceps curl": ["kettlebell-curl"],
    "Kettlebell biceps hammer curl": ["kettlebell-curl"],
    "Kettlebell bottom up shoulder press": ["kettlebell-bottoms-up-overhead-press"],
    "Kettlebell Bulgarian split squat": ["kettlebell-bulgarian-split-squat", "dumbbell-bulgarian-split-squat"],
    "Kettlebell front raise": ["kettlebell-front-raise"],
    "Kettlebell goblet squat": ["kettlebell-goblet-squat"],
    "Kettlebell hip thrust": ["barbell-hip-thrust"],
    "Kettlebell incline press": ["kettlebell-floor-press"],
    "Kettlebell lateral raise": ["dumbbell-lateral-raise"],
    "Kettlebell lunges": ["dumbbell-forward-lunge"],
    "Kettlebell press": ["kettlebell-seated-overhead-press"],
    "Kettlebell Romanian deadlift": ["kettlebell-romanian-deadlift"],
    "Kettlebell shoulder press": ["kettlebell-seated-overhead-press"],
    "Kettlebell shoulder shrugs": ["dumbbell-shrug"],
    "Kettlebell skull crush": ["dumbbell-decline-skullcrusher"],
    "Kettlebell standing shoulder press": ["kettlebell-seated-overhead-press"],
    "Kettlebell tricep kickback": ["dumbbell-tricep-kickback"],
    "Kettlebell triceps extension overhead": ["dumbbell-overhead-tricep-extension"],
    "Kettlebell triceps extension unilateral": ["dumbbell-overhead-tricep-extension"],
    "Kettlebell Turkish get up": None,
    "Kettlebell unilateral hip thrust": ["barbell-single-leg-hip-thrust"],
    "Kettlebell unilateral pull": ["dumbbell-single-arm-row"],
    "Kettlebell unilateral Romanian deadlift": ["dumbbell-romanian-deadlift"],
    "Kettlebell windmill": ["kettlebell-windmill"],

    # Smith machine
    "Smith machine bench press": ["smith-machine-bench-press"],
    "Smith machine bendover rows": ["barbell-bent-over-row"],
    "Smith machine hip thrust": ["smith-machine-hip-thrust"],
    "Smith machine incline bench press": ["smith-machine-incline-bench-press"],
    "Smith machine lunges": ["smith-machine-reverse-lunge"],
    "Smith machine Romanian deadlift": ["smith-machine-romanian-deadlift"],
    "Smith machine shoulder press seated": ["smith-machine-seated-overhead-press"],
    "Smith machine squat": ["smith-machine-squat"],

    # Landmine
    "landmine bandover row": ["barbell-bent-over-row"],

    # Panatta machines -> generic equivalents
    "Panatta 45° legpress": ["machine-leg-press"],
    "Panatta circular pulldown": ["machine-pulldown"],
    "Panatta decline chestpress": ["machine-plate-loaded-decline-chest-press"],
    "Panatta horizontal legpress": ["machine-horizontal-leg-press"],
    "Panatta incline chest press": ["machine-plate-loaded-incline-chest-press"],
    "Panatta incline chestpress selection": ["machine-plate-loaded-incline-chest-press"],
    "Panatta lat pulldown": ["machine-pulldown"],
    "Panatta lat pulldown converter": ["machine-pulldown"],
    "Panatta lat pulldown machine": ["machine-pulldown"],
    "Panatta lateral raises machine": ["dumbbell-lateral-raise"],
    "Panatta leg extension": ["machine-leg-extension"],
    "Panatta low row": ["machine-seated-cable-row"],
    "Panatta overheadpress": ["barbell-overhead-press"],
    "Panatta peckdeck chest flyes": ["machine-pec-fly"],
    "Panatta pectoral machine": ["machine-pec-fly"],
    "Panatta rotatory torso": ["cable-high-reverse-fly"],
    "Panatta rowing machine": ["machine-seated-cable-row"],
    "Panatta rowing machine ": ["machine-seated-cable-row"],
    "Panatta shoulder press": ["barbell-overhead-press"],
    "Panatta super pendulum squat": ["machine-hack-squat"],
    "Panatta super pendulum squat front position": ["machine-hack-squat"],
    "Panatta triceps press machine": ["cable-rope-pushdown"],
    "Panatta vertical chestpress": ["machine-chest-press"],
    "Panatta vertical shoulder press": ["barbell-overhead-press"],

    # Bootybuilder
    "bootybuilder hip extension": ["glute-ham-raise"],
    "bootybuilder hip thrust": ["barbell-hip-thrust"],

    # Misc
    "one leg Romanian deadlift on slide": ["dumbbell-romanian-deadlift"],
    "Vertical chestpress machine": ["machine-chest-press"],
    "belt squat": ["belt-squat"],
}


def db_query(sql: str) -> list:
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", SUPABASE_URL,
         "-H", f"Authorization: Bearer {SUPABASE_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": sql})],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)


def scrape_musclewiki(slug: str):
    """Scrape a MuscleWiki exercise page and return numbered steps as description."""
    url = f"{MUSCLEWIKI_BASE}/{slug}"
    result = subprocess.run(
        ["firecrawl", "scrape", url, "--only-main-content"],
        capture_output=True, text=True
    )
    content = result.stdout
    if "Page not Found" in content or "404" in content:
        return None

    # Extract numbered steps: lines starting with digit followed by capital letter or text
    lines = content.split("\n")
    steps = []
    for line in lines:
        line = line.strip()
        m = re.match(r'^([1-9])([\w\s].*)', line)
        if m and len(line) > 5:
            step_num = m.group(1)
            step_text = m.group(2).strip()
            if len(step_text) > 10:
                steps.append(f"{step_num}. {step_text}")

    if steps:
        return "\n".join(steps[:6])  # max 6 steps
    return None


def update_description(exercise_id: str, description: str, dry_run: bool) -> bool:
    safe = description.replace("'", "''")
    sql = f"UPDATE exercises SET description = '{safe}', updated_at = NOW() WHERE id = '{exercise_id}'"
    if dry_run:
        print(f"  [DRY RUN] Would update: {sql[:80]}...")
        return True
    result = db_query(sql)
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of exercises to process")
    args = parser.parse_args()

    # Fetch all exercises without descriptions
    exercises = db_query(
        "SELECT id, name FROM exercises WHERE description IS NULL OR trim(description) = '' ORDER BY name"
    )
    print(f"Found {len(exercises)} exercises without descriptions\n")

    if args.limit:
        exercises = exercises[:args.limit]

    stats = {"found": 0, "not_found": 0, "skipped": 0}

    for ex in exercises:
        name = ex["name"]
        ex_id = ex["id"]

        slugs = EXERCISE_MAP.get(name)

        if slugs is None:
            print(f"  SKIP  {name}")
            stats["skipped"] += 1
            continue

        if not slugs:
            print(f"  SKIP  {name} (no slugs configured)")
            stats["skipped"] += 1
            continue

        description = None
        used_slug = None
        for slug in slugs:
            print(f"  Trying {name} → {slug}...", end=" ", flush=True)
            description = scrape_musclewiki(slug)
            if description:
                used_slug = slug
                break
            print("404", end=" ")
            time.sleep(0.3)

        if description:
            print(f"✓ ({len(description)} chars)")
            update_description(ex_id, description, args.dry_run)
            stats["found"] += 1
        else:
            print("NOT FOUND")
            stats["not_found"] += 1

        time.sleep(0.5)  # be nice to MuscleWiki

    print(f"\n=== Results ===")
    print(f"  Found & updated: {stats['found']}")
    print(f"  Not found:       {stats['not_found']}")
    print(f"  Skipped:         {stats['skipped']}")


if __name__ == "__main__":
    main()
