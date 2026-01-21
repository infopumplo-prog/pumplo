import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share, MoreVertical, Plus, Download, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageTransition from '@/components/PageTransition';

const Install = () => {
  const navigate = useNavigate();
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
            <h1 className="text-lg font-semibold">Instalace Pumplo</h1>
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
            <h2 className="text-2xl font-bold mb-2">Nainstaluj si Pumplo</h2>
            <p className="text-muted-foreground">
              Přidej Pumplo na svou domovskou obrazovku pro rychlý přístup k tréninkům
            </p>
          </motion.div>

          {/* Benefits */}
          <motion.div variants={itemVariants}>
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Výhody instalace</h3>
              <ul className="space-y-2">
                {[
                  'Rychlý přístup z domovské obrazovky',
                  'Funguje offline – tréninky a historie',
                  'Nativní vzhled bez adresního řádku',
                  'Automatické aktualizace',
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
                      <h4 className="font-semibold mb-1">Otevři Safari</h4>
                      <p className="text-sm text-muted-foreground">
                        Ujisti se, že používáš prohlížeč Safari. Instalace z jiných prohlížečů není na iOS možná.
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
                      <h4 className="font-semibold mb-1">Klikni na "Sdílet"</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        V dolní liště prohlížeče najdi ikonu sdílení (čtverec se šipkou nahoru).
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
                      <h4 className="font-semibold mb-1">"Přidat na plochu"</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Posuň se níž v menu a najdi možnost "Přidat na plochu".
                      </p>
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                        <Plus className="w-6 h-6 text-primary" />
                        <span className="text-sm font-medium">Přidat na plochu</span>
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
                      <h4 className="font-semibold mb-1">Potvrď instalaci</h4>
                      <p className="text-sm text-muted-foreground">
                        Klikni "Přidat" v pravém horním rohu. Pumplo se objeví na tvé ploše!
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
                      <h4 className="font-semibold mb-1">Otevři Chrome</h4>
                      <p className="text-sm text-muted-foreground">
                        Pro nejlepší zážitek použij prohlížeč Google Chrome.
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
                      <h4 className="font-semibold mb-1">Klikni na menu (⋮)</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        V pravém horním rohu prohlížeče najdi ikonu tří teček.
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
                      <h4 className="font-semibold mb-1">"Nainstalovat aplikaci"</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        V menu najdi možnost "Nainstalovat aplikaci" nebo "Přidat na plochu".
                      </p>
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                        <Download className="w-6 h-6 text-primary" />
                        <span className="text-sm font-medium">Nainstalovat aplikaci</span>
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
                      <h4 className="font-semibold mb-1">Potvrď instalaci</h4>
                      <p className="text-sm text-muted-foreground">
                        Klikni "Instalovat" v dialogovém okně. Pumplo se objeví na tvé ploše!
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Footer note */}
          <motion.p variants={itemVariants} className="text-center text-xs text-muted-foreground">
            Už máš Pumplo nainstalovanou? Otevři ji z domovské obrazovky!
          </motion.p>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Install;
