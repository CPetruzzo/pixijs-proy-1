// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

export const SERVER_PORT = 1234;

let highscores = []; // Leaderboard en el servidor

// Manejar la conexión de los sockets
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Enviar el leaderboard actual al jugador que se conecta
    socket.emit('leaderboard', highscores);

    // Manejar puntuaciones recibidas
    socket.on('submitScore', (data) => {
        const { playerName, score } = data;

        // Agregar la puntuación al leaderboard y ordenar
        highscores.push({ playerName, score });
        highscores.sort((a, b) => b.score - a.score); // Ordenar de mayor a menor

        // Limitar el leaderboard a los 5 mejores
        highscores = highscores.slice(0, 5);

        // Enviar el leaderboard actualizado a todos los jugadores conectados
        io.emit('leaderboard', highscores);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(SERVER_PORT, () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});
