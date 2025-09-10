import Stripe from "stripe";
import Payment from "../models/Payment.js";
import Reservation from "../models/Reservation.js";

const stripe = new Stripe(process.env.STRIPE_SECRET);

// Create checkout session
export const createPayment = async (req, res) => {
  try {
    const { reservationId, amount } = req.body;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Restaurant Reservation" },
            unit_amount: amount * 100, // cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
    });

    const payment = await Payment.create({
      user: req.user._id,
      reservation: reservationId,
      amount,
      status: "pending"
    });

    res.json({ id: session.id, payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Webhook for Stripe to update payment status
export const stripeWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await Payment.findOneAndUpdate(
        { paymentId: session.id },
        { status: "completed" }
      );
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
