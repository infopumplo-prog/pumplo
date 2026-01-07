import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Dumbbell, Flame, Clock, Trophy } from 'lucide-react';

const statCards = [
  { icon: Flame, label: 'Spálené kalorie', value: '0', color: 'text-warning' },
  { icon: Clock, label: 'Čas cvičení', value: '0 min', color: 'text-primary' },
  { icon: Trophy, label: 'Tréninky', value: '0', color: 'text-success' },
];

const Home = () => {
  const { user } = useAuth();

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
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <div className="gradient-hero px-6 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-muted-foreground text-sm">Ahoj,</p>
          <h1 className="text-2xl font-bold text-foreground">{user?.name || 'Sportovče'} 💪</h1>
        </motion.div>
      </div>

      {/* Content */}
      <motion.div
        className="px-6 py-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Quick Action Card */}
        <motion.div
          variants={itemVariants}
          className="bg-primary rounded-2xl p-6 text-primary-foreground shadow-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">Začít trénink</h2>
              <p className="text-primary-foreground/80 text-sm">Vyber si cvičení a pusť se do toho!</p>
            </div>
            <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
              <Dumbbell className="w-7 h-7" />
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Dnešní statistiky</h3>
          <div className="grid grid-cols-3 gap-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-card border border-border rounded-xl p-4 text-center shadow-card"
                >
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Poslední aktivita</h3>
          <div className="bg-muted/50 rounded-2xl p-8 text-center">
            <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Zatím žádná aktivita</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Začni svůj první trénink!</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
