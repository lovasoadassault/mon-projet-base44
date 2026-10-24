import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Flag from './Flag.jsx';

export function userMeta(u) {
  return [
    u.online ? 'An-tserasera' : 'Tsy an-tserasera',
    u.address,
    u.age ? `${u.age} taona` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatWindow({ friend, messages, meId, onSend }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, friend?.id]);

  if (!friend) {
    return (
      <div className="empty-chat">
        <div className="empty-chat-icon">
          <Flag size={80} />
        </div>
        <h2>Tongasoa eto amin'ny « aiza izy » !</h2>
        <p>
          Karohy mpampiasa eo amin'ny sisiny, alefaso fangatahana namana, avy eo
          dia mifanerasera mivantana — maimaim-poana.
        </p>
      </div>
    );
  }

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    onSend(t);
  }

  return (
    <>
      <header className="chat-header">
        <Avatar user={friend} className={friend.online ? 'online' : ''} />
        <div>
          <h2>{friend.username}</h2>
          <span className="status">{userMeta(friend)}</span>
        </div>
      </header>
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.sender_id === meId ? 'mine' : 'theirs'}`}>
            <div className="bubble">{m.body}</div>
            <span className="time">{formatTime(m.created_at)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Hafatra ho an'i ${friend.username}…`}
          aria-label="Hafatra"
          autoFocus
        />
        <button type="submit" disabled={!text.trim()}>
          Alefa
        </button>
      </form>
    </>
  );
}
