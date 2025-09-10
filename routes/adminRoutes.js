// routes/adminRoutes.js
import express from "express";
import {
  getAllRestaurants,
  deleteRestaurantByAdmin,
  updateRestaurantByAdmin,
  getAllReservations,
  cancelReservationByAdmin,
  updateReservationByAdmin,
  getAllReviews,
  deleteReviewByAdmin,
  getAllUsers,
  deleteUserByAdmin,
  getRestaurantByIdAdmin,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// protect & admin only
router.use(protect, adminOnly);

// Restaurants
router.get("/restaurants", getAllRestaurants);
router.get("/restaurants/:id", getRestaurantByIdAdmin);
router.put("/restaurants/:id", updateRestaurantByAdmin);
router.delete("/restaurants/:id", deleteRestaurantByAdmin);

// Reservations
router.get("/reservations", getAllReservations);
router.put("/reservations/:id/cancel", cancelReservationByAdmin);
router.put("/reservations/:id", updateReservationByAdmin);

// Reviews
router.get("/reviews", getAllReviews);
router.delete("/reviews/:id", deleteReviewByAdmin);

// Users (optional)
router.get("/users", getAllUsers);
router.delete("/users/:id", deleteUserByAdmin);

export default router;
