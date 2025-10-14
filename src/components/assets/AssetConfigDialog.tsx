import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, MemoryStick, HardDrive, Monitor, Wifi } from 'lucide-react';

interface AssetConfigDialogProps {
  asset: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetConfigDialog({ asset, open, onOpenChange }: AssetConfigDialogProps) {
  if (!asset?.configuracoes) return null;

  const config = asset.configuracoes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configuração Técnica</DialogTitle>
          <DialogDescription>
            {asset.fabricante} {asset.modelo} - {asset.numero_serie}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {config.processador && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Processador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{config.processador}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                    {config.processador_cores && <div>Cores: {config.processador_cores}</div>}
                    {config.processador_threads && <div>Threads: {config.processador_threads}</div>}
                    {config.processador_ghz && <div>Frequência: {config.processador_ghz} GHz</div>}
                  </div>
                </CardContent>
              </Card>
            )}

            {config.memoria_ram_gb && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MemoryStick className="h-4 w-4" />
                    Memória RAM
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">
                    {config.memoria_ram_gb} GB {config.memoria_ram_tipo}
                  </p>
                  {config.memoria_ram_slots && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Slots: {config.memoria_ram_slots}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {config.armazenamento_principal_gb && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Armazenamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">
                        Principal: {config.armazenamento_principal_gb} GB {config.armazenamento_principal_tipo}
                      </p>
                    </div>
                    {config.armazenamento_secundario_gb && (
                      <div>
                        <p className="text-sm">
                          Secundário: {config.armazenamento_secundario_gb} GB {config.armazenamento_secundario_tipo}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {config.placa_video && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Placa de Vídeo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{config.placa_video}</p>
                  {config.placa_video_memoria_gb && (
                    <p className="text-sm text-muted-foreground mt-1">
                      VRAM: {config.placa_video_memoria_gb} GB
                    </p>
                  )}
                  {config.placa_video_integrada && (
                    <p className="text-sm text-muted-foreground">Integrada</p>
                  )}
                </CardContent>
              </Card>
            )}

            {(config.tela_polegadas || config.tela_resolucao) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Display
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    {config.tela_polegadas && <p>Tamanho: {config.tela_polegadas}"</p>}
                    {config.tela_resolucao && <p>Resolução: {config.tela_resolucao}</p>}
                    {config.tela_touchscreen && <p>Touchscreen</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {(config.rede_ethernet !== undefined || config.rede_wifi !== undefined) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Conectividade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    {config.rede_ethernet && <p>✓ Ethernet</p>}
                    {config.rede_wifi && (
                      <p>✓ Wi-Fi {config.rede_wifi_standard && `(${config.rede_wifi_standard})`}</p>
                    )}
                    {config.rede_bluetooth && <p>✓ Bluetooth</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {asset.sistema_operacional && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Sistema Operacional</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{asset.sistema_operacional}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
