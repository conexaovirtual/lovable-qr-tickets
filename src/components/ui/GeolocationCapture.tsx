import { MapPin, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GeoPosition } from '@/hooks/useGeolocation';

interface GeolocationCaptureProps {
  label: string;
  position: GeoPosition | null;
  loading: boolean;
  error: string | null;
  onCapture: () => void;
  disabled?: boolean;
}

function StaticMapPreview({ latitude, longitude }: { latitude: number; longitude: number }) {
  const zoom = 16;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.003},${latitude - 0.002},${longitude + 0.003},${latitude + 0.002}&layer=mapnik&marker=${latitude},${longitude}`;
  const linkUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`;

  return (
    <div className="relative rounded-md overflow-hidden border bg-muted">
      <iframe
        title="Localização GPS"
        src={mapUrl}
        className="w-full h-[120px] pointer-events-none"
        loading="lazy"
      />
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-1 right-1 flex items-center gap-1 text-[10px] bg-background/80 backdrop-blur-sm text-foreground px-1.5 py-0.5 rounded shadow-sm hover:bg-background transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir mapa
      </a>
    </div>
  );
}

export function GeolocationCapture({
  label,
  position,
  loading,
  error,
  onCapture,
  disabled,
}: GeolocationCaptureProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          {label}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCapture}
          disabled={disabled || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Capturando...
            </>
          ) : position ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
              Recapturar
            </>
          ) : (
            <>
              <MapPin className="h-3 w-3 mr-1" />
              Capturar GPS
            </>
          )}
        </Button>
      </div>

      {position && (
        <>
          <StaticMapPreview latitude={position.latitude} longitude={position.longitude} />
          <div className="text-xs text-muted-foreground">
            📍 Lat: {position.latitude.toFixed(6)} | Lng: {position.longitude.toFixed(6)}
            {position.accuracy && ` | Precisão: ${Math.round(position.accuracy)}m`}
          </div>
        </>
      )}

      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
