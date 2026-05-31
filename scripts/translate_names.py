#!/usr/bin/env python3
"""
Translate exercise and machine names to Czech and update Supabase.
Usage: python3 scripts/translate_names.py [--dry-run]
"""

import subprocess, json, argparse

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"

def db_query(sql):
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", SUPABASE_URL,
         "-H", f"Authorization: Bearer {SUPABASE_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": sql})],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

# exercise name -> Czech name
EXERCISE_NAMES = {
    "90/90": "90/90",
    "abduction": "Únos",
    "adduction": "Přítah",
    "airbike": "Air bike",
    "Assisted dips": "Dips s dopomocí",
    "assisted machine pullup": "Přítah na stroji s dopomocí",
    "Baby Position": "Dětská pozice",
    "band assisted pullup": "Přítah s dopomocí gumy",
    "Bear Crawl": "Medvědí chůze",
    "Bear Hold": "Medvědí plank",
    "belt squat": "Dřep s opaskem",
    "bench press": "Bench press",
    "bench sit ups": "Sklapovačky na lavičce",
    "Biceps Curl": "Bicepsový zdvih",
    "biceps curls EZ bar": "Bicepsový zdvih EZ tyčí",
    "Biceps Hammer Curl": "Kladivový zdvih",
    "bike": "Kolo",
    "bootybuilder belt squat Romanian deadlift": "Rumunský mrtvý tah na bootybuilder pásu",
    "bootybuilder hip extension": "Hyperextenze kyčlí na bootybuilderu",
    "bootybuilder hip thrust": "Hip thrust na bootybuilderu",
    "box jump": "Výskok na box",
    "box step ups": "Výstup na box",
    "Cable Biceps Curl": "Bicepsový zdvih na kabelu",
    "cable chest flyes": "Rozpažení na kabelu",
    "cable kickback": "Kickback na kabelu",
    "Calf stretch": "Protažení lýtek",
    "Chest Stretch": "Protažení hrudníku",
    "chinup": "Přítah podhmatem",
    "cross-country skis": "Běžky",
    "crunches": "Přítah kolen k hrudníku",
    "DB. backward raises": "Upažení vzad s jednoručkami",
    "DB. bend over rows": "Přítah v předklonu s jednoručkami",
    "DB. bulgarian split quat": "Bulharský dřep s jednoručkami",
    "DB. chest flys": "Rozpažení s jednoručkami",
    "DB. front raise": "Předpažení s jednoručkami",
    "DB. goblet squat": "Goblet dřep s jednoručkou",
    "DB. hip thrust": "Hip thrust s jednoručkou",
    "DB. Incline Press": "Šikmý tlak s jednoručkami",
    "DB. lunges": "Výpady s jednoručkami",
    "DB. Press": "Tlak s jednoručkami",
    "DB. Pull": "Přítah jednoručkou",
    "DB. Romanian deadlift": "Rumunský mrtvý tah s jednoručkami",
    "DB. Shoulder Press": "Tlak nad hlavu s jednoručkami",
    "DB. skull crush": "Skull crusher s jednoručkami",
    "DB. triceps extension behind the head": "Tricepsové natažení za hlavou s jednoručkou",
    "DB. unilateral hip thrust": "Jednostranný hip thrust s jednoručkou",
    "DB. unilateral Romanian deadlift": "Jednostranný rumunský mrtvý tah s jednoručkou",
    "Deadbug": "Mrtvý brouk",
    "deadhang eg raise": "Zdvih nohou ve visu",
    "deadhang knee raise": "Zdvih kolen ve visu",
    "deadhang leg raise": "Zdvih nohou ve visu",
    "Dips": "Dips",
    "Dips with assisted bands": "Dips s dopomocí gumy",
    "free weight hip thrust": "Hip thrust s volnou zátěží",
    "frontsupport to downward dog": "Plank do downward dog",
    "glute hyperextension": "Hyperextenze hýždí",
    "Gluteus Stretch": "Protažení hýždí",
    "half rack band over rows": "Přítah v předklonu s gumou",
    "half rack bench press": "Bench press v rámu",
    "half rack chin up": "Přítah podhmatem v rámu",
    "half rack hip thrust": "Hip thrust v rámu",
    "half rack incline bench press": "Šikmý bench press v rámu",
    "half rack lunges": "Výpady v rámu",
    "half rack pull up": "Přítah nadhmatem v rámu",
    "half rack Romanian deadlift": "Rumunský mrtvý tah v rámu",
    "half rack seated shoulder press ": "Tlak nad hlavu vsedě v rámu",
    "half rack squat": "Dřep v rámu",
    "half rack strict press": "Tlak nad hlavu v rámu",
    "Hammer biceps curl": "Kladivový zdvih",
    "hamstring curls": "Leg curl",
    "Hamstring Stretch": "Protažení zadní strany stehna",
    "hanging knee raise": "Zdvih kolen ve visu",
    "hip abduction": "Únos kyčle",
    "hip thrust with bag": "Hip thrust s pytlem",
    "hyperextension": "Hyperextenze",
    "incline bench press": "Šikmý bench press",
    "Kettlebell bench row": "Přítah na lavičce s kettlebellem",
    "Kettlebell bend over rows": "Přítah v předklonu s kettlebellem",
    "Kettlebell biceps curl": "Bicepsový zdvih s kettlebellem",
    "Kettlebell biceps hammer curl": "Kladivový zdvih s kettlebellem",
    "Kettlebell bottom up shoulder press": "Tlak s kettlebellem dnem nahoru",
    "Kettlebell Bulgarian split squat": "Bulharský dřep s kettlebellem",
    "Kettlebell front raise": "Předpažení s kettlebellem",
    "Kettlebell goblet squat": "Goblet dřep s kettlebellem",
    "Kettlebell hip thrust": "Hip thrust s kettlebellem",
    "Kettlebell incline press": "Tlak s kettlebellem na šikmé lavici",
    "Kettlebell lateral raise": "Upažení s kettlebellem",
    "Kettlebell lunges": "Výpady s kettlebellem",
    "Kettlebell press": "Tlak s kettlebellem nad hlavu",
    "Kettlebell Romanian deadlift": "Rumunský mrtvý tah s kettlebellem",
    "Kettlebell shoulder press": "Tlak s kettlebellem nad hlavu",
    "Kettlebell shoulder shrugs": "Krčení ramen s kettlebellem",
    "Kettlebell skull crush": "Skull crusher s kettlebellem",
    "Kettlebell standing shoulder press": "Tlak s kettlebellem nad hlavu vstoje",
    "Kettlebell tricep kickback": "Tricepsový kickback s kettlebellem",
    "Kettlebell triceps extension overhead": "Tricepsové natažení nad hlavou s kettlebellem",
    "Kettlebell triceps extension unilateral": "Jednostranné tricepsové natažení s kettlebellem",
    "Kettlebell Turkish get up": "Turkish get-up s kettlebellem",
    "Kettlebell unilateral hip thrust": "Jednostranný hip thrust s kettlebellem",
    "Kettlebell unilateral pull": "Jednostranný přítah s kettlebellem",
    "Kettlebell unilateral Romanian deadlift": "Jednostranný rumunský mrtvý tah s kettlebellem",
    "Kettlebell windmill": "Větrný mlýn s kettlebellem",
    "kickback": "Kickback",
    "knee raises": "Zdvih kolen",
    "landmine bandover row": "Přítah v předklonu s landminem",
    "lat machine": "Stahování na lat. stroji",
    "Leg extension": "Extenze nohou",
    "leg press": "Leg press",
    "Leg press": "Leg press",
    "Leverage latpulldown": "Stahování na lat. stroji",
    "lunges with bag": "Výpady s pytlem",
    "Neck Stretch": "Protažení krku",
    "One foot balanc": "Rovnováha na jedné noze",
    "one leg Romanian deadlift on slide": "Jednostranný rumunský mrtvý tah na klouzačce",
    "orbitrek": "Orbitrek",
    "Panatta 45° legpress": "Leg press 45° (Panatta)",
    "Panatta circular pulldown": "Kruhové stahování (Panatta)",
    "panatta curling machine": "Curling stroj (Panatta)",
    "Panatta decline chestpress": "Tlak na prsa dolů (Panatta)",
    "Panatta horizontal legpress": "Horizontální leg press (Panatta)",
    "Panatta incline chest press": "Šikmý tlak na prsa (Panatta)",
    "Panatta incline chestpress selection": "Šikmý tlak na prsa výběr (Panatta)",
    "Panatta lat pulldown": "Stahování na lat. stroji (Panatta)",
    "Panatta lat pulldown converter": "Stahování konverter (Panatta)",
    "Panatta lat pulldown machine": "Stahování na lat. stroji (Panatta)",
    "Panatta lateral raises machine": "Upažení na stroji (Panatta)",
    "Panatta leg extension": "Extenze nohou (Panatta)",
    "Panatta low row": "Přítah spodní kladky (Panatta)",
    "Panatta overheadpress": "Tlak nad hlavu (Panatta)",
    "Panatta peckdeck chest flyes": "Peck deck (Panatta)",
    "Panatta pectoral machine": "Pektorální stroj (Panatta)",
    "Panatta rotatory torso": "Rotace trupu (Panatta)",
    "Panatta rowing machine": "Veslování (Panatta)",
    "Panatta rowing machine ": "Veslování (Panatta)",
    "Panatta seated calf raise": "Zdvih lýtek vsedě (Panatta)",
    "Panatta shoulder press": "Tlak nad hlavu na stroji (Panatta)",
    "Panatta standing calf raises": "Zdvih lýtek vstoje (Panatta)",
    "panatta standing multisquat": "Stojatý multidřep (Panatta)",
    "panatta super curl machine": "Super curl stroj (Panatta)",
    "Panatta super pendulum squat": "Super pendulový dřep (Panatta)",
    "Panatta super pendulum squat front position": "Super pendulový dřep vpředu (Panatta)",
    "Panatta triceps press machine": "Tricepsový stroj (Panatta)",
    "Panatta vertical chestpress": "Vertikální tlak na prsa (Panatta)",
    "Panatta vertical shoulder press": "Vertikální tlak nad hlavu (Panatta)",
    "Pelvis Flexors Stretch": "Protažení flexorů kyčle",
    "pendlay row": "Pendlay row",
    "platform deadlift": "Mrtvý tah na plošině",
    "platform Romanian deadlift": "Rumunský mrtvý tah na plošině",
    "platform trapbar deadlift": "Mrtvý tah trapbarem na plošině",
    "powersquat": "Powersquat",
    "pullover": "Pullover",
    "pullup": "Přítah nadhmatem",
    "reverse cable flyes": "Zpětné rozpažení na kabelu",
    "reverse flyes": "Zpětné rozpažení",
    "Rowing": "Veslování",
    "Run": "Běh",
    "Scapula": "Lopatka",
    "seated cable rows": "Přítah na kabelu vsedě",
    "shoulder press": "Tlak nad hlavu",
    "Shoulder Shrugs": "Krčení ramen",
    "sissi squat": "Sissy dřep",
    "skull crush with EZ bar": "Skull crusher s EZ tyčí",
    "sled pull": "Tah saní",
    "sled push": "Tlak saní",
    "Smith machine bench press": "Bench press na Smith stroji",
    "Smith machine bendover rows": "Přítah v předklonu na Smith stroji",
    "Smith machine hip thrust": "Hip thrust na Smith stroji",
    "Smith machine incline bench press": "Šikmý bench press na Smith stroji",
    "Smith machine lunges": "Výpady na Smith stroji",
    "Smith machine Romanian deadlift": "Rumunský mrtvý tah na Smith stroji",
    "Smith machine shoulder press seated": "Tlak nad hlavu vsedě na Smith stroji",
    "Smith machine squat": "Dřep na Smith stroji",
    "sprint": "Sprint",
    "squat": "Dřep",
    "stairs walk": "Chůze po schodech",
    "standing biceps curl with EZ bar": "Bicepsový zdvih EZ tyčí vstoje",
    "standing cable triceps extension behind the head": "Tricepsové natažení nad hlavou na kabelu",
    "standing hip thrust": "Hip thrust vstoje",
    "stationary bike": "Stacionární kolo",
    "stepper": "Stepper",
    "tire flip": "Překlopení pneumatiky",
    "toes to bar": "Nožky k tyči",
    "triceps extension EZ bar": "Tricepsové natažení s EZ tyčí",
    "triceps extension unilateral": "Jednostranné tricepsové natažení",
    "triceps extension with EZ bar": "Tricepsové natažení s EZ tyčí",
    "underhand lat pulldown": "Stahování podhmatem",
    "Unilateral cable front raises": "Jednostranné předpažení na kabelu",
    "unilateral cable lateral raises": "Jednostranné upažení na kabelu",
    "unilateral DB. Pull": "Jednostranný přítah s jednoručkou",
    "unilateral hamstring curls": "Jednostranný leg curl",
    "unilateral leg extension": "Jednostranná extenze nohou",
    "unilateral triceps extension": "Jednostranné tricepsové natažení",
    "Vertical chestpress machine": "Vertikální tlak na prsa na stroji",
    "Walk": "Chůze",
    "wall ball": "Wall ball",
    "widegrip lat pulldown": "Stahování širokým úchopem",
    "Windmill": "Větrný mlýn",
    "Y raise": "Y zdvih",
}

