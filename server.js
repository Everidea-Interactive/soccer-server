// server.js (Node.js)
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    // IZINKAN polling sebagai fallback jika websocket murni diblokir oleh jaringan/firewall
    transports: ['websocket', 'polling'], 
    allowEIO3: true, // Menambah kompatibilitas dengan library socket lama
    pingTimeout: 60000, // Menjaga koneksi tetap hidup lebih lama
    pingInterval: 25000
});

app.get('/', (req, res) => {
    res.send('Soccer Server is Running');
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

const sessions = {}; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register_host', (sessionId) => {
        // Jika sesi sudah ada, update host-nya saja agar tidak memutus client yang mungkin sudah stand-by
        if (!sessions[sessionId]) {
            sessions[sessionId] = { host: socket.id, client: null };
        } else {
            sessions[sessionId].host = socket.id;
        }
        socket.join(sessionId);
        console.log(`Host registered for session: ${sessionId}`);
    });

    socket.on('join_session', (sessionId) => {
        if (sessions[sessionId]) {
            sessions[sessionId].client = socket.id;
            socket.join(sessionId);
            console.log(`Client joined session: ${sessionId}`);
            
            // Memberi tahu Host (Layar Utama) agar menjalankan StartGame()
            io.to(sessions[sessionId].host).emit('client_connected', "Ponsel Terhubung!");
        } else {
            socket.emit('session_error', 'Sesi tidak ditemukan. Pastikan Layar Utama sudah terbuka.');
        }
    });

    socket.on('send_kick', (data) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].client === socket.id);
        if (sessionId && sessions[sessionId].host) {
            io.to(sessions[sessionId].host).emit('receive_kick', data);
        }
    });

    socket.on('score_update', (score) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('score_update', score); 
        }
    });

    socket.on('shot_result', (result) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('shot_result', result); 
        }
    });

    socket.on('game_over', (finalScore) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('game_over', finalScore); 
        }
    });

    socket.on('disconnect', () => {
        for (const sessionId in sessions) {
            if (sessions[sessionId].host === socket.id) {
                if (sessions[sessionId].client) {
                    io.to(sessions[sessionId].client).emit('host_disconnected');
                }
                delete sessions[sessionId];
                break;
            } else if (sessions[sessionId].client === socket.id) {
                sessions[sessionId].client = null;
                io.to(sessions[sessionId].host).emit('client_disconnected');
                break;
            }
        }
    });
});