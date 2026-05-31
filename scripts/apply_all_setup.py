#!/usr/bin/env python3
import subprocess, json

SUPABASE_URL = "https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query"
SUPABASE_TOKEN = "sbp_fde8b65400f5786eb9cfd525875a39eda274d741"

def db_query(sql):
    r = subprocess.run(["curl","-s","-X","POST",SUPABASE_URL,"-H",f"Authorization: Bearer {SUPABASE_TOKEN}","-H","Content-Type: application/json","-d",json.dumps({"query":sql})],capture_output=True,text=True)
    return json.loads(r.stdout)

SETUPS = {
    # --- CARDIO ---
    "90/90": "Sedni si na zem. Pokrč obě nohy do pravého úhlu v kolenou — přední noha vpředu, zadní noha za tebou, obě kolena na zemi. Záda vzpřímená.",
    "Air bike": "Nastav výšku sedla tak, aby byly nohy téměř natažené v dolní poloze pedálů. Posaď se a uchop madla. Záda rovná, hrudník mírně dopředu.",
    "Běh": "Nastav pás nebo si vyber rovný terén. Začni pomalým rozchozením a postupně přidávej tempo. Záda vzpřímená, pohled dopředu, paže uvolněné.",
    "Běžky": "Postav se na pedály crosstraineru a uchop madla. Nastav odpor a sklon podle intenzity tréninku. Záda vzpřímená, kolena mírně pokrčená.",
    "Chůze": "Stůj vzpřímeně, pohled dopředu. Začni přirozenou chůzí s houpáním paží. Chodidla pokládej od paty po špičku.",
    "Chůze po schodech": "Postav se ke schodišti nebo stepperu. Udržuj vzpřímenou polohu a pohled dopředu. Celé chodidlo pokládej na každý schod.",
    "Kolo": "Nastav výšku sedla tak, aby bylo koleno mírně pokrčeno v dolní poloze šlapání. Uchop řídítka v pohodlné poloze. Záda lehce předkloněná.",
    "Orbitrek": "Postav se na pedály orbitrekového stroje a uchop madla. Nastav odpor podle tréninkové intenzity. Záda vzpřímená, pohyb plynulý.",
    "Sprint": "Postav se do startovní pozice na rovné ploše. Mírně se předkloň, váha na přední části chodidla. Nohy na šíři ramen, připraven explodovat.",
    "Stacionární kolo": "Nastav výšku sedla tak, aby koleno zůstalo mírně pokrčeno v dolní poloze šlapání. Uchop řídítka v přirozené poloze, záda mírně předkloněná.",
    "Stepper": "Postav se na pedály stepperu, uchop madla pro stabilitu. Nastav odpor a tempo. Stůj vzpřímeně s mírně pokrčenými koleny.",

    # --- PROTAŽENÍ ---
    "Protažení flexorů kyčle": "Klekni si na jedno koleno, druhá noha vpředu s kolenem nad kotníkem. Udržuj vzpřímenou polohu trupu, ruce polož na přední stehno nebo kyčle.",
    "Protažení hrudníku": "Postav se nebo sedni vzpřímeně. Propni prsty za zády nebo uchop pevný bod za sebou. Ramena stáhni dolů a dozadu.",
    "Protažení hýždí": "Sedni nebo lehni na podložku. Pokrč obě kolena, jednu nohu přehoď přes druhou — kotník na koleno. Záda rovná.",
    "Protažení krku": "Sedni nebo postav se vzpřímeně s uvolněnými rameny. Hlava ve středu, brada mírně dolů. Pohyby provádej pomalu a kontrolovaně.",
    "Protažení lýtek": "Postav se čelem ke zdi, asi půl metru od ní. Jedna noha vpředu, druhá vzadu s nataženým kolenem a patou na zemi. Opři se dlaněmi o zeď.",
    "Protažení zadní strany stehna": "Stůj nebo sedni. Jednu nohu natáhni před sebe, druhou pokrč. Záda drž rovná a předkloň se v kyčlích — ne v bedrech.",

    # --- BODYWEIGHT ---
    "Dětská pozice": "Klekni si na kolena a sedni si na paty. Ruce natáhni před sebe nebo polož podél těla. Záda uvolni, čelo na podložce.",
    "Dips": "Postav se mezi bradla nebo rovnoběžné tyče. Uchop obě tyče s nataženými pažemi, váha na dlaních. Nohy mírně pokrčené dozadu.",
    "Dips s dopomocí": "Nastav stroj na požadovanou dopomoc a klekni nebo postav se na platformu. Uchop madla s nataženými pažemi — platforma tě bude nadlehčovat.",
    "Dips s dopomocí gumy": "Připevni odporovou gumu na tyč bradel. Klekni do smyčky gumy nebo ji zasuň pod chodidla. Uchop obě madla bradel.",
    "Lopatka": "Postav se nebo zavěs na tyč s nataženými pažemi. Ramena uvolni. Soustřeď se výhradně na pohyb lopatek — bez pohybu paží.",
    "Medvědí chůze": "Klekni na čtyři — dlaně pod rameny, kolena pod kyčlemi. Zvedni kolena od podložky asi 5 cm. Záda rovná, rovnoběžná se zemí.",
    "Medvědí plank": "Klekni na čtyři — dlaně pod rameny, kolena pod kyčlemi. Zvedni kolena od podložky asi 5 cm a drž staticky. Záda rovná.",
    "Mrtvý brouk": "Lehni si na záda na podložku. Zdvihni paže kolmo ke stropu a nohy pokrč do 90° (lýtka rovnoběžně se zemí). Bedra přitiskni k podložce.",
    "Nožky k tyči": "Uchop tyč nadhmatem na šíři ramen nebo mírně širší. Zavěs se ve visu s plně nataženými pažemi. Záda mírně prohnutá, tělo stabilizuj.",
    "Plank do downward dog": "Začni v pozici planku na natažených pažích — dlaně pod rameny, tělo v rovné linii od hlavy po paty. Záda rovná, břicho zpevněné.",
    "Rovnováha na jedné noze": "Postav se vzpřímeně vedle opory (pokud potřebuješ). Přesuň váhu na jednu nohu, mírně pokrč koleno opěrné nohy. Upři pohled na pevný bod.",

    # --- BARBELL / SMITH ---
    "Bench press na Smith stroji": "Nastav lavičku pod Smith stroj tak, aby tyč byla při spuštění těsně nad středem hrudníku. Nastav bezpečnostní zarážky mírně nad hrudník. Lehni si, chodidla pevně na zemi.",
    "Dřep": "Nastav osu ve stojanu do výšky ramen. Postav se pod osu, polož ji na horní záda (trapézy). Uchop tyč mírně širší než na šíři ramen. Vykroč ze stojanu dvěma kroky zpět.",
    "Dřep na Smith stroji": "Nastav bezpečnostní zarážky těsně pod hloubku dřepu. Postav se pod tyč, polož ji na horní záda. Chodidla mírně před tyčí. Odblokuj stroj otočením.",
    "Dřep v rámu": "Nastav osu ve stojanu do výšky ramen. Polož ji na horní záda. Nastav bezpečnostní zarážky na výšku dna dřepu. Vykroč dvěma kroky zpět.",
    "Hip thrust na Smith stroji": "Nastav lavičku před Smith stroj. Opři lopatky o hranu lavičky. Nastav výšku tyče na úroveň kyčlí ve spodní poloze. Vlož polštářek mezi tyč a kyčle.",
    "Mrtvý tah na plošině": "Postav se na plošinu, osa před chodidly. Postoj na šíři ramen, uchop osu nadhmatem nebo střídavým úchopem. Záda rovná, kyčle nad kolenou.",
    "Mrtvý tah trapbarem na plošině": "Postav se doprostřed trap baru na plošině. Uchop madla po stranách, chodidla na šíři ramen. Záda rovná, kyčle nad kolenou.",
    "Pendlay row": "Polož osu na zem. Postav se nad osu, chodidla na šíři ramen. Předkloň se tak, aby trup byl téměř rovnoběžný se zemí. Uchop nadhmatem na šíři ramen.",
    "Pullover": "Lehni si napříč na lavičku nebo podélně na záda. Drž jednoručku nebo osu oběma rukama nad hrudníkem s mírně pokrčenými lokty.",
    "Rumunský mrtvý tah na Smith stroji": "Nastav tyč na výšku kyčlí. Postav se na šíři ramen, prsty dopředu. Uchop tyč nadhmatem a odblokuj stroj. Záda rovná.",
    "Rumunský mrtvý tah s jednoručkami": "Postav se vzpřímeně, jednoručka v každé ruce podél těla, dlaně k tělu. Postoj na šíři ramen, prsty dopředu. Záda rovná.",
    "Rumunský mrtvý tah s kettlebellem": "Postav se vzpřímeně, kettlebell v každé ruce nebo jeden kettlebell oběma rukama. Postoj na šíři ramen, záda rovná.",
    "Šikmý bench press": "Nastav lavičku na úhel 30–45°. Lehni si, chodidla pevně na zemi. Nastav bezpečnostní zarážky. Uchop osu mírně širší než na šíři ramen.",
    "Šikmý bench press na Smith stroji": "Nastav šikmou lavičku (30–45°) pod Smith stroj. Lehni si, chodidla na zemi. Nastav tyč a zarážky. Uchop tyč na šíři ramen.",
    "Šikmý bench press v rámu": "Nastav lavičku na 30–45° ve stojanu. Nastav bezpečnostní zarážky. Lehni si a uchop osu mírně širší než na šíři ramen.",
    "Skull crusher s EZ tyčí": "Nastav lavičku vodorovně. Lehni si na záda, uchop EZ tyč úzkým podhmatem. Natáhni paže kolmo ke stropu s tyčí nad čelem.",
    "Výpady na Smith stroji": "Nastav tyč na výšku ramen, polož ji na horní záda. Odblokuj stroj. Postav se ve stabilní poloze pro vykročení dopředu.",
    "Výpady s pytlem": "Drž pytel oběma rukama nebo ho polož na ramena. Postav se vzpřímeně, chodidla na šíři ramen. Pohled dopředu, ramena stažena dozadu.",
    "Výpady v rámu": "Nastav osu ve stojanu do výšky ramen. Polož ji na horní záda. Vykroč ze stojanu a postav se ve stabilní poloze pro výpady.",

    # --- DUMBBELL / KETTLEBELL ---
    "Bicepsový zdvih EZ tyčí": "Postav se vzpřímeně s EZ tyčí v rukou podhmatem na zahnuté části tyče. Postoj na šíři ramen nebo mírně užší. Lokty drž u těla.",
    "Bicepsový zdvih EZ tyčí vstoje": "Postav se vzpřímeně s EZ tyčí v rukou podhmatem. Postoj na šíři ramen. Lokty přitiskni k tělu, ruce na zahnuté části tyče.",
    "Bicepsový zdvih s kettlebellem": "Postav se vzpřímeně s kettlebellem v každé ruce — dlaně dopředu (supinovaný úchop). Paže natažené podél těla. Postoj na šíři ramen.",
    "Bulharský dřep s kettlebellem": "Drž kettlebell v každé ruce podél těla nebo jeden v goblet poloze u hrudníku. Postav se před box nebo lavičku ve vzdálenosti jednoho kroku.",
    "Goblet dřep s kettlebellem": "Drž kettlebell oběma rukama za plochý konec nebo za ucho u horního hrudníku, lokty dovnitř. Chodidla mírně širší než šíře ramen.",
    "Hyperextenze kyčlí na bootybuilderu": "Nastav bootybuilder do správné výšky. Polož přední stranu kyčlí na polštář a uchop madla. Kotníky upevni do pásu nebo na opěrku.",
    "Jednostranný hip thrust s jednoručkou": "Opři lopatky o hranu lavičky nebo boxu. Polož jednoručku na kyčle pracovní strany. Chodidlo pracovní nohy pevně na zemi.",
    "Jednostranný hip thrust s kettlebellem": "Opři lopatky o hranu lavičky nebo boxu. Polož kettlebell na kyčle pracovní strany. Chodidlo pracovní nohy pevně na zemi.",
    "Jednostranný přítah s jednoručkou": "Postav se před lavičku — jednu ruku a koleno opři o ni pro stabilitu. Jednoručka visí volně v druhé ruce, záda rovná a rovnoběžná se zemí.",
    "Jednostranný přítah s kettlebellem": "Postav se před lavičku, jednu ruku opři o ni. Kettlebell visí volně v druhé ruce. Záda rovná, rovnoběžná se zemí.",
    "Jednostranný rumunský mrtvý tah na klouzačce": "Postav se vzpřímeně. Pod jednu nohu polož skluzný disk. Váha na přední noze. Záda rovná, druhou ruku drž volně nebo na opoře.",
    "Jednostranný rumunský mrtvý tah s jednoručkou": "Postav se vzpřímeně s jednoručkou v ruce. Váha na jedné noze, druhá noha se lehce dotýká podlahy. Záda rovná.",
    "Jednostranný rumunský mrtvý tah s kettlebellem": "Postav se vzpřímeně s kettlebellem v jedné ruce. Váha na jedné noze. Záda rovná, pohled dopředu.",
    "Kladivový zdvih s kettlebellem": "Postav se vzpřímeně s kettlebellem v každé ruce — neutrální úchop (palce dopředu). Paže natažené podél těla. Postoj na šíři ramen.",
    "Předpažení s kettlebellem": "Postav se vzpřímeně s kettlebellem v každé ruce. Dlaně k sobě nebo palce dopředu. Postoj na šíři ramen, záda rovná.",
    "Přítah na lavičce s kettlebellem": "Polož kettlebell na lavičku. Postav se bokem k lavičce, jednu ruku opři o ni. Kettlebell vezmi do druhé ruky. Záda rovná, mírně předkloněn.",
    "Přítah v předklonu s kettlebellem": "Drž kettlebell v každé ruce. Předkloň se v kyčlích na 45–90°, záda rovná. Nech kettlebelly volně viset před tělem.",
    "Přítah v předklonu s gumou": "Připevni odporovou gumu na nízký bod nebo stojan. Postav se čelem k ukotvení, uchop gumu oběma rukama. Předkloň se v kyčlích, záda rovná.",
    "Přítah v předklonu s landminem": "Nastav landmine do bezpečné polohy. Uchop konec tyče oběma rukama nebo jednou. Předkloň se v kyčlích na 45–90°, záda rovná.",
    "Přítah v předklonu na Smith stroji": "Nastav tyč Smith stroje na výšku kolen nebo mírně výše. Postav se pod tyč, předkloň se v kyčlích na 45–90°. Záda rovná, uchop nadhmatem.",
    "Rozpažení s jednoručkami": "Lehni si na lavičku na záda. Vezmi jednoručku do každé ruky a natáhni paže kolmo ke stropu s mírným pokrčením v loktech.",
    "Skull crusher s jednoručkami": "Lehni si na záda na lavičku. Vezmi jednoručku do každé ruky a natáhni paže kolmo ke stropu. Lokty drž na šíři ramen.",
    "Skull crusher s kettlebellem": "Lehni si na záda na lavičku. Drž kettlebell oběma rukama nad obličejem s nataženými pažemi. Lokty na šíři ramen.",
    "Tlak s kettlebellem dnem nahoru": "Drž kettlebell s kulatou částí nahoře — palce a prsty obalují ucho z boků. Postav se vzpřímeně, kettlebell na úrovni ramene.",
    "Tlak s kettlebellem na šikmé lavici": "Nastav lavičku na 30–45°. Lehni si, kettlebell drž v jedné nebo obou rukou na úrovni hrudníku. Chodidla pevně na zemi.",
    "Tlak s kettlebellem nad hlavu": "Postav se vzpřímeně nebo sedni. Drž kettlebell na úrovni ramene — ucho u špiček prstů, ruka pevně. Loket mírně vpředu.",
    "Tlak s kettlebellem nad hlavu vstoje": "Postav se vzpřímeně, chodidla na šíři ramen. Kettlebell drž na úrovni ramene s uchem u špiček prstů. Druhou ruku polož na kyčel.",
    "Tricepsové natažení za hlavou s jednoručkou": "Sedni na lavičku nebo postav se. Drž jednoručku oběma rukama nad hlavou s nataženými pažemi. Lokty u uší, směřují ke stropu.",
    "Tricepsový kickback s kettlebellem": "Předkloň se v kyčlích na 45°, záda rovná. Kettlebell drž v jedné ruce, nadloktí přitiskni k tělu rovnoběžně se zemí. Loket v 90°.",
    "Tricepsové natažení nad hlavou s kettlebellem": "Postav se vzpřímeně nebo sedni. Drž kettlebell oběma rukama za plochou část nad hlavou s nataženými pažemi. Lokty u uší.",
    "Upažení s kettlebellem": "Postav se vzpřímeně s kettlebellem v každé ruce podél těla. Dlaně k tělu nebo dopředu. Postoj na šíři ramen, záda rovná.",
    "Upažení vzad s jednoručkami": "Mírně se předkloň v kyčlích (45°) nebo lehni hrudníkem na šikmou lavičku. Jednoručka v každé ruce s dlaněmi k sobě nebo dolů.",
    "Větrný mlýn s kettlebellem": "Postav se mírně širší než šíře ramen, špičky otočeny 45° od ruky s kettlebellem. Kettlebell natáhni nad rameno v jedné ruce.",
    "Výpady s jednoručkami": "Drž jednoručku v každé ruce podél těla. Postav se vzpřímeně, chodidla u sebe. Pohled dopředu, záda rovná.",
    "Výpady s kettlebellem": "Drž kettlebell v každé ruce podél těla nebo jeden v goblet poloze u hrudníku. Postav se vzpřímeně, chodidla u sebe.",

    # --- CABLE ---
    "Jednostranné předpažení na kabelu": "Nastav kladku na nejnižší pozici. Postav se bokem ke stroji, uchop rukojeť vzdálenější rukou. Postoj na šíři ramen pro stabilitu.",
    "Jednostranné tricepsové natažení": "Nastav kladku na horní polohu, připevni lanový nebo tyčový nástavec. Postav se čelem ke stroji, uchop nástavec jednou rukou. Loket přitiskni k tělu.",
    "Jednostranné upažení na kabelu": "Nastav kladku na nejnižší polohu. Postav se bokem ke stroji, uchop rukojeť vzdálenější rukou. Postoj stabilní na šíři ramen.",
    "Kickback na kabelu": "Nastav kladku na nejnižší polohu a připevni nákotníkový nástavec na kotník pracovní nohy. Postav se čelem ke stroji, mírně se nakloň dopředu.",
    "Přítah na kabelu vsedě": "Posaď se na lavičku, nastav nožní opěrku. Uchop tyč nebo madla s rovnými pažemi. Záda vzpřímená, mírně se nakloni vpřed při úchopu.",
    "Přítah spodní kladky (Panatta)": "Posaď se na Panatta low row stroj. Nastav nožní opěrku a uchop madla. Záda vzpřímená, nohy mírně pokrčeny.",
    "Rozpažení na kabelu": "Nastav obě kladky na střední nebo horní výšku. Postav se doprostřed stroje. Uchop každou rukojeť, dlaně k sobě. Mírně se předkloň.",
    "Tricepsové natažení nad hlavou na kabelu": "Nastav kladku na nejnižší polohu, připevni lanový nástavec. Postav se zády ke stroji. Uchop lano za hlavou, lokty u uší.",
    "Tricepsové natažení s EZ tyčí": "Nastav kladku na horní polohu, připevni EZ nebo rovnou tyč. Postav se čelem ke stroji, uchop tyč na šíři ramen. Lokty přitiskni k tělu.",

    # --- MACHINE ---
    "Extenze nohou": "Nastav opěrku bérce těsně nad kotníky. Nastav sedadlo tak, aby bylo koleno na ose otáčení stroje. Posaď se, záda celá na opěrce.",
    "Extenze nohou (Panatta)": "Nastav sedadlo a opěrku bérce na Panatta stroji. Koleno musí být na ose otáčení. Posaď se vzpřímeně, záda celá na opěrce.",
    "Horizontální leg press (Panatta)": "Lehni si na platformu. Nastav opěrku zad. Nohy polož na desku na šíři ramen, prsty mírně ven. Odblokuj stroj.",
    "Jednostranná extenze nohou": "Nastav stroj stejně jako pro oboustrannou extenzi. Polož pouze jednu nohu pod bércový polštář, druhou drž volně.",
    "Jednostranný leg curl": "Nastav bércový polštář těsně nad kotník pracovní nohy. Lehni nebo sedni na stroj, záda na opěrce. Druhá noha volně.",
    "Kickback": "Nastav stroj pro glute kickback. Uchop madla pro oporu. Pracovní nohu umísti na platformu nebo pod polštář. Záda rovná, mírně předkloněn.",
    "Leg curl": "Nastav bércový polštář těsně nad oba kotníky. Lehni si na stroj nebo sedni. Záda celá na opěrce, kyčle pevně přitlačeny.",
    "Leg press": "Posaď se do leg pressu, záda celá na opěrce. Nohy polož na desku na šíři ramen, prsty mírně ven. Odblokuj bezpečnostní zarážky.",
    "Leg press 45° (Panatta)": "Posaď se do Panatta 45° leg pressu, záda na opěrce. Nohy polož na desku na šíři ramen nebo mírně širší. Odblokuj zarážky.",
    "Peck deck (Panatta)": "Nastav výšku sedadla — lokty na úrovni ramen na podložkách. Posaď se, záda celá na opěrce. Předloktí polož na polštáře.",
    "Pektorální stroj (Panatta)": "Nastav výšku sedadla — madla na úrovni ramen. Posaď se, záda na opěrce. Uchop madla s mírně pokrčenými lokty.",
    "Powersquat": "Nastav ramenní polštáře na výšku svých ramen. Vlezni pod stroj, ramena pod polštáře. Chodidla na platformě na šíři ramen. Odblokuj narovnáním nohou.",
    "Přítah na stroji s dopomocí": "Nastav hmotnost dopomoci. Klekni nebo postav se na platformu. Uchop tyč nadhmatem nebo podhmatem na šíři ramen.",
    "Přítah s dopomocí gumy": "Připevni odporovou gumu na tyč. Klekni do smyčky gumy nebo ji zasuň pod chodidla. Uchop tyč nadhmatem na šíři ramen.",
    "Rotace trupu (Panatta)": "Posaď se do stroje, záda na opěrce. Nastav výchozí úhel rotace. Uchop madla nebo opři předloktí na podložky. Nohy pevně na opěrce.",
    "Šikmý tlak na prsa (Panatta)": "Nastav sedadlo — madla mírně pod linií ramen. Posaď se, záda celá na opěrce, chodidla na zemi. Uchop madla s lokty mírně níže než ramena.",
    "Šikmý tlak na prsa výběr (Panatta)": "Nastav sedadlo a úhel opěradla. Záda celá na opěrce, uchop madla na úrovni hrudníku nebo mírně níže.",
    "Sissy dřep": "Nastav kotníkovou opěrku na stroji. Postav se vzpřímeně, uchop stroj pro stabilitu. Kotníky v opěrce, chodidla blízko u sebe.",
    "Super pendulový dřep (Panatta)": "Vlezni do stroje, polož ramena pod polštáře nebo uchop madla. Chodidla na platformě na šíři ramen. Záda v přirozené křivce. Odblokuj stroj.",
    "Super pendulový dřep vpředu (Panatta)": "Vlezni do stroje čelem k platformě. Polož ramena pod polštáře. Chodidla na platformě o něco výše nebo dopředu. Odblokuj stroj.",
    "Tlak na prsa dolů (Panatta)": "Nastav sedadlo — madla na úrovni spodní části hrudníku. Posaď se, záda na opěrce, chodidla na zemi. Uchop madla s lokty mírně dole.",
    "Tlak nad hlavu vsedě na Smith stroji": "Nastav lavičku pod Smith stroj, záda opřena o opěradlo. Nastav výšku tyče na úroveň ramen. Uchop tyč na šíři ramen nebo mírně širší.",
    "Únos kyčle": "Nastav vnitřní polštáře na výšku kolen. Posaď se vzpřímeně, záda celá na opěrce. Nohy u sebe ve výchozí poloze.",
    "Upažení na stroji (Panatta)": "Nastav výšku sedadla — lokty na úrovni ramen. Posaď se, záda na opěrce. Polož předloktí nebo lokty na polštáře. Výchozí poloha na šíři ramen.",
    "Vertikální tlak na prsa (Panatta)": "Nastav sedadlo — madla na úrovni středu hrudníku. Posaď se, záda celá na opěrce, chodidla na zemi.",
    "Vertikální tlak na prsa na stroji": "Nastav sedadlo — madla nebo páky na úrovni středu hrudníku. Posaď se, záda celá na opěrce.",
    "Veslování": "Posaď se na stroj, uchop madla nebo opři hrudník na opěrku. Nastav stroj na svou výšku. Záda vzpřímená, mírně se nakloni vpřed.",
    "Veslování (Panatta)": "Posaď se na Panatta rowing stroj. Nastav nožní opěrku a výšku sedadla. Uchop madla, záda vzpřímená, mírně se nakloni vpřed.",

    # --- OSTATNÍ ---
    "Překlopení pneumatiky": "Postav se čelem k pneumatice ve stabilním širokém postoji. Pokrč kolena, ruce zasuň pod spodní okraj pneumatiky. Záda rovná, hrudník blízko pneumatiky.",
    "Tah saní": "Připevni lano nebo popruh na saně. Postav se čelem k saním, uchop lano oběma rukama. Mírně se předkloň, lano v tahu.",
    "Tlak saní": "Postav se za saně ve stabilním, nízkém postoji. Předloktí nebo ruce polož na madla saní. Tělo v rovné linii od hlavy po paty.",
    "Turkish get-up s kettlebellem": "Lehni si na záda, kettlebell v jedné ruce natažené kolmo ke stropu. Druhou paži i nohu téže strany polož na zem pod 45°. Koleno druhé nohy pokrč.",
    "Větrný mlýn": "Postav se mírně širší než šíře ramen, špičky otočeny 45° od ruky s kettlebellem nebo jednoručkou. Závaží natáhni nad rameno v jedné ruce.",
    "Wall ball": "Postav se zhruba metr od zdi. Drž medicinbal oběma rukama u hrudníku, lokty dovnitř. Chodidla na šíři ramen, prsty mírně ven.",
    "Výskok na box": "Postav se přibližně půl metru od boxu, chodidla na šíři ramen. Záda rovná, pohled na box. Připrav se na explozivní pohyb.",
    "Výstup na box": "Postav se čelem k boxu přibližně jeden krok od něj. Chodidla na šíři ramen. Jednoručky drž podél těla (pokud používáš závaží).",
    "Y zdvih": "Postav se vzpřímeně nebo lehni na šikmou lavičku. Drž lehké jednoručky nebo gumy v každé ruce. Paže nataženy podél těla nebo šikmo dolů.",
    "Zdvih kolen": "Postav se pod tyč nebo uchop madla stroje. Záda vzpřímená, váha rovnoměrně rozložena. Paže nataženy, tělo stabilizováno.",
    "Zdvih kolen ve visu": "Uchop tyč nadhmatem na šíři ramen nebo mírně širší. Zavěs se ve visu s plně nataženými pažemi. Zabrání houpání — na okamžik se ustáli.",
    "Zdvih nohou ve visu": "Uchop tyč nadhmatem na šíři ramen nebo mírně širší. Zavěs se ve visu s plně nataženými pažemi. Nohy nataženy dolů, tělo stabilní.",
    "Zpětné rozpažení": "Mírně se předkloň v kyčlích na 45° nebo sedni na přední část lavičky. Drž jednoručku v každé ruce s dlaněmi k sobě. Záda rovná.",
    "Zpětné rozpažení na kabelu": "Nastav obě kladky na horní polohu. Přejdi doprostřed stroje — každou rukou uchop opačnou rukojeť (překříž). Mírně se předkloň.",
}


def main():
    rows = db_query("SELECT id, name FROM exercises ORDER BY name")
    updated = 0
    skipped = []
    for r in rows:
        setup = SETUPS.get(r["name"])
        if not setup:
            skipped.append(r["name"])
            continue
        safe = setup.replace("'", "''")
        db_query(f"UPDATE exercises SET setup_instructions='{safe}', updated_at=NOW() WHERE id='{r['id']}'")
        print(f"  ✓ {r['name']}")
        updated += 1

    print(f"\nUpdated: {updated}")
    if skipped:
        print(f"No mapping ({len(skipped)}): {', '.join(set(skipped))}")


if __name__ == "__main__":
    main()
