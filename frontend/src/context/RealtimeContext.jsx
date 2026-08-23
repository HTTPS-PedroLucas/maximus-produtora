import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { eventsUrl } from '../api';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

/**
 * Mantém a conexão de tempo real com a API. Quando alguém da equipe altera
 * um cliente, uma captação ou um vídeo, todas as abas abertas são avisadas
 * e recarregam os dados daquela tela.
 */
export function RealtimeProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set());

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setConnected(false);
      return undefined;
    }

    const source = new EventSource(eventsUrl(token));

    source.addEventListener('ready', () => setConnected(true));
    source.addEventListener('change', (event) => {
      let payload = {};
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = {};
      }
      for (const listener of listeners.current) listener(payload);
    });
    source.onerror = () => setConnected(false);
    source.onopen = () => setConnected(true);

    return () => {
      source.close();
      setConnected(false);
    };
  }, [token, isAuthenticated]);

  const subscribe = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext) || { connected: false, subscribe: () => () => {} };
}

/**
 * Executa `handler` quando chega um evento de um dos tipos informados.
 * Ex.: useRealtimeEvent(['captures', 'videos'], recarregarAgenda)
 */
export function useRealtimeEvent(types, handler) {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const key = Array.isArray(types) ? types.join('|') : String(types);

  useEffect(() => {
    const wanted = key.split('|').filter(Boolean);
    return subscribe((payload) => {
      if (wanted.length === 0 || wanted.includes(payload.type)) handlerRef.current(payload);
    });
  }, [key, subscribe]);
}
