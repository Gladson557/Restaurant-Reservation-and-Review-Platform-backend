import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    date: { type: String, required: true },   // ✅ store as string
    time: { type: String, required: true },   // ✅ store as string
    partySize: { type: Number, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

const Reservation = mongoose.model("Reservation", reservationSchema);

export default Reservation;
