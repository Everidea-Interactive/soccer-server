// server.js (Node.js)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Konfigurasi Socket.IO untuk WebGL & Railway
const io = new Server(server, {
    cors: {
        origin: "*", // Mengizinkan semua domain (Vercel)
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Polling sebagai cadangan jika WebSocket gagal
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Port otomatis dari Railway
const PORT = process.env.PORT || 4000;

// Penyimpanan Sesi
// Struktur: { 'ABCD123': { host: 'socket_id', client: 'socket_id' } }
const sessions = {};

// Dashboard sederhana untuk cek apakah server hidup
app.get('/', (req, res) => {
    res.send(`<h1>Soccer Server is Online</h1><p>Active Sessions: ${Object.keys(sessions).length}</p>`);
});

io.on('connection', (socket) => {
    console.log('--- User Connected:', socket.id);

    // 1. EVENT: Register Host (Dari MainScreenHost.cs)
    socket.on('register_host', (sessionId) => {
        if (!sessions[sessionId]) {
            sessions[sessionId] = { host: socket.id, client: null };
        } else {
            sessions[sessionId].host = socket.id;
        }
        socket.join(sessionId);
        console.log(`✅ Host Registered. Session: ${sessionId} | Socket: ${socket.id}`);
    });

    // 2. EVENT: Join Session (Dari PhoneClient.cs)
    socket.on('join_session', (sessionId) => {
        console.log(`--- Client attempting to join: ${sessionId}`);
        
        if (sessions[sessionId]) {
            sessions[sessionId].client = socket.id;
            socket.join(sessionId);
            console.log(`✅ Client Joined. Session: ${sessionId} | Socket: ${socket.id}`);
            
            // Memberitahu Host bahwa Client sudah terhubung agar Game Dimulai
            io.to(sessions[sessionId].host).emit('client_connected', "Ponsel Terhubung!");
            console.log(`📢 Signal 'client_connected' sent to Host: ${sessions[sessionId].host}`);
        } else {
            console.log(`❌ Session ${sessionId} not found for client ${socket.id}`);
            socket.emit('session_error', 'Sesi tidak ditemukan. Pastikan Host sudah online.');
        }
    });

    // 3. EVENT: Send Kick (Relay dari Client ke Host)
    socket.on('send_kick', (data) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].client === socket.id);
        if (sessionId && sessions[sessionId].host) {
            io.to(sessions[sessionId].host).emit('receive_kick', data);
            console.log(`⚽ Kick data relayed to Host in session ${sessionId}`);
        }
    });

    // 4. EVENT: Score Update (Relay dari Host ke Client)
    socket.on('score_update', (score) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('score_update', score);
            console.log(`📈 Score update sent to Client: ${score}`);
        }
    });

    // 5. EVENT: Shot Result (Relay dari Host ke Client)
    socket.on('shot_result', (result) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('shot_result', result);
            console.log(`🎯 Shot result sent to Client: ${result}`);
        }
    });

    // 6. EVENT: Game Over (Relay dari Host ke Client)
    socket.on('game_over', (finalScore) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('game_over', finalScore);
            console.log(`🏁 Game Over sent to Client. Final Score: ${finalScore}`);
        }
    });

    // 7. EVENT: Disconnect & Cleanup
    socket.on('disconnect', () => {
        console.log('--- User Disconnected:', socket.id);
        for (const sessionId in sessions) {
            if (sessions[sessionId].host === socket.id) {
                if (sessions[sessionId].client) {
                    io.to(sessions[sessionId].client).emit('host_disconnected');
                }
                delete sessions[sessionId]; // Hapus sesi jika host keluar
                console.log(`🗑️ Session ${sessionId} deleted because Host disconnected.`);
                break;
            } else if (sessions[sessionId].client === socket.id) {
                sessions[sessionId].client = null; // Kosongkan client jika hp disconnect
                io.to(sessions[sessionId].host).emit('client_disconnected');
                console.log(`📱 Client left session ${sessionId}. Host notified.`);
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 SERVER IS LIVE ON PORT ${PORT}`);
});