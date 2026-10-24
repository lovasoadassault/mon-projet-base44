import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { socket } from './socket.js';
import Sidebar from './Sidebar.jsx';
import ChatWindow from './ChatWindow.jsx';
import Profile from './Profile.jsx';

export default function ChatApp({ user, onLogout, onUserUpdate }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const activeIdRef = useRef(null);

  const refreshFriends = useCallback(
    () => api('/api/friends').then((d) => setFriends(d.friends)).catch(() => {}),
    []
  );
  const refreshRequests = useCallback(
    () => api('/api/requests').then((d) => setRequests(d.requests)).catch(() => {}),
    []
  );
  const refreshAll = useCallback(
    () => {
      refreshFriends();
      refreshRequests();
    },
    [refreshFriends, refreshRequests]
  );

  useEffect(() => {
    refreshAll();
    socket.connect();

    const onConnect = () => {
      refreshFriends();
      if (activeIdRef.current != null) {
        api(`/api/messages/${activeIdRef.current}`)
          .then((d) => setMessages(d.messages))
          .catch(() => {});
      }
    };

    const onMessage = (m) => {
      const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (activeIdRef.current === other) {
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m]
        );
        api('/api/messages/read', { method: 'POST', body: { userId: other } }).catch(
          () => {}
        );
      }
      refreshFriends();
    };

    const onPresence = ({ userId, online }) =>
      setFriends((prev) =>
        prev.map((f) => (f.id === userId ? { ...f, online } : f))
      );

    socket.on('connect', onConnect);
    socket.on('message:new', onMessage);
    socket.on('friend-request', refreshRequests);
    socket.on('friend-updated', refreshAll);
    socket.on('presence', onPresence);

    return () => {
      socket.disconnect();
      socket.off('connect', onConnect);
      socket.off('message:new', onMessage);
      socket.off('friend-request', refreshRequests);
      socket.off('friend-updated', refreshAll);
      socket.off('presence', onPresence);
    };
  }, [user.id, refreshAll, refreshFriends, refreshRequests]);

  const openConversation = useCallback(async (friend) => {
    activeIdRef.current = friend.id;
    setActiveFriend(friend);
    const d = await api(`/api/messages/${friend.id}`);
    setMessages(d.messages);
    setFriends((prev) =>
      prev.map((f) => (f.id === friend.id ? { ...f, unread: 0 } : f))
    );
  }, []);

  const sendMessage = useCallback(async (text) => {
    const to = activeIdRef.current;
    if (to == null) return;
    await api('/api/messages', { method: 'POST', body: { recipientId: to, body: text } });
    // le message apparaît via l'événement temps réel renvoyé à l'expéditeur
  }, []);

  const handleLogout = useCallback(async () => {
    socket.disconnect();
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    onLogout();
  }, [onLogout]);

  const active =
    (activeFriend && friends.find((f) => f.id === activeFriend.id)) || activeFriend;

  return (
    <div className="app">
      <Sidebar
        user={user}
        friends={friends}
        requests={requests}
        activeId={activeFriend ? activeFriend.id : null}
        onOpen={openConversation}
        onLogout={handleLogout}
        onRefresh={refreshAll}
        onOpenProfile={() => setShowProfile(true)}
      />
      <main className="chat">
        <ChatWindow
          friend={active}
          messages={messages}
          meId={user.id}
          onSend={sendMessage}
        />
      </main>
      {showProfile && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={(u) => {
            onUserUpdate?.(u);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
