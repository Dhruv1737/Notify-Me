import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72);

export const signupSchema = z.object({ email, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password,
});