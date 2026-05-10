// Thin fetch wrapper — all requests go through Vite proxy to localhost:3001
const API = {
  async get(url) {
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  },
  async post(url, body) {
    const isForm = body instanceof FormData;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
    return res.json();
  },
  async put(url, body) {
    const isForm = body instanceof FormData;
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
    return res.json();
  },
  async patch(url, body) {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  async delete(url, body) {
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  },
};

export default API;
