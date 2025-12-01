import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState } from 'react';
import { toast } from 'sonner';

export const NotificationPermissionPrompt = () => {
  const { permission, isLoading, requestPermission, subscribeToPush } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);

  const handleEnable = async () => {
    try {
      const result = await requestPermission();
      
      if (result === 'granted') {
        const sub = await subscribeToPush();
        if (sub) {
          toast.success('Notificações ativadas com sucesso!');
          setIsDismissed(true);
        } else {
          toast.error('Erro ao configurar notificações');
        }
      } else if (result === 'denied') {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
        setIsDismissed(true);
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('Erro ao ativar notificações');
    }
  };

  if (permission === 'granted' || isDismissed) {
    return null;
  }

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Ativar Notificações Push</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Receba alertas instantâneos sobre chamados via QR Code e ordens de serviço agendadas.
          </p>
          <div className="flex gap-2 mt-3">
            <Button 
              onClick={handleEnable} 
              size="sm"
              disabled={isLoading}
            >
              <Bell className="h-4 w-4 mr-2" />
              {isLoading ? 'Ativando...' : 'Ativar Notificações'}
            </Button>
            <Button 
              onClick={() => setIsDismissed(true)} 
              size="sm"
              variant="ghost"
            >
              Agora não
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
