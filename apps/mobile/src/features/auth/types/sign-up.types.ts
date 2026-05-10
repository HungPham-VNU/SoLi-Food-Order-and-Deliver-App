import { z } from "zod";

// ─── Sign Up Schema ──────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  fullName: z.string().min(1, "Full name is required").min(2, "Full name is too short"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters"),
  phone: z.string().min(1, "Phone number is required").regex(/^[0-9+]+$/, "Invalid phone number"),
  termsAccepted: z.boolean().refine((val) => val === true, "You must accept the terms and conditions"),
});

// ─── Sign Up Form Data ────────────────────────────────────────────────────────

export type SignUpFormData = z.infer<typeof signUpSchema>;

// ─── Sign Up Screen Props ─────────────────────────────────────────────────────

export interface SignUpScreenProps {
  isLoading?: boolean;
  onBack?: () => void;
  onContinue?: (data: SignUpFormData) => void;
  onLogIn?: () => void;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
}
