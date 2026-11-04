import { z } from "zod";
import { ALLOWED_INTERVALS, MAX_KEYWORDS } from "./constants.js";

// ---------- Accounts ----------

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

// ---------- Watches ----------

const ALERT_MODES = [
  "PAGE_CHANGES",
  "NEW_LINE_KEYWORDS",
  "KEYWORDS_APPEAR",
  "KEYWORDS_DISAPPEAR",
];

const emptyToNull = (v) => (v ? v : null);

// Trim, collapse inner spaces, then require 2 to 100 characters.
const keyword = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Each keyword needs at least 2 characters.")
      .max(100, "Each keyword can be at most 100 characters.")
  );

// Case-insensitive duplicates are dropped, first spelling wins.
const keywords = z
  .array(keyword)
  .max(MAX_KEYWORDS, `Use at most ${MAX_KEYWORDS} keywords.`)
  .transform((list) => {
    const seen = new Set();
    return list.filter((k) => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

export const createWatchSchema = z
  .object({
    url: z.string().max(2048, "This address is too long."),
    name: z
      .string()
      .trim()
      .max(100, "The name can be at most 100 characters.")
      .optional()
      .transform(emptyToNull),
    selector: z
      .string()
      .trim()
      .max(200, "The selector can be at most 200 characters.")
      .optional()
      .transform(emptyToNull),
    intervalMinutes: z
      .number()
      .refine((v) => ALLOWED_INTERVALS.includes(v), "Choose a valid check interval.")
      .default(60),
    alertsEnabled: z.boolean().default(true),
    alertMode: z.enum(ALERT_MODES).default("PAGE_CHANGES"),
    keywords: keywords.default([]),
    matchMode: z.enum(["ANY", "ALL"]).default("ANY"),
  })
  .superRefine((data, ctx) => {
    if (data.alertMode !== "PAGE_CHANGES" && data.keywords.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["keywords"],
        message: "Add at least one keyword for this alert type.",
      });
    }
  });

export const patchWatchSchema = z
  .object({
    action: z.enum(["pause", "resume"]).optional(),
    alertsEnabled: z.boolean().optional(),
  })
  .refine((d) => d.action !== undefined || d.alertsEnabled !== undefined, {
    message: "Nothing to change.",
  });