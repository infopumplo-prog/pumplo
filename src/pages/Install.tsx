import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share, MoreVertical, Plus, Download, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageTransition from '@/components/PageTransition';
import { useTranslation } from 'react-i18next';

const Install = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>('ios');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">{t('install.title')}</h1>
          </div>
        </div>

        <motion.div
          className="px-6 py-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero Section */}
          <motion.div variants={itemVariants} className="text-center py-4">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('install.hero_title')}</h2>
            <p className="text-muted-foreground">
              {t('install.hero_desc')}
            </p>
          </motion.div>

          {/* Benefits */}
          <motion.div variants={itemVariants}>
            <Card className="p-4">
              <h3 className="font-semibold mb-3">{t('install.benefits_title')}</h3>
              <ul className="space-y-2">
                {[
                  t('install.benefit_1'),
                  t('install.benefit_2'),
                  t('install.benefit_3'),
                  t('install.benefit_4'),
                ].map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-chart-2 shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>

          {/* Platform Tabs */}
          <motion.div variants={itemVariants}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ios' | 'android')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ios">iPhone</TabsTrigger>
                <TabsTrigger value="android">Android</TabsTrigger>
              </TabsList>

              <TabsContent value="ios" className="mt-4 space-y-4">
                {/* Step 1 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.ios_step1_title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('install.ios_step1_desc')}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Step 2 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.ios_step2_title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('install.ios_step2_desc')}
                      </p>
                      <div className="bg-muted rounded-lg p-3 flex justify-center">
                        <Share className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Step 3 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.ios_step3_title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('install.ios_step3_desc')}
                      </p>
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                        <Plus className="w-6 h-6 text-primary" />
                        <span className="text-sm font-medium">{t('install.ios_step3_cta')}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Step 4 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.ios_step4_title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('install.ios_step4_desc')}
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="android" className="mt-4 space-y-4">
                {/* Step 1 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.android_step1_title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('install.android_step1_desc')}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Step 2 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.android_step2_title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('install.android_step2_desc')}
                      </p>
                      <div className="bg-muted rounded-lg p-3 flex justify-center">
                        <MoreVertical className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Step 3 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.android_step3_title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('install.android_step3_desc')}
                      </p>
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                        <Download className="w-6 h-6 text-primary" />
                        <span className="text-sm font-medium">{t('install.android_step3_cta')}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Step 4 */}
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{t('install.android_step4_title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('install.android_step4_desc')}
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Footer note */}
          <motion.p variants={itemVariants} className="text-center text-xs text-muted-foreground">
            {t('install.footer')}
          </motion.p>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Install;
