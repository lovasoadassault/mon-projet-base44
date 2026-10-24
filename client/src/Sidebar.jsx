import { useState } from 'react';
import { api } from './api.js';

const STATUS_LABELS = {
  friends: 'Ami',
  pending_out: 'Demande envoyée',
  pending_in: 'Vous a envoyé une demande',
};

export default function Sidebar({
  user,
  friends,
  requests,
  activeId,
  onOpen,
  onLogout,
  onRefresh,
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState('');

  async function search(e) {
    e.preventDefault();
    setNotice('');
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearched(false);
      return;
    }
    try {
      const d = await api(`/api/users/search?q=${encodeURIComponent(query)}`);
      setResults(d.results);
      setSearched(true);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function addFriend(id) {
    try {
      await api('/api/friends/request', { method: 'POST', body: { userId: id } });
      setNotice('Demande envoyée ✔');
      setResults([]);
      setSearched(false);
      setQ('');
      onRefresh();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function respond(requestId, action) {
    try {
      await api('/api/friends/respond', { method: 'POST', body: { requestId, action } });
      onRefresh();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="avatar">{user.username[0].toUpperCase()}</div>
        <div className="sidebar-header-name" title={user.username}>
          {user.username}
        </div>
        <button className="btn ghost" onClick={onLogout} title="Se déconnecter">
          ⎋
        </button>
      </div>

      <form className="search" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          aria-label="Rechercher un utilisateur"
        />
        <button type="submit" className="btn primary">OK</button>
      </form>
      {notice && <p className="notice">{notice}</p>}

      {searched && (
        <div className="section">
          <h3>Résultats</h3>
          {results.length === 0 && <p className="muted">Aucun utilisateur trouvé.</p>}
          {results.map((r) => (
            <div key={r.id} className="row">
              <div className="avatar small">{r.username[0].toUpperCase()}</div>
              <div className="row-main">{r.username}</div>
              {r.status === 'none' ? (
                <button className="btn primary small" onClick={() => addFriend(r.id)}>
                  + Ajouter
                </button>
              ) : (
                <span className="muted small-text">{STATUS_LABELS[r.status]}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {requests.length > 0 && (
        <div className="section">
          <h3>Demandes d'ami ({requests.length})</h3>
          {requests.map((r) => (
            <div key={r.id} className="row">
              <div className="avatar small">{r.username[0].toUpperCase()}</div>
              <div className="row-main">{r.username}</div>
              <button
                className="btn primary small"
                title="Accepter"
                onClick={() => respond(r.id, 'accept')}
              >
                ✓
              </button>
              <button
                className="btn ghost small"
                title="Refuser"
                onClick={() => respond(r.id, 'decline')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section grow">
        <h3>Amis ({friends.length})</h3>
        {friends.length === 0 && (
          <p className="muted">Ajoutez des amis pour discuter.</p>
        )}
        {friends.map((f) => (
          <button
            key={f.id}
            className={`friend-row ${activeId === f.id ? 'active' : ''}`}
            onClick={() => onOpen(f)}
          >
            <div className={`avatar small ${f.online ? 'online' : ''}`}>
              {f.username[0].toUpperCase()}
            </div>
            <div className="row-main">
              <span className="friend-name">{f.username}</span>
              <span className="friend-last">
                {f.last_message || 'Aucun message'}
              </span>
            </div>
            {f.unread > 0 && <span className="badge">{f.unread}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
