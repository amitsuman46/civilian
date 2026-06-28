let onUnauthorized = null;
let unauthorizedHandled = false;
let csrfToken = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function resetUnauthorizedGuard() {
  unauthorizedHandled = false;
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function clearCsrfToken() {
  csrfToken = null;
}

async function request(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isLogin = url.includes('/api/login');
  const headers = { ...(options.headers || {}) };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !isLogin && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(url, { credentials: 'include', ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: 'Server error.' };
  }

  if (res.status === 401 && onUnauthorized && !unauthorizedHandled) {
    unauthorizedHandled = true;
    clearCsrfToken();
    onUnauthorized(data.message || 'Unauthorized');
  }

  return data;
}

const API = {
  get(url) {
    return request(url);
  },
  post(url, body) {
    const isForm = body instanceof FormData;
    return request(url, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
  },
  put(url, body) {
    const isForm = body instanceof FormData;
    return request(url, {
      method: 'PUT',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
  },
  patch(url, body) {
    return request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  delete(url, body) {
    return request(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
};

export default API;