# machine name -> Czech name
MACHINE_NAMES = {
    "abdominal crunches": "Stroj na břicho",
    "abductor machine": "Únos stroj",
    "adductor machine": "Přítah stroj",
    "air bike ": "Air bike",
    "belt squat": "Pás pro dřep",
    "benchpress": "Bench press",
    "běžecký pás ": "Běžecký pás",
    "biceps machine": "Bicepsový stroj",
    "box": "Box",
    "bradla": "Bradla",
    "calf machine": "Stroj na lýtka",
    "curling machine ": "Curling stroj",
    "deltoid press": "Deltoid press",
    "dips press dual systém": "Dips press dual systém",
    "dumbell": "Jednoručky",
    "ez osy - nakladací": "EZ osy",
    "gluteus machine": "Stroj na hýždě",
    "hack squat": "Hack squat stroj",
    "half rack": "Half rack",
    "hammer stroj ": "Hammer stroj",
    "hamstring curl machine": "Leg curl stroj",
    "high low pulley": "Horní a dolní kladka",
    "high row (68)": "High row",
    "hip trust machine": "Hip thrust stroj",
    "hiptrust": "Hip thrust lavička",
    "horizontal adjustable leg press": "Horizontální leg press",
    "hrazdy": "Hrazdy",
    "hyperextenze (88)": "Hyperextenze",
    "incline bench": "Šikmá lavička",
    "incline chest press (102)": "Šikmý tlak na prsa",
    "incline chest press machine": "Šikmý tlak na prsa stroj",
    "kettlebell": "Kettlebell",
    "kickback": "Kickback stroj",
    "lat machine": "Lat. stroj",
    "lat machine convergent (67)": "Lat. stroj konvergentní",
    "lat pulldown": "Lat pulldown",
    "lat pulldown convergent": "Lat pulldown konvergentní",
    "lateral deltoids": "Deltoid stroj",
    "lavka (86)": "Lavička",
    "leg curling": "Leg curl",
    "leg extension": "Leg extension",
    "leg extension 67": "Leg extension",
    "leg extension unilateral": "Leg extension jednostranný",
    "leg press": "Leg press",
    "leg press 45": "Leg press 45°",
    "loaded back extension": "Hyperextenze se zátěží",
    "orbitrack (80)": "Orbitrek",
    "Panatta mid row": "Panatta mid row",
    "Pás BH (81)": "Běžecký pás BH",
    "peck back": "Peck deck vzad",
    "pectorial machine": "Pektorální stroj",
    "pinnacle trainer (83)": "Pinnacle trenažer",
    "platform": "Plošina",
    "pneumatiky": "Pneumatiky",
    "přítah v předklonu (osa)": "Přítah v předklonu (osa)",
    "pull assist (85)": "Pull assist",
    "pulley row": "Kladka veslování",
    "pullover machine": "Pullover stroj",
    "pytle": "Pytle",
    "rotoped (79)": "Rotoped",
    "rowing machine convergent": "Veslařský stroj konvergentní",
    "sáně": "Saně",
    "schody (84)": "Schody",
    "seated calf": "Lýtka vsedě",
    "sissi squat machine": "Sissy squat stroj",
    "sky (89)": "Trampolína",
    "Smith machine counterbalanced": "Smith stroj vyvážený",
    "standing abductor": "Únos vstoje",
    "standing hip thrust": "Hip thrust vstoje stroj",
    "super incline bench press": "Super šikmý bench press",
    "super lat pulldown circular": "Kruhové stahování",
    "super pendulum squat": "Super pendulový dřep",
    "super power squat": "Super power dřep",
    "super rowing free weight": "Veslování s volnou zátěží",
    "torsion machine": "Rotační stroj",
    "trenažer (78)": "Eliptický trenažer",
    "triceps machine": "Tricepsový stroj",
    "vertical chest press": "Vertikální tlak na prsa",
    "vertical chest press (66)": "Vertikální tlak na prsa",
    "vertical pek dek": "Vertikální pek dek",
    "veslo (90)": "Veslařský stroj",
    "viking press and calfs": "Viking press a lýtka",
    "žebřiny": "Žebřiny",
    "zeď": "Zeď",
}


