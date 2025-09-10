// socketHelper.js
import { getIO } from "./socket.js";

/**
 * Try get io instance. Returns io or null (does not throw).
 */
export const tryGetIO = () => {
  try {
    return getIO();
  } catch (err) {
    // socket not initialized yet
    return null;
  }
};

/**
 * Safely emit an event. If room is provided, emit to that room only.
 * Returns true if emit occurred, false if skipped.
 */
export const safeEmit = (eventName, payload, room = null) => {
  const io = tryGetIO();
  if (!io) return false;
  try {
    if (room) io.to(room).emit(eventName, payload);
    else io.emit(eventName, payload);
    return true;
  } catch (err) {
    console.warn("safeEmit failed:", err?.message || err);
    return false;
  }
};
export default {};