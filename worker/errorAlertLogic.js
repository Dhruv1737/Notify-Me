// What should the failure/recovery mailer do for this watch right now?
//   "failure"  - it is in Error and nobody was told yet
//   "recovery" - it works again and the failure email was sent earlier
//   "clear"    - it works again but emails are off: forget the failure silently
//   null       - nothing to do
export function errorMailAction({ status, alertsEnabled, errorNotifiedAt }) {
  if (status === "ERROR" && !errorNotifiedAt) {
    return alertsEnabled ? "failure" : null;
  }
  if (status === "ACTIVE" && errorNotifiedAt) {
    return alertsEnabled ? "recovery" : "clear";
  }
  return null;
}