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
const sessions = {}; // Gunakan object sederhana

app.get('/', (req, res) => res.send('Server OK'));

io.on('connection', (socket) => {
    socket.on('register_host', (sid) => {
        sessions[sid] = { host: socket.id, client: null };
        socket.join(sid);
        console.log(`Host: ${sid}`);
    });

    socket.on('join_session', (sid) => {
        if (sessions[sid]) {
            sessions[sid].client = socket.id;
            socket.join(sid);
            // Kirim ke host secara spesifik
            io.to(sessions[sid].host).emit('client_connected', "START");
            console.log(`Client joined ${sid}`);
        }
    });

    // Gunakan try-catch agar jika data korup, server tidak crash
    socket.on('send_kick', (data) => {
        try {
            const sid = Object.keys(sessions).find(k => sessions[k].client === socket.id);
            if (sid) io.to(sessions[sid].host).emit('receive_kick', data);
        } catch (e) { console.error(e); }
    });

    // Relay Skor: Dari Host ke Client di sesi yang sama
    socket.on('score_update', (score) => {
        // Cari sid (Session ID) di mana socket ini adalah Host-nya
        const sid = Object.keys(sessions).find(k => sessions[k].host === socket.id);
        if (sid && sessions[sid].client) {
            // Kirim HANYA ke client di sesi tersebut
            io.to(sessions[sid].client).emit('score_update', score);
            console.log(`Relay Score to ${sid}: ${score}`);
        }
    });

    // Relay Hasil Tendangan (Goal/Save): Dari Host ke Client
    socket.on('shot_result', (result) => {
        const sid = Object.keys(sessions).find(k => sessions[k].host === socket.id);
        if (sid && sessions[sid].client) {
            io.to(sessions[sid].client).emit('shot_result', result);
            console.log(`Relay Result to ${sid}: ${result}`);
        }
    });

    // Relay Game Over
    socket.on('game_over', (finalScore) => {
        // Cari SID berdasarkan ID socket Host yang mengirim game_over
        const sid = Object.keys(sessions).find(k => sessions[k].host === socket.id);
        
        if (sid && sessions[sid].client) {
            // Kirim hanya ke client di sesi tersebut
            io.to(sessions[sid].client).emit('game_over', finalScore);
            console.log(`Relay Game Over to Client in session ${sid}. Final Score: ${finalScore}`);
        }
    });

    socket.on('disconnect', () => {
        for (const sid in sessions) {
            if (sessions[sid].host === socket.id || sessions[sid].client === socket.id) {
                delete sessions[sid];
                break;
            }
        }
    });
});

// Tambahkan error handler global
httpServer.on('error', (err) => console.error('Server Error:', err));

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Live on ${PORT}`);
});