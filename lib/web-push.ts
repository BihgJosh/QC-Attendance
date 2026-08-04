import "server-only";

import webPush from "web-push";
import { getEnv } from "@/lib/env";
import { deactivatePushSubscriptions, listPushSubscriptions } from "@/lib/push-notification-store";

export type TeamNotification = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export async function notifyTeam(notification: TeamNotification) {
  webPush.setVapidDetails(getEnv("VAPID_SUBJECT"), getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"), getEnv("VAPID_PRIVATE_KEY"));
  const subscriptions = await listPushSubscriptions();
  const payload = JSON.stringify({ ...notification, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
  const completed: { delivered: boolean; expired: boolean; endpoint: string }[] = [];
  const batchSize = 20;
  for (let offset = 0; offset < subscriptions.length; offset += batchSize) {
    const results = await Promise.all(subscriptions.slice(offset, offset + batchSize).map(async (subscription) => {
    try {
      await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "normal", topic: notification.tag });
      return { delivered: true, expired: false, endpoint: subscription.endpoint };
    } catch (cause) {
      const statusCode = typeof cause === "object" && cause && "statusCode" in cause ? Number(cause.statusCode) : 0;
      return { delivered: false, expired: statusCode === 404 || statusCode === 410, endpoint: subscription.endpoint };
    }
    }));
    completed.push(...results);
  }
  const expired = completed.filter((result) => result.expired).map((result) => result.endpoint);
  let cleanupFailed = false;
  try { await deactivatePushSubscriptions(expired); }
  catch (cause) { cleanupFailed = true; console.error("[web-push] Expired subscription cleanup failed", cause instanceof Error ? cause.message : "Unknown error"); }
  const delivered = completed.filter((result) => result.delivered).length;
  return { total: subscriptions.length, delivered, failed: subscriptions.length - delivered, expired: expired.length, cleanupFailed };
}
