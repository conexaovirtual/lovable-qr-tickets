import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Ticket, 
  Package, 
  QrCode, 
  Clock, 
  BarChart3, 
  Shield,
  Zap,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && profile) {
      navigate('/dashboard');
    }
  }, [profile, loading, navigate]);

  const features = [
    {
      icon: Ticket,
      title: 'Gestão de Chamados',
      description: 'Sistema completo para abertura e acompanhamento de chamados técnicos com workflow inteligente',
      color: 'primary',
    },
    {
      icon: QrCode,
      title: 'QR Code por Ativo',
      description: 'Abra chamados rapidamente escaneando o QR Code do equipamento',
      color: 'success',
    },
    {
      icon: Clock,
      title: 'Controle de SLA',
      description: 'Acompanhe prazos de atendimento e solução em tempo real com alertas automáticos',
      color: 'warning',
    },
    {
      icon: Package,
      title: 'Gestão de Ativos',
      description: 'Inventário completo de equipamentos e patrimônio com histórico detalhado',
      color: 'info',
    },
    {
      icon: BarChart3,
      title: 'Relatórios e Dashboards',
      description: 'Métricas e indicadores para melhor tomada de decisão',
      color: 'primary',
    },
    {
      icon: Shield,
      title: 'Multi-empresa',
      description: 'Isolamento total de dados entre diferentes empresas clientes',
      color: 'success',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6 animate-fade-in">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Sistema Profissional de Help Desk</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
              Help Desk TI com{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                QR Code e Gestão de Ativos
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 animate-fade-in">
              Plataforma completa para gerenciar chamados técnicos, controlar SLA e 
              manter inventário atualizado de equipamentos
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Button size="lg" onClick={() => navigate('/auth')}>
                Acessar Sistema
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
                Criar Conta
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Funcionalidades completas para gestão profissional de TI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="hover:shadow-lg transition-all hover-scale border-2"
              >
                <CardContent className="pt-6">
                  <div className={`h-12 w-12 rounded-lg bg-${feature.color}/10 flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-6 w-6 text-${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-accent/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que escolher nosso Help Desk?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="mb-4 inline-flex p-4 bg-primary/10 rounded-full">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-bold mb-2">Multi-empresa</h3>
              <p className="text-sm text-muted-foreground">
                Isolamento completo de dados por cliente
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 inline-flex p-4 bg-success/10 rounded-full">
                <Clock className="h-8 w-8 text-success" />
              </div>
              <h3 className="font-bold mb-2">SLA Automático</h3>
              <p className="text-sm text-muted-foreground">
                Cálculo e alertas de prazo em tempo real
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 inline-flex p-4 bg-warning/10 rounded-full">
                <QrCode className="h-8 w-8 text-warning" />
              </div>
              <h3 className="font-bold mb-2">QR Code Inteligente</h3>
              <p className="text-sm text-muted-foreground">
                Abertura instantânea via leitura de código
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 inline-flex p-4 bg-info/10 rounded-full">
                <CheckCircle className="h-8 w-8 text-info" />
              </div>
              <h3 className="font-bold mb-2">Mobile First</h3>
              <p className="text-sm text-muted-foreground">
                Acesso completo de qualquer dispositivo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 max-w-3xl mx-auto">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">
                Pronto para começar?
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Acesse agora e comece a gerenciar seus chamados e ativos de forma profissional
              </p>
              <Button size="lg" onClick={() => navigate('/auth')}>
                Acessar Sistema
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Help Desk TI. Sistema profissional de gestão de chamados técnicos.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