def run(dry_run: bool):
    # Update exercise names
    exercises = db_query("SELECT id, name FROM exercises ORDER BY name")
    print(f"Exercises: {len(exercises)}")
    ex_updated = 0
    for ex in exercises:
        old = ex["name"]
        new = EXERCISE_NAMES.get(old)
        if new and new != old:
            safe_new = new.replace("'", "''")
            sql = f"UPDATE exercises SET name = '{safe_new}' WHERE id = '{ex['id']}'"
            if dry_run:
                print(f"  EX  '{old}' → '{new}'")
            else:
                db_query(sql)
                print(f"  ✓  '{old}' → '{new}'")
            ex_updated += 1
        elif not new:
            print(f"  --  '{old}' (no translation)")

    # Update machine names
    machines = db_query("SELECT id, name FROM machines ORDER BY name")
    print(f"\nMachines: {len(machines)}")
    m_updated = 0
    for m in machines:
        old = m["name"]
        new = MACHINE_NAMES.get(old)
        if new and new != old:
            safe_new = new.replace("'", "''")
            sql = f"UPDATE machines SET name = '{safe_new}' WHERE id = '{m['id']}'"
            if dry_run:
                print(f"  MC  '{old}' → '{new}'")
            else:
                db_query(sql)
                print(f"  ✓  '{old}' → '{new}'")
            m_updated += 1
        elif not new:
            print(f"  --  '{old}' (no translation)")

    print(f"\n=== Done ===")
    print(f"  Exercises to rename: {ex_updated}")
    print(f"  Machines to rename:  {m_updated}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(args.dry_run)
