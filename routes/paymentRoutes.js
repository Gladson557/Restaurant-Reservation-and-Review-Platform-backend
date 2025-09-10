import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { createPayment, stripeWebhook } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/", protect, createPayment);
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
