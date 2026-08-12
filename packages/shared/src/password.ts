import { z } from "zod";

export type PasswordRequirement = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number (0–9)", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character (!@#$%^&*…)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character";

export function isStrongPassword(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
}

export function getPasswordRequirementStatus(password: string) {
  return PASSWORD_REQUIREMENTS.map((req) => ({
    ...req,
    met: req.test(password),
  }));
}

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(isStrongPassword, { message: STRONG_PASSWORD_MESSAGE });

export const optionalStrongPasswordSchema = z
  .string()
  .optional()
  .nullable()
  .refine((val) => !val || val.length === 0 || isStrongPassword(val), {
    message: STRONG_PASSWORD_MESSAGE,
  });
