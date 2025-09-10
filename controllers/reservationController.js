// controllers/reservationController.js
import mongoose from "mongoose";
import Reservation from "../models/Reservation.js";
import Restaurant from "../models/Restaurant.js";
import { safeEmit } from "../socketHelper.js"; // safe emitter

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * POST /api/reservations
 * body: { restaurant, date, time, partySize }
 */
export const createReservation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { restaurant: restaurantId, date, time, partySize } = req.body;

    if (!restaurantId || !date || !time || !partySize) {
      return res.status(400).json({ message: "Missing reservation fields" });
    }
    if (!isValidObjectId(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant id" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    // capacity: check restaurant.tablesPerSlot || restaurant.capacity || default 10
    const capacity =
      (typeof restaurant.tablesPerSlot === "number" && restaurant.tablesPerSlot) ||
      (typeof restaurant.capacity === "number" && restaurant.capacity) ||
      10;

    // prevent same user double-booking same slot
    const existing = await Reservation.findOne({
      user: userId,
      restaurant: restaurantId,
      date,
      time,
      status: { $ne: "cancelled" },
    });
    if (existing) {
      return res.status(400).json({ message: "You already have a reservation for this slot" });
    }

    // count active reservations at that slot
    const slotCount = await Reservation.countDocuments({
      restaurant: restaurantId,
      date,
      time,
      status: { $ne: "cancelled" },
    });

    if (slotCount >= capacity) {
      return res.status(409).json({ message: "No availability for selected slot" });
    }

    const reservation = await Reservation.create({
      user: userId,
      restaurant: restaurantId,
      date,
      time,
      partySize,
      status: "pending",
    });

    await reservation.populate("user", "name email");
    await reservation.populate("restaurant", "name location owner");

    // emit to restaurant room and global (safe)
    safeEmit("reservationCreated", reservation); // global
    safeEmit("reservationCreated", reservation, `restaurant_${restaurantId}`); // room

    return res.status(201).json(reservation);
  } catch (err) {
    console.error("createReservation error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/reservations/me
 */
export const getMyReservations = async (req, res) => {
  try {
    const userId = req.user._id;
    const reservations = await Reservation.find({ user: userId })
      .populate("restaurant", "name location cuisineType")
      .sort({ date: 1, time: 1 });
    return res.json(reservations);
  } catch (err) {
    console.error("getMyReservations error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/reservations/owner
 * returns reservations for restaurants owned by logged-in owner
 */
export const getOwnerReservations = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const restaurants = await Restaurant.find({ owner: ownerId }).select("_id");
    const restIds = restaurants.map((r) => r._id);

    const reservations = await Reservation.find({ restaurant: { $in: restIds } })
      .populate("user", "name email")
      .populate("restaurant", "name location")
      .sort({ date: 1, time: 1 });

    return res.json(reservations);
  } catch (err) {
    console.error("getOwnerReservations error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /api/reservations/:id/cancel
 * allowed: reservation user, restaurant owner, admin
 */
export const cancelReservation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid reservation id" });

    const reservation = await Reservation.findById(id).populate("restaurant", "owner name");
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    const isReservationUser = reservation.user?.toString() === userId.toString();
    const isRestaurantOwner = reservation.restaurant && reservation.restaurant.owner?.toString() === userId.toString();
    const isAdmin = req.user.role === "admin";

    if (!isReservationUser && !isRestaurantOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to cancel this reservation" });
    }

    reservation.status = "cancelled";
    await reservation.save();

    // emit update
    safeEmit("reservationCancelled", { reservationId: reservation._id, restaurant: reservation.restaurant._id });
    safeEmit("reservationCancelled", reservation, `restaurant_${reservation.restaurant._id}`);

    return res.json({ message: "Reservation cancelled", reservation });
  } catch (err) {
    console.error("cancelReservation error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /api/reservations/:id
 * user updates their own reservation (date/time/partySize)
 */
export const updateReservation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { date, time, partySize } = req.body;

    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid reservation id" });

    const reservation = await Reservation.findById(id).populate("restaurant", "tablesPerSlot capacity owner name");
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    const isReservationUser = reservation.user?.toString() === userId.toString();
    const isAdmin = req.user.role === "admin";
    if (!isReservationUser && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to update this reservation" });
    }

    // if date/time are changing, check availability
    const newDate = date ?? reservation.date;
    const newTime = time ?? reservation.time;

    const restaurant = await Restaurant.findById(reservation.restaurant._id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    const capacity =
      (typeof restaurant.tablesPerSlot === "number" && restaurant.tablesPerSlot) ||
      (typeof restaurant.capacity === "number" && restaurant.capacity) ||
      10;

    const slotCount = await Reservation.countDocuments({
      restaurant: reservation.restaurant._id,
      date: newDate,
      time: newTime,
      status: { $ne: "cancelled" },
      _id: { $ne: reservation._id }, // exclude this reservation
    });

    if (slotCount >= capacity) {
      return res.status(409).json({ message: "Requested slot is fully booked" });
    }

    if (date) reservation.date = date;
    if (time) reservation.time = time;
    if (partySize) reservation.partySize = partySize;

    await reservation.save();

    await reservation.populate("user", "name email");
    await reservation.populate("restaurant", "name");

    safeEmit("reservationUpdated", reservation);
    safeEmit("reservationUpdated", reservation, `restaurant_${reservation.restaurant._id}`);

    return res.json({ message: "Reservation updated", reservation });
  } catch (err) {
    console.error("updateReservation error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /api/reservations/:id/status
 * owner or admin updates status (confirmed/completed/cancelled)
 */
export const updateReservationStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid reservation id" });

    const reservation = await Reservation.findById(id).populate("restaurant", "owner name");
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    const isRestaurantOwner = reservation.restaurant && reservation.restaurant.owner?.toString() === userId.toString();
    const isAdmin = req.user.role === "admin";

    if (!isRestaurantOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to update status" });
    }

    const allowed = ["pending", "confirmed", "completed", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    reservation.status = status;
    await reservation.save();

    await reservation.populate("user", "name email");

    safeEmit("reservationStatusChanged", { reservationId: reservation._id, status });
    safeEmit("reservationStatusChanged", { reservationId: reservation._id, status, reservation }, `restaurant_${reservation.restaurant._id}`);

    return res.json({ message: "Status updated", reservation });
  } catch (err) {
    console.error("updateReservationStatus error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};




