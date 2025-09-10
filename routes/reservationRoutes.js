import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createReservation,
  getMyReservations,
  cancelReservation, getOwnerReservations, updateReservation, updateReservationStatus
} from "../controllers/reservationController.js";

const router = express.Router();

router.post("/", protect, createReservation);
router.get("/me", protect, getMyReservations);
router.put("/:id/cancel", protect, cancelReservation);
router.get("/owner", protect, getOwnerReservations);
router.put("/:id", protect, updateReservation);
router.put("/:id/status", protect, updateReservationStatus);

export default router;
