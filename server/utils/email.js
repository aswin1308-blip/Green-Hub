/* ==========================================
        GREEN HUB - SERVER eMAIL SERVICE
        nodemailer via SMTP (production) or an
        Ethereal test account (EMAIL_TRANSPORT=ethereal,
        local development ONLY — messages are not delivered).
========================================== */

const nodemailer = require("nodemailer");

let transporterPromise = null;

const getTransporter = async () => {
  if (!transporterPromise) {
    transporterPromise = buildTransporter();
  }
  return transporterPromise;
};

const buildTransporter = async () => {
  const transport = String(process.env.EMAIL_TRANSPORT || "smtp").toLowerCase();

  if (transport === "ethereal") {
    // Real SMTP for local testing (https://ethereal.email).
    // Creates a throwaway account at runtime — never use in production.
    const testAccount = await nodemailer.createTestAccount();
    return {
      smtp: nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      }),
      test: true,
    };
  }

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error(
      "Email service is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD."
    );
  }

  return {
    smtp: nodemailer.createTransport({
      host,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: String(process.env.EMAIL_SECURE) === "true",
      auth: { user, pass },
      ...(process.env.EMAIL_SERVICE
        ? { service: process.env.EMAIL_SERVICE }
        : {}),
    }),
    test: false,
  };
};

const fromAddress = () =>
  process.env.EMAIL_FROM ||
  (process.env.EMAIL_USER ? `Green Hub <${process.env.EMAIL_USER}>` : "Green Hub");

/**
 * Sends the 6-digit password reset code.
 * Returns { previewUrl } when an Ethereal test account is used, so local
 * testers can still see the email. The code itself is NEVER returned.
 */
const sendPasswordResetCode = async (to, code) => {
  const { smtp, test } = await getTransporter();

  const info = await smtp.sendMail({
    from: fromAddress(),
    to,
    subject: "Green Hub — Password Reset Code",
    text:
      "Hello,\n\n" +
      "You requested a password reset for your Green Hub account.\n\n" +
      "Your password reset verification code is: " + code + "\n\n" +
      "This code is valid for 10 minutes and can only be used once.\n" +
      "If you did not request this, you can safely ignore this email.\n\n" +
      "— Green Hub Team",
    html:
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px">' +
      '<h2 style="color:#2e7d32;margin:0 0 12px">Green Hub</h2>' +
      '<p>You requested a password reset for your account.</p>' +
      '<p style="font-size:15px">Your password reset verification code is:</p>' +
      '<p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#2e7d32;text-align:center;background:#f4fff4;border-radius:10px;padding:14px 0;margin:14px 0">' +
      String(code) +
      "</p>" +
      "<p>This code is valid for <b>10 minutes</b> and can only be used once.</p>" +
      '<p style="color:#777;font-size:13px">If you did not request this, you can safely ignore this email.</p>' +
      '<p style="color:#777;font-size:12px;margin-top:20px">— Green Hub Team</p>' +
      "</div>",
  });

  return { previewUrl: test ? nodemailer.getTestMessageUrl(info) : null };
};

module.exports = { sendPasswordResetCode };