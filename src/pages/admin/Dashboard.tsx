import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Dumbbell, UserCheck, TrendingUp, Bell, BellRing } from 'lucide-react';
import { useTrainingNotifications } from '@/hooks/useTrainingNotifications';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';

interface Stats {
  totalUsers: number;
  completedOnboarding: number;
  totalMachines: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    completedOnboarding: 0,
    totalMachines: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const { 
    isSupported, 
    notificationPermission, 
    requestPermission, 
    sendTestNotification 
  } = useTrainingNotifications();

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch user count
      const { count: userCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch completed onboarding count
      const { count: completedCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('onboarding_completed', true);

      // Fetch machines count
      const { count: machineCount } = await supabase
        .from('machines')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: userCount || 0,
        completedOnboarding: completedCount || 0,
        totalMachines: machineCount || 0,
      });
      setIsLoading(false);
    };

    fetchStats();
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('Notifikace povoleny!');
    } else {
      toast.error('Notifikace nebyly povoleny');
    }
  };

  const handleTestNotification = (type: 'morning' | 'missed' | 'closing') => {
    if (notificationPermission !== 'granted') {
      toast.error('Nejprve povol notifikace');
      return;
    }
    sendTestNotification(type);
    toast.success('Testovací notifikace odeslána');
  };

  const statCards = [
    {
      title: 'Celkom používateľov',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Dokončený onboarding',
      value: stats.completedOnboarding,
      icon: UserCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Strojov v databáze',
      value: stats.totalMachines,
      icon: Dumbbell,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Miera dokončenia',
      value: stats.totalUsers > 0 
        ? `${Math.round((stats.completedOnboarding / stats.totalUsers) * 100)}%`
        : '0%',
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

        <div className="grid grid-cols-2 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isLoading ? '...' : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Notification Testing Section */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BellRing className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Testování notifikací</h3>
          </div>
          
          {!isSupported ? (
            <p className="text-sm text-muted-foreground">
              Notifikace nejsou v tomto prohlížeči podporovány.
            </p>
          ) : notificationPermission !== 'granted' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pro testování notifikací je potřeba povolit oprávnění.
              </p>
              <Button onClick={handleRequestPermission} variant="outline" className="w-full">
                <Bell className="w-4 h-4 mr-2" />
                Povolit notifikace
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Notifikace povoleny. Klikni pro odeslání testovací notifikace:
              </p>
              <Button 
                onClick={() => handleTestNotification('morning')}
                variant="outline" 
                className="w-full justify-start"
              >
                <Bell className="w-4 h-4 mr-2" />
                Ranní připomínka
              </Button>
              <Button 
                onClick={() => handleTestNotification('missed')}
                variant="outline"
                className="w-full justify-start"
              >
                <Bell className="w-4 h-4 mr-2" />
                Zmeškaný trénink
              </Button>
              <Button 
                onClick={() => handleTestNotification('closing')}
                variant="outline"
                className="w-full justify-start"
              >
                <Bell className="w-4 h-4 mr-2" />
                Zavírá brzy (se streakem)
              </Button>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
