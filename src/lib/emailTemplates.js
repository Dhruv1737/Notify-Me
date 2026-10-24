export function verifyEmail(url) {
  return {
    subject: "Verify your email",
    text: `Open this link to verify your email:\n\n${url}\n\nThe link works once and expires in 24 hours. If you did not sign up, ignore this email.`,
  };
}

export function accountExistsEmail(loginUrl) {
  return {
    subject: "You already have an account",
    text: `Someone tried to sign up with this email, but an account already exists.\n\nLog in here: ${loginUrl}\n\nIf this was not you, you can ignore this email.`,
  };
}

export function resetEmail(url) {
  return {
    subject: "Reset your password",
    text: `Open this link to choose a new password:\n\n${url}\n\nThe link works once and expires in 30 minutes. If you did not ask for this, ignore this email and your password stays the same.`,
  };
}