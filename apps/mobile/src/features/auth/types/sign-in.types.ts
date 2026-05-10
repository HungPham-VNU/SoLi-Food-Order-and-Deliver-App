import { z } from "zod";

// ─── Sign In Schema ──────────────────────────────────────────────────────────

export const signInSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters"),
});

// ─── Sign In Form Data ────────────────────────────────────────────────────────

export type SignInFormData = z.infer<typeof signInSchema>;

// ─── Sign In Screen Props ─────────────────────────────────────────────────────

export interface SignInScreenProps {
  isLoading?: boolean;
  onBack?: () => void;
  onSignIn?: (data: SignInFormData) => void;
  onForgotPassword?: () => void;
  onGoogleSignIn?: () => void;
  onSignUp?: () => void;
}
