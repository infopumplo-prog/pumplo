#!/usr/bin/env python3
"""Apply translated setup_instructions to DB based on scraped IDs."""
import subprocess, json

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

HIP_THRUST = "Připrav si box nebo lavičku přibližně 45–60 cm vysokou a polštářek pod tyč. Posaď se k boxu a polož tyč na kyčle — sklouzni dolů dokud lopatky nejsou na hraně boxu. Chodidla na šíři ramen, prsty dopředu. Nedávej chodidla příliš dopředu (zkrátí rozsah pohybu) ani příliš dozadu (zapojí více kvadricepsy). Uchop tyč nadhmatem nebo střídavým úchopem — ruce jen stabilizují polohu. Lopatky zatáhni a zapři je do boxu."

LAT_PULLDOWN = "Nastav stehňový polštář na výšku, která ti umožní zasunout nohy pod něj úplně, ale přitom tě drží pevně na sedadle. Uchop tyč nadhmatem těsně za zahnutou část — můžeš použít úchop s palcem nebo bez. Pevně se drž tyče, sedni přímo dolů a zasuň nohy pod polštář."

PULL_UP = "Uchop tyč nadhmatem hluboko do dlaně. Pokud tě bolí zápěstí, zkus úchop bez palce — dá zápěstím více volnosti. Pokud stojíš na stupínku, sestup a na okamžik zůstaň ve visu — zabrání přílišnému houpání. Stáhni lopatky dolů, čímž zapojíš latissimus dorsi. Před prvním opakováním se ujisti, že máš lokty plně nataženy. Nohy: mírně nakloň dopředu, tlač kyčle dozadu a natoč špičky dolů — zpevní břicho a zlepší stabilitu."

CHIN_UP = "Uchop tyč podhmatem hluboko do dlaně. Pokud stojíš na stupínku, sestup a na okamžik zůstaň ve visu — zabrání přílišnému houpání. Stáhni lopatky dolů, čímž zapojíš latissimus dorsi. Před prvním opakováním se ujisti, že máš lokty plně nataženy. Nohy: mírně nakloň dopředu, tlač kyčle dozadu a natoč špičky dolů — zpevní břicho a zlepší stabilitu."

RDL = "Postav se na šíři ramen, prsty dopředu. Nadhmat i střídavý úchop jsou v pořádku — u střídavého existuje malé riziko natažení bicepsu. Vyhni se krčení ramen — jde o pohyb zadního řetězce, nikoli trapézů."

OVERHEAD_PRESS = "Nastav háčky ve stojanu těsně pod úroveň ramen — nemusíš vstávat na špičky. Uchop tyč na šíři ramen nebo mírně širší, tyč drž hluboko v dlani (jinak se zápěstí prohnou a způsobí bolest). Tlač lokty pod tyč na úroveň klíčních kostí. Mírně pokrč kolena a vytáhni tyč ze stojanu. Ustup dva kroky zpět."

DB_SHOULDER_PRESS = "Vezmi dvě jednoručky a posaď se na nakloněnou nebo rovnou lavičku. Záda přitiskni celá k opěradlu, lokty rozpaž ven, dlaně dopředu. Jednoručku drž hluboko v dlani, aby zápěstí zůstalo v silné poloze po celou sérii."

SHRUG = "Vezmi dvě jednoručky a stůj vzpřímeně s úzkým postojem. Vystrč hrudník a stáhni lopatky dozadu. Jednoručky drž po stranách těla."

# name → setup text
SETUPS = {
    "Hip thrust na bootybuilderu": HIP_THRUST,
    "Hip thrust s kettlebellem": HIP_THRUST,
    "Hip thrust s pytlem": HIP_THRUST,
    "Hip thrust s volnou zátěží": HIP_THRUST,
    "Hip thrust v rámu": HIP_THRUST,
    "Hip thrust vstoje": HIP_THRUST,
    "Krčení ramen": SHRUG,
    "Krčení ramen s kettlebellem": SHRUG,
    "Kruhové stahování (Panatta)": LAT_PULLDOWN,
    "Přítah nadhmatem": PULL_UP,
    "Přítah nadhmatem v rámu": PULL_UP,
    "Přítah podhmatem": CHIN_UP,
    "Přítah podhmatem v rámu": CHIN_UP,
    "Stahování konverter (Panatta)": LAT_PULLDOWN,
    "Stahování na lat. stroji": LAT_PULLDOWN,
    "Stahování na lat. stroji (Panatta)": LAT_PULLDOWN,
    "Stahování podhmatem": LAT_PULLDOWN,
    "Stahování širokým úchopem": LAT_PULLDOWN,
    "Rumunský mrtvý tah na plošině": RDL,
    "Rumunský mrtvý tah v rámu": RDL,
    "Tlak nad hlavu": OVERHEAD_PRESS,
    "Tlak nad hlavu (Panatta)": OVERHEAD_PRESS,
    "Tlak nad hlavu na stroji (Panatta)": OVERHEAD_PRESS,
    "Tlak nad hlavu s jednoručkami": DB_SHOULDER_PRESS,
    "Tlak nad hlavu v rámu": OVERHEAD_PRESS,
    "Tlak nad hlavu vsedě v rámu": OVERHEAD_PRESS,
    "Vertikální tlak nad hlavu (Panatta)": OVERHEAD_PRESS,
}

def main():
    rows = db_query("SELECT id, name FROM exercises ORDER BY name")
    updated = 0
    for r in rows:
        setup = SETUPS.get(r["name"])
        if not setup:
            continue
        safe = setup.replace("'", "''")
        db_query(f"UPDATE exercises SET setup_instructions='{safe}', updated_at=NOW() WHERE id='{r['id']}'")
        print(f"  ✓ {r['name']}")
        updated += 1
    print(f"\nUpdated: {updated} exercises")

if __name__ == "__main__":
    main()
