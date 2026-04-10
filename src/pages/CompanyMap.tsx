import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, Filter } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Company {
  id: string;
  nome_fantasia: string;
  endereco: string | null;
  latitude: number;
  longitude: number;
  tipo_contrato: string;
  status: boolean | null;
  telefone: string | null;
  email: string | null;
}

type FilterType = 'all' | 'contrato' | 'eventual';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export default function CompanyMap() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const canAccess = profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!profile) navigate('/auth');
      else if (!canAccess) navigate('/dashboard');
    }
  }, [profile, navigate, authLoading, canAccess]);

  const loadCompanies = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    if (profile && canAccess) {
      void loadCompanies();
    }
  }, [profile, canAccess, loadCompanies]);

  const filtered = useMemo(() => {
    if (filter === 'all') return companies;
    if (filter === 'contrato') return companies.filter((company) => company.tipo_contrato === 'contrato_manutencao');
    return companies.filter((company) => company.tipo_contrato !== 'contrato_manutencao');
  }, [companies, filter]);

  const defaultCenter = useMemo<[number, number]>(() => {
    if (filtered.length === 0) return [-15.7801, -47.9292];

    const latitude = filtered.reduce((sum, company) => sum + company.latitude, 0) / filtered.length;
    const longitude = filtered.reduce((sum, company) => sum + company.longitude, 0) / filtered.length;

    return [latitude, longitude];
  }, [filtered]);

  const createMarkerIcon = useCallback((company: Company) => {
    const color = !company.status
      ? 'hsl(var(--muted-foreground))'
      : company.tipo_contrato === 'contrato_manutencao'
        ? 'hsl(var(--success))'
        : 'hsl(var(--info))';

    return L.divIcon({
      className: 'company-map-marker',
      html: `
        <div style="position: relative; width: 18px; height: 18px;">
          <div style="width: 18px; height: 18px; border-radius: 9999px; background: ${color}; border: 3px solid white; box-shadow: 0 6px 16px rgba(0,0,0,0.28);"></div>
        </div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }, []);

  const createPopupHtml = useCallback((company: Company) => {
    const contractLabel = company.tipo_contrato === 'contrato_manutencao' ? 'Contrato' : 'Eventual';
    const contractColor = company.tipo_contrato === 'contrato_manutencao' ? 'hsl(var(--success))' : 'hsl(var(--info))';
    const statusLabel = company.status ? 'Ativo' : 'Inativo';
    const statusColor = company.status ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))';

    return `
      <div style="min-width: 220px; color: hsl(var(--foreground)); font-family: inherit;">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">${escapeHtml(company.nome_fantasia)}</div>
        ${company.endereco ? `<div style="font-size: 12px; color: hsl(var(--muted-foreground)); margin-bottom: 8px;">${escapeHtml(company.endereco)}</div>` : ''}
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <span style="font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: ${contractColor}; color: white;">${contractLabel}</span>
          <span style="font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: ${statusColor}; color: white;">${statusLabel}</span>
        </div>
        ${company.telefone ? `<div style="font-size: 12px; margin-bottom: 8px;">📞 ${escapeHtml(company.telefone)}</div>` : ''}
        <div style="display: flex; gap: 12px; align-items: center;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${company.latitude},${company.longitude}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: hsl(var(--primary)); text-decoration: none; font-weight: 600;">Navegar</a>
          <a href="/companies/${company.id}" style="font-size: 12px; color: hsl(var(--primary)); text-decoration: none; font-weight: 600;">Detalhes</a>
        </div>
      </div>
    `;
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      preferCanvas: true,
    }).setView(defaultCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      markersLayerRef.current?.clearLayers();
      markersLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [defaultCenter]);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (filtered.length === 0) {
      map.setView(defaultCenter, 11);
      return;
    }

    const bounds = L.latLngBounds(filtered.map((company) => [company.latitude, company.longitude] as [number, number]));

    filtered.forEach((company) => {
      L.marker([company.latitude, company.longitude], {
        icon: createMarkerIcon(company),
      })
        .bindPopup(createPopupHtml(company))
        .addTo(markersLayer);
    });

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [filtered, defaultCenter, createMarkerIcon, createPopupHtml]);

  const totalWithLocation = companies.length;
  const contratoCount = companies.filter((company) => company.tipo_contrato === 'contrato_manutencao').length;
  const eventualCount = companies.filter((company) => company.tipo_contrato !== 'contrato_manutencao').length;
  const activeCount = companies.filter((company) => company.status).length;

  if (authLoading || !profile || !canAccess) return null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        icon={MapPin}
        title="Mapa de Empresas"
        subtitle="Visualize a localização de todos os seus clientes"
      />

      <main className="container mx-auto space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setFilter('all')}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${filter === 'all' ? 'text-primary' : 'text-foreground'}`}>{totalWithLocation}</p>
              <p className="text-xs text-muted-foreground">Total no mapa</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setFilter('contrato')}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${filter === 'contrato' ? 'underline text-[hsl(var(--success))]' : 'text-[hsl(var(--success))]'}`}>{contratoCount}</p>
              <p className="text-xs text-muted-foreground">Contrato</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setFilter('eventual')}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${filter === 'eventual' ? 'underline text-[hsl(var(--info))]' : 'text-[hsl(var(--info))]'}`}>{eventualCount}</p>
              <p className="text-xs text-muted-foreground">Eventual</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtro:</span>
          {(['all', 'contrato', 'eventual'] as FilterType[]).map((item) => (
            <Button
              key={item}
              variant={filter === item ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(item)}
              className="h-7 text-xs"
            >
              {item === 'all' ? 'Todas' : item === 'contrato' ? 'Contrato' : 'Eventual'}
            </Button>
          ))}
          <Badge variant="secondary" className="ml-auto">
            {filtered.length} empresas visíveis
          </Badge>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="relative p-0">
            {loading && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-card/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            <div ref={mapContainerRef} className="h-[500px] w-full md:h-[600px]" />

            {!loading && filtered.length === 0 && (
              <div className="absolute inset-0 z-[450] flex flex-col items-center justify-center gap-2 bg-card/85 text-center backdrop-blur-sm">
                <MapPin className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Nenhuma empresa com localização GPS</p>
                <p className="text-xs text-muted-foreground">Edite as empresas e capture a localização no cadastro.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--success))]" />
            Contrato
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--info))]" />
            Eventual
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--muted-foreground))]" />
            Inativo
          </div>
        </div>
      </main>
    </div>
  );
}
