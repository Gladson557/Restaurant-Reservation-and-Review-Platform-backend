// routes/restaurantRoutes.js
import express from "express";
import {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  updateRestaurant,
  getMyRestaurants,
  searchRestaurants,
  getAvailability,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  deleteRestaurant,
} from "../controllers/restaurantController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js"; // multer middleware

const router = express.Router();

// advanced search must come before :id route
router.get("/search", searchRestaurants);

// create (allow photos upload via "photos" field)
router.post("/", protect, upload.array("photos", 6), createRestaurant);

// list & owner list
router.get("/", getRestaurants);
router.get("/my", protect, getMyRestaurants);

// restaurant details & availability
router.get("/:id", getRestaurantById);
router.get("/:id/availability", getAvailability);

// update (allow photos upload)
router.put("/:id", protect, upload.array("photos", 6), updateRestaurant);

// delete restaurant (owner or admin)
router.delete("/:id", protect, deleteRestaurant);

// menu management
router.post("/:id/menu", protect, addMenuItem);
router.put("/:id/menu/:itemId", protect, updateMenuItem);
router.delete("/:id/menu/:itemId", protect, deleteMenuItem);

export default router;
