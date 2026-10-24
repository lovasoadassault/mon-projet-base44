import { useRef, useState } from 'react';
import { api } from './api.js';
import Avatar from './Avatar.jsx';

// Redimensionne la sary en carré 256px (JPEG) mba tsy ho leve loatra
async function fileToDataUrl(file) {
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = raw;
  });
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function Profile({ user, onClose, onSaved }) {
  const [username, setUsername] = useState(user.username);
  const [address, setAddress] = useState(user.address || '');
  const [age, setAge] = useState(user.age ?? '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Tsy sary io rakitra io');
      return;
    }
    try {
      setAvatar(await fileToDataUrl(file));
      setError('');
    } catch {
      setError('Tsy voafehy ny sary');
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let saved = user;
      if (avatar !== (user.avatar || '')) {
        const d = await api('/api/avatar', { method: 'POST', body: { avatar } });
        saved = d.user;
      }
      const ageChanged = String(age ?? '') !== String(user.age ?? '');
      if (
        username !== user.username ||
        address !== (user.address || '') ||
        ageChanged
      ) {
        const d = await api('/api/profile', {
          method: 'POST',
          body: {
            username,
            address,
            age: age === '' || age == null ? null : Number(age),
          },
        });
        saved = d.user;
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Mombamomba ahy</h2>
        <form onSubmit={save}>
          {error && <div className="error-box">{error}</div>}

          <div className="avatar-edit">
            <Avatar user={{ username, avatar }} className="big" />
            <div className="avatar-edit-actions">
              <button
                type="button"
                className="btn primary small"
                onClick={() => fileRef.current?.click()}
              >
                Hanova sary
              </button>
              {avatar && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setAvatar('')}
                >
                  Esory
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={pickPhoto}
              />
            </div>
          </div>

          <label className="field">
            Anarana
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label="Anarana"
            />
            <span className="hint">Azo ovaina indroa isam-bolana fara-fahakeliny.</span>
          </label>

          <label className="field">
            Toerana
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Oh: Antananarivo"
              aria-label="Toerana"
            />
          </label>

          <label className="field">
            Taona
            <input
              type="number"
              min="1"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Oh: 25"
              aria-label="Taona"
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Akatona
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? '…' : 'Tehirizo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
