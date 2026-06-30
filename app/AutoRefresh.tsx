'use client';

import { useEffect, useState } from 'react';

const REFRESH_EVERY_MS = 5 * 60 * 1000;

export default function AutoRefresh() {
  const [lastRefresh, setLastRefresh] = useState<string>('');

  useEffect(() => {
    setLastRefresh(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    const timer = window.setInterval(() => {
      window.location.reload();
    }, REFRESH_EVERY_MS);

    return () => window.clearInterval(timer);
  }, []);

  return <p className="muted auto-refresh-note">
    Atualização automática ativa a cada 5 minutos. Última atualização: {lastRefresh || '-'}.
  </p>;
}
