// server.js (Node.js)
const express = require('express');
const { createServer } = require('http');
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 8080;
const sessions = new Map(); // Menggunakan Map lebih hemat memori dibanding Object biasa

app.get('/', (req, res) => res.send('⚽ Server Active'));

io.on('connection', (socket) => {
    socket.on('register_host', (sid) => {
        sessions.set(sid, { host: socket.id, client: null });
        socket.join(sid);
        console.log(`H:${sid}`);
    });

    socket.on('join_session', (sid) => {
        const session = sessions.get(sid);
        if (session) {
            session.client = socket.id;
            socket.join(sid);
            io.to(session.host).emit('client_connected', "START");
            console.log(`C:${sid} -> Start Sent`);
        }
    });

    socket.on('send_kick', (data) => {
        // Broadcast ke room saja lebih ringan daripada mencari ID manual
        for (const [sid, s] of sessions) {
            if (s.client === socket.id) {
                io.to(s.host).emit('receive_kick', data);
                break;
            }
        }
    });

    socket.on('score_update', (s) => io.emit('score_update', s));
    socket.on('shot_result', (r) => io.emit('shot_result', r));
    socket.on('game_over', (f) => io.emit('game_over', f));

    socket.on('disconnect', () => {
        for (const [sid, s] of sessions) {
            if (s.host === socket.id || s.client === socket.id) {
                sessions.delete(sid);
                break;
            }
        }
    });
});

httpServer.listen(PORT, () => console.log(`🚀 Port:${PORT}`));