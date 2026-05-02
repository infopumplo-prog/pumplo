import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-semibold">Zásady ochrany osobních údajů</span>
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
          <h2 className="text-base font-bold">1. Správce osobních údajů</h2>
          <p>
            Správcem vašich osobních údajů je společnost <strong>GynTools CZ s.r.o.</strong>,
            IČ: 278 04 461, provozující aplikaci Pumplo.
          </p>
          <p>
            Kontakt: <a href="mailto:info.pumplo@gmail.com" className="text-primary underline">info.pumplo@gmail.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">2. Jaké údaje zpracováváme</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• <strong className="text-foreground">Identifikační údaje:</strong> jméno, příjmení, e-mailová adresa</li>
            <li>• <strong className="text-foreground">Fyzické parametry:</strong> věk, výška, váha, pohlaví (zadané dobrovolně při onboardingu)</li>
            <li>• <strong className="text-foreground">Zdravotní omezení:</strong> zranění a omezení pohybu (zadané dobrovolně)</li>
            <li>• <strong className="text-foreground">Tréninkové preference:</strong> cíl, úroveň, frekvence tréninků, preference vybavení</li>
            <li>• <strong className="text-foreground">Tréninkové záznamy:</strong> provedené cviky, váhy, časy, série</li>
            <li>• <strong className="text-foreground">Technické údaje:</strong> typ zařízení, verze aplikace (pro diagnostiku chyb)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">3. Účel a právní základ zpracování</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• <strong className="text-foreground">Poskytování služby</strong> — personalizované tréninkové plány a sledování pokroku (splnění smlouvy, čl. 6 odst. 1 písm. b) GDPR)</li>
            <li>• <strong className="text-foreground">Zlepšování aplikace</strong> — anonymizovaná analytika využití (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR)</li>
            <li>• <strong className="text-foreground">Zasílání notifikací</strong> — připomínky tréninků a motivační zprávy (souhlas, čl. 6 odst. 1 písm. a) GDPR)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">4. Příjemci a zpracovatelé</h2>
          <p className="text-muted-foreground">
            Vaše data jsou uložena na servery společnosti <strong className="text-foreground">Supabase Inc.</strong> (USA),
            která je naším zpracovatelem dat na základě standardních smluvních doložek (SCCs) dle čl. 46 GDPR.
            Data nejsou sdílena s třetími stranami za marketingovými účely.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">5. Doba uchovávání</h2>
          <p className="text-muted-foreground">
            Vaše osobní údaje uchováváme po dobu trvání vašeho účtu. Po smazání účtu jsou všechna data
            trvale odstraněna do 30 dnů. Zálohy jsou odstraněny do 90 dnů.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">6. Vaše práva</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• <strong className="text-foreground">Právo na přístup</strong> — můžete požádat o kopii vašich dat</li>
            <li>• <strong className="text-foreground">Právo na opravu</strong> — nepřesné údaje lze opravit v nastavení aplikace</li>
            <li>• <strong className="text-foreground">Právo na výmaz</strong> — účet a všechna data lze smazat v Nastavení → Smazat účet</li>
            <li>• <strong className="text-foreground">Právo na přenositelnost</strong> — export vašich dat je dostupný v Nastavení</li>
            <li>• <strong className="text-foreground">Právo vznést námitku</strong> — kontaktujte nás na info.pumplo@gmail.com</li>
            <li>• <strong className="text-foreground">Právo podat stížnost</strong> — u Úřadu pro ochranu osobních údajů (uoou.cz)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">7. Cookies a sledování</h2>
          <p className="text-muted-foreground">
            Aplikace nepoužívá marketingové cookies ani sledovací nástroje třetích stran.
            Technické cookies jsou nezbytné pro fungování přihlášení a relace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">8. Kontakt</h2>
          <p className="text-muted-foreground">
            Pro uplatnění práv nebo dotazy ohledně zpracování osobních údajů nás kontaktujte na{' '}
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

export default Privacy;
