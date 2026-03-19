import { useEffect } from 'react';

export default function DattoCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code && window.opener) {
      window.opener.postMessage({ type: 'datto-oauth-callback', code }, window.location.origin);
      window.close();
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Processando autorização do Datto RMM...</p>
        <p className="text-xs text-muted-foreground">Esta janela será fechada automaticamente.</p>
      </div>
    </div>
  );
}
