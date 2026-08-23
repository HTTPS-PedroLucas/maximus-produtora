import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const TOKEN_KEY = 'maximus_token';

export const api = axios.create({ baseURL: `${API_URL}/api` });

/** Converte um caminho salvo no banco (/uploads/...) em URL utilizável. */
export const assetUrl = (path) => (path ? `${API_URL}${path}` : '');

/** URL do canal de tempo real (SSE), que recebe o token pela query string. */
export const eventsUrl = (token) => `${API_URL}/api/events?token=${encodeURIComponent(token)}`;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if ((status === 401 || status === 403) && !window.location.pathname.startsWith('/login')) {
      const inactive = error?.response?.data?.error?.includes('inativo');
      if (status === 401 || inactive) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Mensagem amigável para qualquer erro vindo da API. */
export function errorMessage(err, fallback = 'Algo deu errado. Tente novamente.') {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.code === 'ERR_NETWORK') return 'Não foi possível falar com o servidor. Verifique sua conexão.';
  return fallback;
}

/** Erros por campo devolvidos pela validação da API. */
export function fieldErrors(err) {
  return err?.response?.data?.errors || {};
}

/** Envia uma imagem para o bucket indicado e devolve a URL salva. */
export async function uploadImage(file, bucket = 'videos') {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/uploads/${bucket}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export default api;
