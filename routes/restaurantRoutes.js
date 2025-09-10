import express from "express";
import {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  updateRestaurant,getMyRestaurants,searchRestaurants, getAvailability
} from "../controllers/restaurantController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/search", searchRestaurants);
router.post("/", protect, createRestaurant);
router.get("/", getRestaurants);
router.get("/my", protect, getMyRestaurants);
router.get("/:id", getRestaurantById);
router.put("/:id", protect, updateRestaurant);
router.get("/:id/availability", getAvailability);


export default router;
