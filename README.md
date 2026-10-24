# ChatLibre

Messagerie instantanée temps réel : inscrivez-vous, ajoutez des amis et discutez
gratuitement en direct.

## Stack

- **Client** : React + Vite (`client/`), dev server sur le port 3000
- **Serveur** : Node.js + Express + Socket.IO (`server/`), API REST + temps réel
- **Base** : SQLite (`better-sqlite3`), stockée dans `/data/chat.db`

Le client passe par le proxy du dev server Vite (chemins `/api` et `/socket.io`),
donc tout est servi depuis une seule origine (cookies de session same-origin).

## Fonctionnalités

- Inscription / connexion (cookie de session signé JWT, mots de passe hachés bcrypt)
- Recherche d'utilisateurs, demandes d'ami (accepter / refuser)
- Messages persistés, livraison temps réel via Socket.IO
- Badge de messages non lus, présence en ligne / hors ligne
- Une conversation ne peut démarrer qu'entre amis confirmés

## Développement local

```bash
cd server && npm install && JWT_SECRET=dev npm run dev   # API sur :4000
cd client && npm install && npm run dev                  # UI sur :3000
```

Ou avec l'environnement Base44 : `docker compose -f docker-compose.base44.yml up -d`
(voir SETUP.md).
