import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Share, MoreVertical, Plus, Download, Smartphone, Apple, Chrome } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import pumploLogo from '@/assets/pumplo-logo.png';

const Install = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ios');

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Inštalácia Pumplo</h1>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 pb-8 space-y-6"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden shadow-lg bg-[#0D1B2A]">
            <img 
              src={pumploLogo} 
              alt="Pumplo" 
              className="w-full h-full object-contain p-2"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Nainštaluj si Pumplo</h2>
            <p className="text-muted-foreground mt-1">
              Pridaj Pumplo na svoju domovskú obrazovku pre rýchly prístup
            </p>
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div variants={itemVariants}>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Výhody inštalácie
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  Rýchly prístup z domovskej obrazovky
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  Funguje offline – tréningy a história
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  Natívny vzhľad bez adresného riadku
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  Automatické aktualizácie
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Platform Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ios" className="gap-2">
                <Apple className="w-4 h-4" />
                iPhone
              </TabsTrigger>
              <TabsTrigger value="android" className="gap-2">
                <Chrome className="w-4 h-4" />
                Android
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ios" className="mt-4 space-y-4">
              {/* iOS Step 1 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Otvor Safari</h4>
                      <p className="text-sm text-muted-foreground">
                        Uisti sa, že používaš prehliadač Safari. Inštalácia nefunguje v Chrome ani iných prehliadačoch na iOS.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* iOS Step 2 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Klikni na "Zdieľať"</h4>
                      <p className="text-sm text-muted-foreground">
                        V spodnej lište prehliadača nájdi ikonu zdieľania.
                      </p>
                      <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Share className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* iOS Step 3 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">"Pridať na plochu"</h4>
                      <p className="text-sm text-muted-foreground">
                        Prejdi nižšie v menu a vyber možnosť "Pridať na plochu" (Add to Home Screen).
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-medium">Pridať na plochu</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* iOS Step 4 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">4</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Potvrď inštaláciu</h4>
                      <p className="text-sm text-muted-foreground">
                        Klikni "Pridať" v pravom hornom rohu. Pumplo sa objaví na tvojej domovskej obrazovke!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="android" className="mt-4 space-y-4">
              {/* Android Step 1 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Otvor Chrome</h4>
                      <p className="text-sm text-muted-foreground">
                        Pre najlepší zážitok použi prehliadač Google Chrome.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Android Step 2 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Klikni na menu (⋮)</h4>
                      <p className="text-sm text-muted-foreground">
                        V pravom hornom rohu prehliadača nájdi ikonu s tromi bodkami.
                      </p>
                      <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <MoreVertical className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Android Step 3 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">"Nainštalovať aplikáciu"</h4>
                      <p className="text-sm text-muted-foreground">
                        V menu nájdi možnosť "Nainštalovať aplikáciu" alebo "Pridať na plochu".
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                          <Download className="w-5 h-5" />
                        </div>
                        <span className="font-medium">Nainštalovať aplikáciu</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Android Step 4 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">4</span>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Potvrď inštaláciu</h4>
                      <p className="text-sm text-muted-foreground">
                        Klikni "Inštalovať" v dialógovom okne. Pumplo sa nainštaluje ako aplikácia!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Footer Note */}
        <motion.div variants={itemVariants} className="text-center">
          <p className="text-xs text-muted-foreground">
            Už máš Pumplo nainštalovanú? Otvor ju z domovskej obrazovky!
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Install;
