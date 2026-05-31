#!/usr/bin/env python3
"""Apply Czech translations of MuscleWiki content to DB."""
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

# name → {description (steps), setup_instructions}
TRANSLATIONS = {
    "Bench press": {
        "description": "1. Lehni si na lavičku, chodidla pevně na zemi. S nataženými pažemi vyjmi tyč ze stojanu.\n2. Spusť tyč k středu hrudníku.\n3. Zatlač tyč nahoru dokud nezamkneš lokty.",
        "setup_instructions": None,
    },
    "Bicepsový zdvih": {
        "description": "1. Postav se rovně s jednoručkami podél těla, paže natažené.\n2. Zvedni jednoručku a otoč předloktí dokud není svislé a dlaň míří k rameni.\n3. Vrať do výchozí polohy a opakuj s druhou paží.",
        "setup_instructions": "Vezmi dvě jednoručky a stůj vzpřímeně se stažením lopatek a vystrčeným hrudníkem. Začni s jednoručkami podél těla tak, aby ti to dovolilo plně natáhnout lokty dole. Postav se na šíři ramen nebo mírně užší.",
    },
    "Bicepsový zdvih na kabelu": {
        "description": "1. Použij tyčový nástavec, kladku nastav úplně dolu.\n2. Postav se čelem ke stroji, mírně rozkročit pro stabilitu.\n3. Dlaně míří dopředu. Proveď flexi v loktech a kontrolovaně natáhni zpět.",
        "setup_instructions": None,
    },
    "Bulharský dřep s jednoručkami": {
        "description": "1. Najdi box nebo lavičku přibližně do výše kolen nebo mírně níže.\n2. Polož prsty nebo nárt zadní nohy na box. Přední chodidlo natoč dopředu nebo mírně ven, prolomením kolen a kyčlí sestupuj dolů.\n3. Cílem je dostat přední stehno do rovnoběžné polohy se zemí nebo níže.\n4. Čím dál dopředu je přední noha, tím delší rozsah pohybu v kyčlích. Čím dál dozadu, tím více pracují kolena.",
        "setup_instructions": None,
    },
    "Curling stroj (Panatta)": {
        "description": "1. Nastav sedadlo na svou výšku a polož lokty celé na opěrku.\n2. Uchop madla a proveď flexi loktů — biceps přitlač k předloktí.\n3. Kontrolovaně spusť zpět do výchozí polohy.",
        "setup_instructions": None,
    },
    "Goblet dřep s jednoručkou": {
        "description": "1. Drž jednoručku přitisknutou k hornímu hrudníku, lokty dovnitř. Chodidla mírně širší než šíře ramen.\n2. Klesej do dřepu, lokty drž uvnitř trajektorie kolen.\n3. Tlač přes paty zpět nahoru, hrudník vzpřímený, vrať se do výchozí polohy.",
        "setup_instructions": None,
    },
    "Hip thrust s jednoručkou": {
        "description": "1. Opři lopatky o box nebo lavičku, která se nepohybuje.\n2. Obě chodidla pevně na zemi, paty se nezvedají. Prsty míří dopředu.\n3. Prolomení v kyčlích — hledej co nejdelší rozsah pohybu. Tlač kyčle co nejvýše na každém opakování.",
        "setup_instructions": None,
    },
    "Hyperextenze hýždí": {
        "description": "1. Polohuj se na stroji glute-ham raise nebo na vhodné náhradě (lavička, stabilizační míč).\n2. Nastav výšku opěrky nohou a pevně ukotvuj chodidla.\n3. Pomalu spouštěj horní část těla směrem k zemi, trup a nohy v jedné linii.\n4. Na nejnižším bodě (tělo rovnoběžně se zemí) se krátce zastav.\n5. Zapoj hýždě a zadní stranu stehna a tlač zpět do výchozí polohy.",
        "setup_instructions": None,
    },
    "Hyperextenze": {
        "description": "1. Sedni na stroj a polož horní záda na kolébající se opěrku.\n2. Extenzi prováděj v kyčlích a bedrech. Dbej na to, abys nepřehýbal páteř.",
        "setup_instructions": None,
    },
    "Kladivový zdvih": {
        "description": "1. Drž jednoručky neutrálním úchopem — palce směřují ke stropu.\n2. Pomalu zvedni jednoručky do výšky hrudníku.\n3. Vrať kontrolovaně do výchozí polohy a opakuj.",
        "setup_instructions": None,
    },
    "Předpažení s jednoručkami": {
        "description": "1. Stůj vzpřímeně s jednoručkami podél těla.\n2. Zvedni obě jednoručky s plně nataženými lokty do úrovně očí.\n3. Spusť zátěže kontrolovaně zpět do výchozí polohy.",
        "setup_instructions": None,
    },
    "Přítah": {
        "description": "1. Postav se před rovnou lavičku, chodidla na šíři ramen, jednoručka v jedné ruce.\n2. Polož druhou ruku na lavičku jako oporu a předkloň se — hrudník rovnoběžně se zemí.\n3. Přitáhni jednoručku k hrudníku a stlač lopatku.\n4. Loket drž blízko těla, střed těla zpevněný po celou dobu.",
        "setup_instructions": None,
    },
    "Přítah kolen k hrudníku": {
        "description": "1. Lehni si na záda, ruce podél těla nebo za hlavou.\n2. Flexí páteře stočí horní část zad od podlahy a přitáhni kolena k hrudníku.",
        "setup_instructions": None,
    },
    "Přítah v předklonu s jednoručkami": {
        "description": "1. Vezmi obě jednoručky a předkloň se v kyčlích — záda rovná.\n2. Čím blíže je trup k rovnoběžné poloze se zemí, tím delší rozsah pohybu v rameni.\n3. Nech paže volně viset a přitáhni oba lokty přímočaře nahoru ke stropu.",
        "setup_instructions": None,
    },
    "Rozpažení s jednoručkami": {
        "description": "1. Lehni na lavičku se dvěma jednoručkami nataženýma před sebou.\n2. Drž mírné pokrčení v loktech po celou dobu — pohyb provádí výhradně ramenní kloub.\n3. Rozpaž jednoručky do stran, zastav dříve než by šly za rovinu těla.\n4. Vrať jednoručky zpět na vrchol.",
        "setup_instructions": None,
    },
    "Rumunský mrtvý tah na bootybuilder pásu": {
        "description": "1. Uchop osu nadhmatem nebo střídavým úchopem na šíři ramen.\n2. Tlač kyčle dozadu, kolena drž téměř natažená. Hledej protažení zadní strany stehna.\n3. Jakmile ucítíš protažení, tlač kyčle dopředu zpět do stoje.",
        "setup_instructions": "Postav se na šíři ramen, prsty dopředu. Nadhmat i střídavý úchop jsou v pořádku — u střídavého existuje malé riziko natažení bicepsu. Vyhni se krčení ramen — jde o pohyb zadního řetězce, nikoli trapézů.",
    },
    "Rumunský mrtvý tah s jednoručkami": {
        "description": "1. Postav se na šíři ramen. Tlač kyčle dozadu, kolena drž téměř natažená.\n2. Ucítíš protažení zadní strany stehna — pak tlač kyčle dopředu pro dokončení opakování.\n3. Netlač kyčle úplně dopředu — to by hyperextendovalo páteř. Pouze se vrať do normálního stoje.",
        "setup_instructions": None,
    },
    "Šikmý tlak s jednoručkami": {
        "description": "1. Lehni na šikmou lavičku, chodidla na zemi. Zvedni jednoručky do polohy s nataženými pažemi.\n2. Spusť jednoručky k středu hrudníku.\n3. Zatlač jednoručky nahoru dokud nezamkneš lokty.",
        "setup_instructions": None,
    },
    "Sklapovačky na lavičce": {
        "description": "1. Sedni na okraj lavičky, mírně se zaklop dozadu a nohy natáhni dopředu.\n2. Flexí v trupu přitáhni kolena k hrudníku a zároveň přiblíž horní část těla k nohám.\n3. Kontrolovaně se vrať do výchozí polohy.",
        "setup_instructions": None,
    },
    "Stojatý multidřep (Panatta)": {
        "description": "1. Postav se na šíři ramen, zachovej přirozený oblouk v zádech, polož tyč na záda, stlač lopatky.\n2. Uchop tyč přes ramena, odblokuj Smith stroj narovnáním nohou.\n3. Pokrčuj kolena a spouštěj zátěž dokud nebudou kyčle pod úrovní kolen.\n4. Zvedni tyč zpět nahoru, tlač nohama a vydechni nahoře.",
        "setup_instructions": None,
    },
    "Super curl stroj (Panatta)": {
        "description": "1. Usaď se na lavičce preacher curl, uchop EZ tyč podhmatem, lokty nataženy.\n2. Pomalu zdvihuj tyč k ramenům, nadloktí drž pevně na opěrce, soustřeď se na biceps.\n3. Spusť tyč kontrolovaně zpět do výchozí polohy a opakuj.",
        "setup_instructions": None,
    },
    "Tlak s jednoručkami": {
        "description": "1. Lehni na lavičku s jednoručkou v každé ruce.\n2. Drž jednoručky na úrovni hrudníku, dlaně dopředu.\n3. Zpevni střed těla a tlač jednoručky nahoru dokud nejsou paže plně nataženy.",
        "setup_instructions": None,
    },
    "Únos": {
        "description": "1. Nastav stroj na svou výšku. Sedni si s rovnými zády opřenými o opěrku, nohy u sebe.\n2. Pomalu tlač nohy od sebe proti odporu. Na vrcholu se na okamžik zastav.\n3. Pomalu vrať nohy do výchozí polohy a opakuj.",
        "setup_instructions": None,
    },
    "Výskok na box": {
        "description": "1. Postav se před box.\n2. Pokrč se do čtvrtinového nebo půl dřepu a pak prudce vystřel kyčle dopředu.\n3. Snaž se dopadnout na střed boxu co nejměkčeji, aby se minimalizoval dopad na klouby.",
        "setup_instructions": None,
    },
    "Zdvih lýtek vsedě (Panatta)": {
        "description": "1. Sedni na lavičku s tyčovým nástavcem přes stehna.\n2. Zvedni paty co nejvýše a kontrolovaně spusť zpět.",
        "setup_instructions": None,
    },
    "Zdvih lýtek vstoje (Panatta)": {
        "description": "1. Drž obě madla a stůj vzpřímeně.\n2. Zvedni paty co nejvýše a kontrolovaně spusť zpět.",
        "setup_instructions": None,
    },
}


def main():
    rows = db_query("SELECT id, name FROM exercises ORDER BY name")
    updated = 0
    for r in rows:
        t = TRANSLATIONS.get(r["name"])
        if not t:
            continue
        desc = t["description"].replace("'", "''")
        if t["setup_instructions"]:
            setup = t["setup_instructions"].replace("'", "''")
            sql = f"UPDATE exercises SET description='{desc}', setup_instructions='{setup}', updated_at=NOW() WHERE id='{r['id']}'"
        else:
            sql = f"UPDATE exercises SET description='{desc}', updated_at=NOW() WHERE id='{r['id']}'"
        db_query(sql)
        print(f"  ✓ {r['name']}")
        updated += 1

    print(f"\nUpdated: {updated} exercises")


if __name__ == "__main__":
    main()
