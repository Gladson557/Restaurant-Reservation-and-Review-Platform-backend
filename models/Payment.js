import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
  amount: Number,
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  paymentId: String
}, { timestamps: true });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
