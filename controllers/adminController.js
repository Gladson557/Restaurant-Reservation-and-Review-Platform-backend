// controllers/adminController.js
import Restaurant from "../models/Restaurant.js";
import Reservation from "../models/Reservation.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { safeEmit } from "../socketHelper.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Restaurants ---
export const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().populate("owner", "name email role");
    return res.json(restaurants);
  } catch (err) {
    console.error("getAllRestaurants", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getRestaurantByIdAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const r = await Restaurant.findById(req.params.id).populate("owner", "name email");
    if (!r) return res.status(404).json({ message: "Not found" });
    return res.json(r);
  } catch (err) {
    console.error("getRestaurantByIdAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateRestaurantByAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    const oldCapacity = restaurant.tablesPerSlot ?? restaurant.capacity ?? null;
    Object.assign(restaurant, req.body);
    await restaurant.save();

    const newCapacity = restaurant.tablesPerSlot ?? restaurant.capacity ?? oldCapacity;
    if (oldCapacity !== null && newCapacity !== oldCapacity) {
      safeEmit("restaurantCapacityChanged", { restaurantId: restaurant._id.toString(), capacity: newCapacity });
      safeEmit("restaurantCapacityChanged", { restaurantId: restaurant._id.toString(), capacity: newCapacity }, `restaurant_${restaurant._id}`);
    }

    return res.json(restaurant);
  } catch (err) {
    console.error("updateRestaurantByAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteRestaurantByAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    // optionally: cleanup related reservations/reviews (soft-delete preferred in prod)
    await Reservation.deleteMany({ restaurant: restaurant._id });
    await Review.deleteMany({ restaurant: restaurant._id });
    await restaurant.deleteOne();

    safeEmit("restaurantDeleted", { restaurantId: req.params.id });

    return res.json({ message: "Restaurant deleted" });
  } catch (err) {
    console.error("deleteRestaurantByAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Reservations ---
export const getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate("user", "name email")
      .populate("restaurant", "name location");
    return res.json(reservations);
  } catch (err) {
    console.error("getAllReservations", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const cancelReservationByAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Not found" });

    reservation.status = "cancelled";
    await reservation.save();

    // emit event for reservation cancelled
    safeEmit("reservationCancelled", { reservationId: reservation._id, restaurant: reservation.restaurant });
    safeEmit("reservationCancelled", reservation, `restaurant_${reservation.restaurant}`);

    return res.json({ message: "Reservation cancelled", reservation });
  } catch (err) {
    console.error("cancelReservationByAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateReservationByAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Not found" });

    // allow admin to change status or date/time/partySize
    const { status, date, time, partySize } = req.body;
    if (status) reservation.status = status;
    if (date) reservation.date = date;
    if (time) reservation.time = time;
    if (partySize) reservation.partySize = partySize;
    await reservation.save();

    safeEmit("reservationUpdated", reservation);
    safeEmit("reservationUpdated", reservation, `restaurant_${reservation.restaurant}`);

    return res.json({ message: "Reservation updated", reservation });
  } catch (err) {
    console.error("updateReservationByAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Reviews ---
export const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("user", "name email")
      .populate("restaurant", "name");
    return res.json(reviews);
  } catch (err) {
    console.error("getAllReviews", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteReviewByAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    await Review.findByIdAndDelete(req.params.id);
    safeEmit("reviewDeleted", { reviewId: req.params.id });
    return res.json({ message: "Review deleted" });
  } catch (err) {
    console.error("deleteReviewByAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Users (optional admin actions) ---
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.json(users);
  } catch (err) {
    console.error("getAllUsers", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    await User.findByIdAndDelete(req.params.id);
    return res.json({ message: "User deleted" });
  } catch (err) {
    console.error("deleteUserByAdmin", err);
    return res.status(500).json({ message: "Server error" });
  }
};
