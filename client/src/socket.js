import { io } from 'socket.io-client';

// autoConnect: false — on se connecte seulement une fois authentifié
// (ChatApp appelle socket.connect() au montage, avec le cookie de session)
export const socket = io({ withCredentials: true, autoConnect: false });
