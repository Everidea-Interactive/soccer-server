// server.js (Node.js)
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling'] // Menggunakan polling sebagai fallback jika websocket gagal
});

const sessions = {}; 

io.on('connection', (socket) => {
    console.log('--- User Connected:', socket.id);

    // 1. HOST REGISTER
    socket.on('register_host', (sessionId) => {
        sessions[sessionId] = { host: socket.id, client: null };
        socket.join(sessionId);
        console.log(`✅ Host Registered. Session: ${sessionId} | ID: ${socket.id}`);
    });

    // 2. CLIENT JOIN
    socket.on('join_session', (sessionId) => {
        console.log(`--- Client attempting to join: ${sessionId}`);
        
        if (sessions[sessionId]) {
            sessions[sessionId].client = socket.id;
            socket.join(sessionId);
            console.log(`✅ Client Joined Session: ${sessionId} | ID: ${socket.id}`);
            
            // Beritahu Host bahwa Client sudah masuk untuk START GAME
            io.to(sessions[sessionId].host).emit('client_connected', "Ponsel Terhubung!");
            console.log(`📢 Start signal sent to Host in session: ${sessionId}`);
        } else {
            console.log(`❌ Session ${sessionId} not found for client ${socket.id}`);
            socket.emit('session_error', 'Session not found.');
        }
    });

    // 3. KICK DATA RELAY
    socket.on('send_kick', (data) => {
        const sessionId = Object.keys(sessions).find(id => sessions[id].client === socket.id);
        if (sessionId && sessions[sessionId].host) {
            io.to(sessions[sessionId].host).emit('receive_kick', data);
        }
    });

    // 4. SCORE & RESULT RELAY
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

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));