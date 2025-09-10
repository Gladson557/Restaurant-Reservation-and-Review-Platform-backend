// socket.js
import { Server } from "socket.io";

let io; // socket.io server instance

/**
 * Initialize socket.io server (call once after creating http server)
 * @param {http.Server} server
 * @returns {Server} io
 */
export const initSocket = (server) => {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "*", // set to your front-end origin in prod
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    // Optionally allow clients to join rooms, e.g. owner room for restaurantId
    socket.on("joinRestaurantRoom", (restaurantId) => {
      if (restaurantId) {
        socket.join(`restaurant_${restaurantId}`);
        console.log(`${socket.id} joined room restaurant_${restaurantId}`);
      }
    });

    socket.on("leaveRestaurantRoom", (restaurantId) => {
      if (restaurantId) {
        socket.leave(`restaurant_${restaurantId}`);
        console.log(`${socket.id} left room restaurant_${restaurantId}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });

  return io;
};

/**
 * Return initialized io instance
 */
export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
  return io;
};
