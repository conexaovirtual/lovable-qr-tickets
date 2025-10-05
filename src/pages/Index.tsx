import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Ticket, Package, BarChart3, Shield, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-info py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-white">
            <div className="inline-flex p-4 bg-white/10 backdrop-blur-sm rounded-full mb-6">
              <Ticket className="h-12 w-12" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Help Desk TI Inteligente
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-2xl mx-auto">
              Gestão completa de chamados e ativos com QR Code, SLA e métricas em tempo real
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate('/auth')}
                className="text-lg px-8"
              >
                Começar Agora
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/auth')}
                className="text-lg px-8 bg-white/10 border-white text-white hover:bg-white hover:text-primary"
              >
                Fazer Login
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sistema completo para gerenciar suporte técnico, inventário de equipamentos e acompanhar performance
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary transition-colors bg-gradient-card">
              <CardContent className="pt-6">
                <div className="mb-4 inline-flex p-3 bg-primary/10 rounded-lg">
                  <Ticket className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Gestão de Chamados</h3>
                <p className="text-muted-foreground">
                  Abra, acompanhe e resolva chamados com workflow completo. Priorização automática e SLA integrado.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-success transition-colors bg-gradient-card">
              <CardContent className="pt-6">
                <div className="mb-4 inline-flex p-3 bg-success/10 rounded-lg">
                  <Package className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-bold mb-2">Controle de Ativos</h3>
                <p className="text-muted-foreground">
                  Gerencie equipamentos com QR Code único. Histórico completo e abertura rápida de chamados.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-info transition-colors bg-gradient-card">
              <CardContent className="pt-6">
                <div className="mb-4 inline-flex p-3 bg-info/10 rounded-lg">
                  <BarChart3 className="h-8 w-8 text-info" />
                </div>
                <h3 className="text-xl font-bold mb-2">Relatórios e Métricas</h3>
                <p className="text-muted-foreground">
                  Dashboard com KPIs, SLA, tempo médio de atendimento e relatórios personalizados.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-accent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que escolher nosso Help Desk?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <Package className="h-8 w-8 text-warning" />
              </div>
              <h3 className="font-bold mb-2">QR Code</h3>
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
      <section className="py-20 px-4 bg-gradient-primary text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para transformar seu suporte de TI?
          </h2>
          <p className="text-xl mb-8 text-white/90">
            Comece agora e tenha total controle sobre chamados e ativos
          </p>
          <Button 
            size="lg"
            variant="secondary"
            onClick={() => navigate('/auth')}
            className="text-lg px-12"
          >
            Criar Conta Grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-card border-t">
        <div className="container mx-auto max-w-6xl text-center text-muted-foreground">
          <p>© 2025 Help Desk TI. Sistema de gestão de chamados e ativos.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
