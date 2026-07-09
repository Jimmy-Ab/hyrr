import { useJobStore } from '../store/useJobStore';

const BASE_URL = 'http://localhost:3000/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Bearer access token
  if (!options.skipAuth) {
    const token = useJobStore.getState().accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
  };

  if (!options.skipAuth) {
    // Crucial for silent HTTP-only refresh cookie
    finalOptions.credentials = 'include';
  }

  try {
    const response = await fetch(url, finalOptions);

    if (response.status === 401 && !options.skipAuth) {
      // Access token expired, attempt silent token refresh
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              headers.set('Authorization', `Bearer ${token}`);
              return fetch(url, finalOptions).then(handleResponse);
            }
            throw new Error('Unauthorized');
          });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshResponse.ok) {
          throw new Error('Refresh failed');
        }

        const data = await refreshResponse.json();
        useJobStore.getState().setAccessToken(data.accessToken);

        processQueue(null, data.accessToken);
        isRefreshing = false;

        headers.set('Authorization', `Bearer ${data.accessToken}`);
        return fetch(url, finalOptions).then(handleResponse);
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        useJobStore.getState().logout();
        throw err;
      }
    }

    return await handleResponse(response);
  } catch (err) {
    throw err;
  }
}

async function handleResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: (data && data.message) || response.statusText || 'Request failed',
    };
  }

  return data;
}
