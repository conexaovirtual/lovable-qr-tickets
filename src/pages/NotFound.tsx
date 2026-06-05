import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Ticket, ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <img src="/logo-conexaovirtual.png" alt="Conexão Virtual" className="h-16 w-auto object-contain opacity-80" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <SearchX className="h-9 w-9 text-muted-foreground" />
          </div>
          <span className="text-6xl font-bold text-primary/20 leading-none select-none">404</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A página que você procura não existe ou foi movida.
            <br />
            Use os atalhos abaixo para continuar navegando.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button onClick={() => navigate("/tickets")} variant="outline" className="gap-2">
            <Ticket className="h-4 w-4" />
            Chamados
          </Button>
        </div>
      </div>
    </div>
  );
}
