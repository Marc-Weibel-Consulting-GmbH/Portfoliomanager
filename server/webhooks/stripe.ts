import type { Request, Response } from "express";
import Stripe from "stripe";
import { sendEmail, generatePaymentConfirmationEmail } from "../_core/email";
import { ENV, getStripeSecretKey } from "../_core/env";

let stripe: Stripe | null = null;

async function getStripe(): Promise<Stripe> {
  if (!stripe) {
    const key = await getStripeSecretKey();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured. Please add it via Admin > API Secrets.");
    }
    stripe = new Stripe(key, {
      apiVersion: "2025-09-30.clover",
    });
  }
  return stripe;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripeInstance = await getStripe();
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // K-A1: Abo-Plan eines Nutzers setzen. `ref` ist entweder die numerische
  // users.id (neuer Subscription-Flow) oder openId (alter Einmalzahlungs-Flow).
  async function applyPlan(
    ref: string,
    fields: { plan?: "free" | "plus" | "pro"; planStatus?: "active" | "past_due" | "canceled"; planRenewsAt?: Date | null; stripeSubscriptionId?: string | null; stripeCustomerId?: string | null }
  ) {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema");
    const { eq, or } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const numeric = /^\d+$/.test(ref) ? parseInt(ref) : null;
    const where = numeric !== null ? or(eq(users.id, numeric), eq(users.openId, ref)) : eq(users.openId, ref);
    await db.update(users).set(fields as any).where(where);
    // Plan-Cache invalidieren, damit die neue Berechtigung sofort greift.
    try {
      const { invalidatePlanCache } = await import("../lib/entitlements");
      if (numeric !== null) invalidatePlanCache(numeric); else invalidatePlanCache();
    } catch {}
  }

  const PLAN_FROM_META = (m: Stripe.Metadata | null | undefined): "plus" | "pro" =>
    (m?.plan === "pro" ? "pro" : "plus");

  // Handle the event
  switch (event.type) {
    // ── Abo: Lebenszyklus (neuer Subscription-Flow) ──────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const ref = sub.metadata?.userId;
      if (ref) {
        const active = sub.status === "active" || sub.status === "trialing";
        await applyPlan(ref, {
          plan: active ? PLAN_FROM_META(sub.metadata) : "free",
          planStatus: sub.status === "past_due" ? "past_due" : active ? "active" : "canceled",
          planRenewsAt: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : null,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer as string,
        });
        console.log(`[stripe] subscription ${sub.status} → user ${ref}`);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const ref = sub.metadata?.userId;
      if (ref) {
        await applyPlan(ref, { plan: "free", planStatus: "canceled", stripeSubscriptionId: null });
        console.log(`[stripe] subscription canceled → user ${ref}`);
      }
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const ref = (inv as any).subscription_details?.metadata?.userId || inv.metadata?.userId;
      if (ref) {
        await applyPlan(ref, { planStatus: "past_due" });
        console.warn(`[stripe] invoice.payment_failed → user ${ref} past_due`);
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Get user ID from metadata
      const userId = session.metadata?.userId || session.client_reference_id;

      if (!userId) {
        console.error("No user ID found in session metadata");
        return res.status(400).send("No user ID found");
      }

      // Subscription-Checkout: Plan sofort setzen (subscription.created folgt,
      // aber wir setzen hier bereits, damit der Zugriff nicht auf das
      // Folge-Event warten muss).
      if (session.mode === "subscription") {
        await applyPlan(userId, {
          plan: PLAN_FROM_META(session.metadata),
          planStatus: "active",
          stripeSubscriptionId: (session.subscription as string) ?? null,
          stripeCustomerId: (session.customer as string) ?? null,
        });
        console.log(`[stripe] subscription checkout completed → user ${userId}`);
        break;
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
            console.log(`[Payment] Confirmation email sent (userId: ${userId})`);
          } else {
            console.error(`[Payment] Failed to send confirmation email (userId: ${userId})`);
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

