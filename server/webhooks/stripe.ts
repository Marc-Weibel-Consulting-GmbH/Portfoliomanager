import type { Request, Response } from "express";
import Stripe from "stripe";
import { sendEmail, generatePaymentConfirmationEmail } from "../_core/email";
import { ENV } from "../_core/env";

const stripe = new Stripe(ENV.stripeSecretKey || "", {
  apiVersion: "2024-11-20.acacia",
});

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get user ID from metadata
      const userId = session.metadata?.userId || session.client_reference_id;
      
      if (!userId) {
        console.error("No user ID found in session metadata");
        return res.status(400).send("No user ID found");
      }

      try {
        // Update user payment status
        const { getDb } = await import("../db");
        const { users, payments } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();

        // Mark user as paid
        if (db) {
          await db
            .update(users)
            .set({
              hasPaid: 1,
              paymentDate: new Date(),
              stripeCustomerId: session.customer as string,
            })
            .where(eq(users.openId, userId));
        }

        // Record payment
        if (db) {
          await db.insert(payments).values({
            userId: parseInt(userId) || 0,
            stripePaymentId: session.payment_intent as string,
            amount: session.amount_total || 0, // Amount in cents
            currency: (session.currency || "chf").toUpperCase(),
            status: "completed",
            completedAt: new Date(),
          });
        }

        console.log(`Payment successful for user ${userId}`);
        
        // Send confirmation email
        const userEmail = session.customer_details?.email || session.metadata?.userEmail;
        const userName = session.customer_details?.name || session.metadata?.userName || '';
        
        if (userEmail) {
          const emailHtml = generatePaymentConfirmationEmail(userName, userEmail);
          const emailSent = await sendEmail({
            to: userEmail,
            subject: 'Zahlungsbestätigung - Portfolio BIG Vollzugriff freigeschaltet',
            html: emailHtml,
          });
          
          if (emailSent) {
            console.log(`[Payment] Confirmation email sent to ${userEmail}`);
          } else {
            console.error(`[Payment] Failed to send confirmation email to ${userEmail}`);
          }
        } else {
          console.warn(`[Payment] No email address found for user ${userId}`);
        }
      } catch (error) {
        console.error("Error updating user payment status:", error);
        return res.status(500).send("Error processing payment");
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.error(`Payment failed: ${paymentIntent.id}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}

