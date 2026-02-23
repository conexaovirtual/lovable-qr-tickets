import { useState, useCallback } from 'react';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

interface UseGeolocationReturn {
  position: GeoPosition | null;
  loading: boolean;
  error: string | null;
  captureLocation: () => Promise<GeoPosition | null>;
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureLocation = useCallback(async (): Promise<GeoPosition | null> => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada neste navegador');
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          setPosition(geoPos);
          setLoading(false);
          resolve(geoPos);
        },
        (err) => {
          let message = 'Erro ao obter localização';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              message = 'Permissão de localização negada';
              break;
            case err.POSITION_UNAVAILABLE:
              message = 'Localização indisponível';
              break;
            case err.TIMEOUT:
              message = 'Tempo esgotado ao obter localização';
              break;
          }
          setError(message);
          setLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  return { position, loading, error, captureLocation };
}
