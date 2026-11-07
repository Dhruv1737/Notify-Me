export const STATUS = {
  PENDING: { label: "Pending", cls: "pending" },
  ACTIVE: { label: "Active", cls: "active" },
  ERROR: { label: "Error", cls: "error" },
  PAUSED: { label: "Paused", cls: "" },
};

export const INTERVAL_LABEL = {
  5: "every 5 minutes",
  15: "every 15 minutes",
  60: "every hour",
  360: "every 6 hours",
  1440: "every day",
};

export const MODE_LABEL = {
  PAGE_CHANGES: "page changes",
  NEW_LINE_KEYWORDS: "new line has keywords",
  KEYWORDS_APPEAR: "keywords appear",
  KEYWORDS_DISAPPEAR: "keywords disappear",
};