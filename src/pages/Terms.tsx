import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const Terms = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-semibold">{t('terms.title')}</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-sm leading-relaxed"
      >
        <div>
          <p className="text-muted-foreground">{t('terms.last_updated')}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s1_title')}</h2>
          <p>
            {t('terms.s1_body')}<strong>{t('terms.s1_company')}</strong>{t('terms.s1_body2')}
          </p>
          <p>
            {t('terms.s1_contact')} <a href="mailto:info.pumplo@gmail.com" className="text-primary underline">info.pumplo@gmail.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s2_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s2_body')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s3_title')}</h2>
          <p className="text-muted-foreground">
            {t('terms.s3_body1')}<strong className="text-foreground">{t('terms.s3_age')}</strong>{t('terms.s3_body2')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s4_title')}</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>{t('terms.s4_bullet1')}</li>
            <li>{t('terms.s4_bullet2')}</li>
            <li>{t('terms.s4_bullet3')}</li>
            <li>{t('terms.s4_bullet4')}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s5_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s5_intro')}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>{t('terms.s5_bullet1')}</li>
            <li>{t('terms.s5_bullet2')}</li>
            <li>{t('terms.s5_bullet3')}</li>
            <li>{t('terms.s5_bullet4')}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s6_title')}</h2>
          <p className="text-muted-foreground">
            {t('terms.s6_body1')}<strong className="text-foreground">{t('terms.s6_emphasis')}</strong>{t('terms.s6_body2')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s7_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s7_body')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s8_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s8_body')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s9_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s9_body')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s10_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s10_body')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s11_title')}</h2>
          <p className="text-muted-foreground">{t('terms.s11_body')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">{t('terms.s12_title')}</h2>
          <p className="text-muted-foreground">
            {t('terms.s12_body')}{' '}
            <a href="mailto:info.pumplo@gmail.com" className="text-primary underline">info.pumplo@gmail.com</a>.
          </p>
        </section>

        <div className="pt-4 pb-8">
          <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
            {t('terms.back_to_app')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Terms;
