// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let rooms = {}; // Almacenar los datos del juego por sala

// Manejar la conexión de los sockets
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Evento para unirse a una sala
    socket.on('joinRoom', (room) => {
        console.log(`Received request to join room: ${room}`);
        socket.join(room);
        console.log(`${socket.id} joined room: ${room}`);

        // Inicializar el estado de la sala si aún no existe
        if (!rooms[room]) {
            rooms[room] = {
                board: [['', '', ''], ['', '', ''], ['', '', '']],
                players: {}, // Almacenar los jugadores
                currentPlayer: 'X', // El turno inicial
            };
        }

        const roomData = rooms[room];

        // Asignar al jugador 'X' o 'O' dependiendo de cuántos jugadores haya
        if (!roomData.players['X']) {
            roomData.players['X'] = socket.id;
        } else if (!roomData.players['O']) {
            roomData.players['O'] = socket.id;
        } else {
            console.log('Room is full');
            socket.emit('roomFull', { message: 'Room is full' });
            return;
        }

        // Determinar qué jugador es el que se acaba de unir (X o O)
        const playerSymbol = roomData.players['X'] === socket.id ? 'X' : 'O';

        const initialGameState = {
            board: roomData.board,
            currentPlayer: roomData.currentPlayer,
            playerSymbol: playerSymbol, // Enviar el símbolo al jugador
        };

        socket.emit('roomJoined', initialGameState); // Enviar el estado inicial al cliente

        // Emitir un mensaje de prueba al unirse a la sala
        socket.emit('testEvent', { message: 'Hello from server!' });
    });

    // Manejar los turnos de los jugadores
    socket.on('turnPlayed', (data) => {
        const roomData = rooms[data.room];

        // Verificar que la sala existe y que es el turno correcto del jugador
        if (!roomData || roomData.players[roomData.currentPlayer] !== socket.id) {
            console.log(`It's not player ${data.playerData.playerId}'s turn!`);
            return; // Si no es el turno del jugador, no hace nada
        }

        // Actualiza el tablero con el movimiento del jugador
        roomData.board[data.playerData.x][data.playerData.y] = data.playerData.playerId;

        // Envía la actualización del juego a todos en la sala
        io.to(data.room).emit('updateGame', data.playerData);

        // Cambia el turno al otro jugador
		roomData.currentPlayer = roomData.currentPlayer === 'X' ? 'O' : 'X';
        console.log(`Next turn is for player: ${roomData.currentPlayer}`);
    });

    // Manejo de desconexión
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Eliminar al jugador desconectado de cualquier sala en la que esté
        for (let room in rooms) {
            const roomData = rooms[room];

            if (roomData.players['X'] === socket.id) {
                delete roomData.players['X'];
            } else if (roomData.players['O'] === socket.id) {
                delete roomData.players['O'];
            }

            // Si ambos jugadores se desconectan, eliminar la sala
            if (!roomData.players['X'] && !roomData.players['O']) {
                delete rooms[room];
            }
        }
    });
});

// Iniciar el servidor
server.listen(1234, () => {
    console.log('Server is running on http://localhost:1234');
});
