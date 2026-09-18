/** One switch per kind of message, so the quiet ones can stay on and the chatty ones off. */
export const NOTIFICATION_EVENTS = ["deploy_started", "deploy_success", "deploy_failed", "service_down", "service_recovered", "container_unhealthy", "ssl_expiring"] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type NotificationPreferences = Record<NotificationEvent, boolean>;

/** Defaults: everything that means something went wrong, plus recoveries. */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  deploy_started: false,
  deploy_success: false,
  deploy_failed: true,
  service_down: true,
  service_recovered: true,
  container_unhealthy: true,
  ssl_expiring: true,
};

export const LABELS: Record<NotificationEvent, { title: string; description: string }> = {
  deploy_started: { title: "Deploy started", description: "Every push that reaches the agent." },
  deploy_success: { title: "Deploy finished", description: "A release went out without trouble." },
  deploy_failed: { title: "Deploy failed", description: "A release stopped or rolled back." },
  service_down: { title: "Service down", description: "A domain stopped answering." },
  service_recovered: { title: "Service back", description: "It answers again, with the downtime." },
  container_unhealthy: { title: "Container unhealthy", description: "A container reports an unhealthy state." },
  ssl_expiring: { title: "Certificate expiring", description: "A certificate is close to its last day." },
};
