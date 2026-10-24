import { useEffect, useState } from 'react';
import { api } from './api.js';
import Auth from './Auth.jsx';
import ChatApp from './ChatApp.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen">Chargement…</div>;

  return user ? (
    <ChatApp user={user} onLogout={() => setUser(null)} />
  ) : (
    <Auth onLogin={setUser} />
  );
}
