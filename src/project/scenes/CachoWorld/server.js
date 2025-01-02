const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir todas las conexiones (puedes restringir si es necesario)
  },
});

const players = {}; // Almacena los jugadores conectados

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Initialize the player with speed and direction
  players[socket.id] = { x: 100, y: 100, speed: 0, direction: 0 };
  console.log("Current players:", players);

  // Send the current player list to the newly connected player
  socket.emit("init", players);

  // Notify other players about the new player
  socket.broadcast.emit("newPlayer", { id: socket.id, x: 100, y: 100 });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id); // Notify other players
  });

  // Listen for input updates from the client
  socket.on('input', (inputData) => {
    console.log(`Received input from ${socket.id}:`, inputData);
    const player = players[socket.id];
    if (player) {
        // Log speed and direction changes
        console.log(`Old position: (${player.x}, ${player.y})`);
        player.speed = inputData.speed;
        player.direction = inputData.direction;
    }
});


});

// Simulación del mundo
setInterval(() => {
  for (let id in players) {
      const player = players[id];
      player.x += player.speed * Math.cos(player.direction);
      player.y += player.speed * Math.sin(player.direction);
  }
  io.emit('update', players);
}, 1000 / 60);

// Iniciar el servidor
server.listen(1234, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:1234');
});

