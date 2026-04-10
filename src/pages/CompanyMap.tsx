import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin,
  Building2,
  Loader2,
  Navigation,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const contractIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const eventualIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const inactiveIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Company {
  id: string;
  nome_fantasia: string;
  endereco: string | null;
  latitude: number;
  longitude: number;
  tipo_contrato: string;
  status: boolean;
  telefone: string | null;
  email: string | null;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

type FilterType = 'all' | 'contrato' | 'eventual';

export default function CompanyMap() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const canAccess = profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (!authLoading) {
      if (!profile) navigate('/auth');
      else if (!canAccess) navigate('/dashboard');
    }
  }, [profile, navigate, authLoading, canAccess]);

  useEffect(() => {
    if (profile && canAccess) loadCompanies();
  }, [profile, canAccess]);

  const loadCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('id, nome_fantasia, endereco, latitude, longitude, tipo_contrato, status, telefone, email')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('nome_fantasia');

    if (error) {
      toast({ title: 'Erro ao carregar empresas', description: error.message, variant: 'destructive' });
    } else {
      setCompanies((data as Company[]) || []);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return companies;
    if (filter === 'contrato') return companies.filter(c => c.tipo_contrato === 'contrato_manutencao');
    return companies.filter(c => c.tipo_contrato !== 'contrato_manutencao');
  }, [companies, filter]);

  const positions = useMemo(
    () => filtered.map(c => [c.latitude, c.longitude] as [number, number]),
    [filtered]
  );

  const totalWithLocation = companies.length;
  const contratoCount = companies.filter(c => c.tipo_contrato === 'contrato_manutencao').length;
  const eventualCount = companies.filter(c => c.tipo_contrato !== 'contrato_manutencao').length;
  const activeCount = companies.filter(c => c.status).length;

  const defaultCenter: [number, number] = positions.length > 0
    ? [
        positions.reduce((s, p) => s + p[0], 0) / positions.length,
        positions.reduce((s, p) => s + p[1], 0) / positions.length,
      ]
    : [-15.7801, -47.9292]; // Brasília fallback

  if (authLoading || !profile || !canAccess) return null;

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={MapPin}
        title="Mapa de Empresas"
        subtitle="Visualize a localização de todos os seus clientes"
      />

      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('all')}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${filter === 'all' ? 'text-primary' : ''}`}>{totalWithLocation}</p>
              <p className="text-xs text-muted-foreground">Total no Mapa</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('contrato')}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold text-green-600 ${filter === 'contrato' ? 'underline' : ''}`}>{contratoCount}</p>
              <p className="text-xs text-muted-foreground">Contrato</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('eventual')}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold text-blue-600 ${filter === 'eventual' ? 'underline' : ''}`}>{eventualCount}</p>
              <p className="text-xs text-muted-foreground">Eventual</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtro:</span>
          {(['all', 'contrato', 'eventual'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="h-7 text-xs"
            >
              {f === 'all' ? 'Todas' : f === 'contrato' ? '🟢 Contrato' : '🔵 Eventual'}
            </Button>
          ))}
          <Badge variant="secondary" className="ml-auto">
            {filtered.length} empresas visíveis
          </Badge>
        </div>

        {/* Map */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                <MapPin className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhuma empresa com localização GPS</p>
                <p className="text-xs mt-1">Edite as empresas e capture a localização GPS no cadastro.</p>
              </div>
            ) : (
              <div className="h-[500px] md:h-[600px]">
                <MapContainer
                  center={defaultCenter}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds positions={positions} />
                  {filtered.map((company) => (
                    <Marker
                      key={company.id}
                      position={[company.latitude, company.longitude]}
                      icon={
                        !company.status
                          ? inactiveIcon
                          : company.tipo_contrato === 'contrato_manutencao'
                          ? contractIcon
                          : eventualIcon
                      }
                    >
                      <Popup>
                        <div className="min-w-[200px] space-y-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                            <strong className="text-sm">{company.nome_fantasia}</strong>
                          </div>
                          {company.endereco && (
                            <p className="text-xs text-gray-600">{company.endereco}</p>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                              company.tipo_contrato === 'contrato_manutencao'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {company.tipo_contrato === 'contrato_manutencao' ? 'Contrato' : 'Eventual'}
                            </span>
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                              company.status ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {company.status ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          {company.telefone && (
                            <p className="text-xs">📞 {company.telefone}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${company.latitude},${company.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <Navigation className="h-3 w-3" /> Navegar
                            </a>
                            <a
                              href={`/companies/${company.id}`}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="h-3 w-3" /> Detalhes
                            </a>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground justify-center">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            Contrato
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            Eventual
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-gray-400" />
            Inativo
          </div>
        </div>
      </main>
    </div>
  );
}
