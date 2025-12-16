// server.js (Node.js)
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
// Ganti port jika diperlukan (misalnya: 3000)
const PORT = process.env.PORT || 4000;

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket'] // Tambahkan ini agar aman untuk WebGL
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Peta untuk menyimpan pasangan Host dan Client berdasarkan session ID
// { 'SESSION_ID': { host: 'socket_id_host', client: 'socket_id_client' } }
const sessions = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- HOST EVENTS ---
    
    // 1. Host mendaftarkan sesi baru
    socket.on('register_host', (sessionId) => {
        sessions[sessionId] = { host: socket.id, client: null };
        socket.join(sessionId);
        console.log(`Host registered for session: ${sessionId}`);
    });

    // --- CLIENT EVENTS ---

    // 2. Ponsel bergabung ke sesi
    socket.on('join_session', (sessionId) => {
        if (sessions[sessionId] && sessions[sessionId].host !== null) {
            sessions[sessionId].client = socket.id;
            socket.join(sessionId);
            console.log(`Client joined session: ${sessionId}`);
            // Beri tahu Host bahwa Client sudah terhubung
            io.to(sessions[sessionId].host).emit('client_connected');
        } else {
            // Beri tahu Client jika sesi tidak ditemukan
            socket.emit('session_error', 'Session not found or host offline.');
        }
    });

    // 3. Ponsel mengirimkan data tendangan
    socket.on('send_kick', (data) => {
        // Cari sesi yang terkait dengan Client ini
        const sessionId = Object.keys(sessions).find(id => sessions[id].client === socket.id);
        
        if (sessionId && sessions[sessionId].host) {
            // Teruskan data tendangan ke Host (Layar Utama)
            io.to(sessions[sessionId].host).emit('receive_kick', data);
            console.log(`Kick data relayed for session ${sessionId}:`, data);
        }
    });

    // 4. Host mengirimkan update skor/hasil tendangan
    socket.on('score_update', (score) => {
        // Cari sesi yang terkait dengan Host ini
        const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);

        if (sessionId && sessions[sessionId].client) {
            const clientId = sessions[sessionId].client;
            
            // 📢 KRITIS: Kirim data skor ke Client yang terhubung
            io.to(clientId).emit('score_update', score); 
            console.log(`Score update relayed to Client in session ${sessionId}: ${score}`);
        } else {
            console.warn(`Host sent score update but no Client found for session: ${sessionId}`);
        }
    });

    socket.on('shot_result', (result) => {
    const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('shot_result', result); 
            console.log(`Shot result relayed: ${result}`);
        }
    });

socket.on('game_over', (finalScore) => {
    const sessionId = Object.keys(sessions).find(id => sessions[id].host === socket.id);
        if (sessionId && sessions[sessionId].client) {
            io.to(sessions[sessionId].client).emit('game_over', finalScore); 
            console.log(`Game Over relayed with score: ${finalScore}`);
        }
    });

    // --- DISCONNECT ---

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Hapus sesi jika Host atau Client terputus
        for (const sessionId in sessions) {
            if (sessions[sessionId].host === socket.id) {
                // Beri tahu Client jika Host terputus
                if (sessions[sessionId].client) {
                     io.to(sessions[sessionId].client).emit('host_disconnected');
                }
                delete sessions[sessionId];
                console.log(`Session ${sessionId} closed due to host disconnect.`);
                break;
            } else if (sessions[sessionId].client === socket.id) {
                // Hapus referensi Client
                sessions[sessionId].client = null;
                // Beri tahu Host bahwa Client terputus
                io.to(sessions[sessionId].host).emit('client_disconnected');
                break;
            }
        }
    });
});