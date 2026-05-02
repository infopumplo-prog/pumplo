import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-semibold">Podmínky používání</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-sm leading-relaxed"
      >
        <div>
          <p className="text-muted-foreground">Poslední aktualizace: 2. května 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-bold">1. Provozovatel a kontakt</h2>
          <p>
            Aplikaci Pumplo provozuje společnost <strong>GynTools CZ s.r.o.</strong>,
            IČ: 278 04 461, jednatel David Novotný.
          </p>
          <p>
            Kontakt: <a href="mailto:info.pumplo@gmail.com" className="text-primary underline">info.pumplo@gmail.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">2. Popis služby</h2>
          <p className="text-muted-foreground">
            Pumplo je mobilní aplikace pro sledování tréninků, personalizované tréninkové plány
            a komunikaci s trenéry ve fitness centrech. Aplikace je dostupná bezplatně pro
            koncové uživatele (členy posiloven).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">3. Věková hranice</h2>
          <p className="text-muted-foreground">
            Služba Pumplo je určena osobám starším <strong className="text-foreground">15 let</strong>.
            Registrací potvrzujete, že jste dosáhli tohoto věku. Osoby mladší 15 let mohou
            službu využívat pouze se souhlasem zákonného zástupce.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">4. Uživatelský účet</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Registrací souhlasíte s těmito podmínkami a se zpracováním osobních údajů dle našich Zásad ochrany osobních údajů.</li>
            <li>• Jste zodpovědní za zachování důvěrnosti svého hesla a za veškerou aktivitu na svém účtu.</li>
            <li>• Jeden účet smí používat pouze jedna fyzická osoba.</li>
            <li>• Svůj účet a všechna data můžete kdykoli smazat v sekci Nastavení.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">5. Pravidla používání</h2>
          <p className="text-muted-foreground">Zavazujete se, že nebudete:</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Zneužívat aplikaci k nelegální činnosti nebo šíření škodlivého obsahu.</li>
            <li>• Pokoušet se o neoprávněný přístup k účtům jiných uživatelů nebo systémům aplikace.</li>
            <li>• Automatizovaně stahovat obsah aplikace bez předchozího písemného souhlasu.</li>
            <li>• Vydávat se za jinou osobu nebo uvádět nepravdivé informace.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">6. Zdravotní upozornění</h2>
          <p className="text-muted-foreground">
            Pumplo poskytuje tréninkové plány a doporučení jako <strong className="text-foreground">informační pomůcku</strong>,
            nikoliv jako lékařskou poradenskou službu. Před zahájením cvičebního programu,
            zejména při zdravotních omezeních nebo po zranění, doporučujeme konzultaci s lékařem.
            Provozovatel neodpovídá za zdravotní újmy vzniklé v důsledku používání aplikace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">7. Duševní vlastnictví</h2>
          <p className="text-muted-foreground">
            Veškerý obsah aplikace (design, cvičební videa, texty, algoritmy) je majetkem
            GynTools CZ s.r.o. a je chráněn autorským právem. Obsah smíte používat výhradně
            pro osobní, nekomerční účely.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">8. Dostupnost služby</h2>
          <p className="text-muted-foreground">
            Usilujeme o nepřetržitou dostupnost aplikace, ale nezaručujeme ji. Vyhrazujeme si
            právo přerušit nebo ukončit provoz aplikace, nebo omezit přístup k účtu při
            porušení těchto podmínek.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">9. Omezení odpovědnosti</h2>
          <p className="text-muted-foreground">
            Aplikace je poskytována „tak, jak je". Provozovatel neodpovídá za nepřímé,
            náhodné ani následné škody vzniklé v souvislosti s používáním aplikace,
            včetně ztráty dat nebo přerušení služby.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">10. Změny podmínek</h2>
          <p className="text-muted-foreground">
            Tyto podmínky můžeme kdykoli aktualizovat. O podstatných změnách vás budeme
            informovat v aplikaci. Pokračováním v používání služby po oznámení změn
            vyjadřujete souhlas s aktualizovanými podmínkami.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">11. Rozhodné právo</h2>
          <p className="text-muted-foreground">
            Tyto podmínky se řídí právním řádem České republiky. Veškeré spory budou
            řešeny příslušnými soudy ČR.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">12. Kontakt</h2>
          <p className="text-muted-foreground">
            Dotazy k těmto podmínkám zasílejte na{' '}
            <a href="mailto:info.pumplo@gmail.com" className="text-primary underline">info.pumplo@gmail.com</a>.
          </p>
        </section>

        <div className="pt-4 pb-8">
          <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
            Zpět do aplikace
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Terms;
