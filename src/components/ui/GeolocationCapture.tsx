import { MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
        <div className="text-xs text-muted-foreground">
          📍 Lat: {position.latitude.toFixed(6)} | Lng: {position.longitude.toFixed(6)}
          {position.accuracy && ` | Precisão: ${Math.round(position.accuracy)}m`}
        </div>
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
