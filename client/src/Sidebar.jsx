import { useState } from 'react';
import { api } from './api.js';

const STATUS_LABELS = {
  friends: 'Namana',
  pending_out: 'Voalefa ny fangatahana',
  pending_in: 'Nandefa fangatahana taminao',
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
      setNotice('Voalefa ny fangatahana ✔');
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
        <button className="btn ghost" onClick={onLogout} title="Hivoaka">
          ⎋
        </button>
      </div>

      <form className="search" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Karohy mpampiasa…"
          aria-label="Karohy mpampiasa"
        />
        <button type="submit" className="btn primary">OK</button>
      </form>
      {notice && <p className="notice">{notice}</p>}

      {searched && (
        <div className="section">
          <h3>Valiny</h3>
          {results.length === 0 && <p className="muted">Tsy nisy mpampiasa hita.</p>}
          {results.map((r) => (
            <div key={r.id} className="row">
              <div className="avatar small">{r.username[0].toUpperCase()}</div>
              <div className="row-main">{r.username}</div>
              {r.status === 'none' ? (
                <button className="btn primary small" onClick={() => addFriend(r.id)}>
                  + Ampio
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
          <h3>Fangatahana namana ({requests.length})</h3>
          {requests.map((r) => (
            <div key={r.id} className="row">
              <div className="avatar small">{r.username[0].toUpperCase()}</div>
              <div className="row-main">{r.username}</div>
              <button
                className="btn primary small"
                title="Ekeo"
                onClick={() => respond(r.id, 'accept')}
              >
                ✓
              </button>
              <button
                className="btn ghost small"
                title="Lavina"
                onClick={() => respond(r.id, 'decline')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section grow">
        <h3>Namana ({friends.length})</h3>
        {friends.length === 0 && (
          <p className="muted">Ampio namana mba hiresaka.</p>
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
                {f.last_message || 'Tsy misy hafatra'}
              </span>
            </div>
            {f.unread > 0 && <span className="badge">{f.unread}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
