import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetToken,
  createEmailVerificationToken,
  verifyEmailVerificationToken,
  deleteEmailVerificationToken,
  getUserByEmail,
  getUserById,
  updateUserPassword,
  markEmailAsVerified,
} from "../db";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { ENV } from "../_core/env";

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    if (!ENV.resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(ENV.resendApiKey);
  }
  return resendClient;
}

export const authRouter = router({
  // Request password reset
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);

      // Always return success to prevent email enumeration
      if (!user) {
        return { success: true };
      }

      const token = await createPasswordResetToken(user.id);
      const resetUrl = `${process.env.VITE_APP_URL}/reset-password?token=${token}`;

      try {
        await getResend().emails.send({
          from: process.env.EMAIL_FROM || "noreply@manus.space",
          to: input.email,
          subject: "Passwort zurücksetzen - Portfolio Analyse",
          html: `
            <h2>Passwort zurücksetzen</h2>
            <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
            <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>Dieser Link ist 1 Stunde gültig.</p>
            <p>Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
          `,
        });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new Error("Failed to send email");
      }

      return { success: true };
    }),

  // Verify reset token
  verifyResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const tokenData = await verifyPasswordResetToken(input.token);
      return { valid: !!tokenData };
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const tokenData = await verifyPasswordResetToken(input.token);

      if (!tokenData) {
        throw new Error("Invalid or expired token");
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(tokenData.userId, hashedPassword);
      await deletePasswordResetToken(tokenData.id);

      return { success: true };
    }),

  // Send email verification
  sendEmailVerification: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;

    if (user.emailVerified) {
      throw new Error("Email already verified");
    }

    if (!user.email) {
      throw new Error("No email address found");
    }

    const token = await createEmailVerificationToken(user.id);
    const verificationUrl = `${process.env.VITE_APP_URL}/verify-email?token=${token}`;

    try {
      await getResend().emails.send({
        from: process.env.EMAIL_FROM || "noreply@manus.space",
        to: user.email,
        subject: "E-Mail verifizieren - Portfolio Analyse",
        html: `
          <h2>E-Mail-Adresse verifizieren</h2>
          <p>Willkommen bei Portfolio Analyse!</p>
          <p>Bitte klicken Sie auf den folgenden Link, um Ihre E-Mail-Adresse zu verifizieren:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>Dieser Link ist 24 Stunden gültig.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
      throw new Error("Failed to send email");
    }

    return { success: true };
  }),

  // Verify email
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const tokenData = await verifyEmailVerificationToken(input.token);

      if (!tokenData) {
        throw new Error("Invalid or expired token");
      }

      await markEmailAsVerified(tokenData.userId);
      await deleteEmailVerificationToken(tokenData.id);

      return { success: true };
    }),

  // Check verification status
  checkVerificationStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    return { verified: !!user?.emailVerified };
  }),
});
