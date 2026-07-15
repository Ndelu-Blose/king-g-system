import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  getHelpRequests,
  getInventoryBalances,
  getDiscrepancyCases,
  getAllTransactions,
  getSettings,
} from "./pos.service.js";

const VOID_REFUND_ALERT_THRESHOLD = 2;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

async function supabase() {
  return getSupabaseAdmin();
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseThreshold(settings) {
  const raw = settings?.low_stock_threshold ?? settings?.lowStockThreshold;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOW_STOCK_THRESHOLD;
}

async function getReadMap() {
  const client = await supabase();
  const { data, error } = await client.from("notification_reads").select("*");
  if (error) throw error;
  const map = new Map();
  for (const row of data ?? []) {
    map.set(row.notification_id, {
      isRead: Boolean(row.is_read),
      readAt: row.read_at ?? null,
      firstSeenAt: row.first_seen_at,
    });
  }
  return map;
}

/**
 * Ensure notification_reads rows exist for derived alert ids.
 * Returns updated read map including newly inserted first_seen_at values.
 */
async function ensureAlertReadRows(items, readMap) {
  const client = await supabase();
  const now = new Date().toISOString();
  const missing = [];

  for (const item of items) {
    if (!readMap.has(item.id)) {
      missing.push({
        notification_id: item.id,
        is_read: false,
        read_at: null,
        first_seen_at: item.createdAtHint || now,
        updated_at: now,
      });
    }
  }

  if (missing.length) {
    const { error } = await client.from("notification_reads").upsert(missing, {
      onConflict: "notification_id",
      ignoreDuplicates: true,
    });
    if (error) throw error;

    for (const row of missing) {
      if (!readMap.has(row.notification_id)) {
        readMap.set(row.notification_id, {
          isRead: false,
          readAt: null,
          firstSeenAt: row.first_seen_at,
        });
      }
    }
  }

  return readMap;
}

function mapHelpRequest(h) {
  return {
    id: h.id,
    type: "help_request",
    category: "Help Requests",
    title: `${h.cashierName || h.cashierId} requested help`,
    description: h.message || "Assistance needed at terminal.",
    href: "/notifications",
    isRead: Boolean(h.isRead),
    readAt: h.readAt ?? null,
    createdAt: h.createdAt,
    status: h.status || "pending",
    acknowledgedAt: h.acknowledgedAt ?? null,
    acknowledgedBy: h.acknowledgedBy ?? null,
  };
}

/**
 * Build the unified notifications feed from help requests + live alert sources.
 */
export async function listNotifications() {
  const [help, inventory, discrepancies, transactions, settings, readMap] = await Promise.all([
    getHelpRequests(null),
    getInventoryBalances(),
    getDiscrepancyCases("open"),
    getAllTransactions(null),
    getSettings().catch(() => ({})),
    getReadMap(),
  ]);

  const threshold = parseThreshold(settings);
  const notifications = help.map(mapHelpRequest);
  const todayStart = startOfDay().getTime();
  const dayIso = startOfDay().toISOString();

  const derivedSeeds = [];

  const lowStockItems = inventory
    .filter((i) => i.loungeQty < threshold || i.warehouseQty < threshold)
    .slice(0, 25);

  for (const item of lowStockItems) {
    derivedSeeds.push({ id: `low_${item.productId}`, createdAtHint: null, item });
  }

  for (const d of discrepancies) {
    derivedSeeds.push({ id: `var_${d.id}`, createdAtHint: d.createdAt, case: d });
  }

  const todayVoidRefundCount = (transactions ?? []).filter(
    (t) =>
      (t.status === "void" || t.status === "refunded") &&
      new Date(t.createdAt).getTime() >= todayStart
  ).length;

  if (todayVoidRefundCount >= VOID_REFUND_ALERT_THRESHOLD) {
    derivedSeeds.push({
      id: "unusual_voids_today",
      createdAtHint: dayIso,
      voidCount: todayVoidRefundCount,
    });
  }

  await ensureAlertReadRows(
    derivedSeeds.map((s) => ({ id: s.id, createdAtHint: s.createdAtHint })),
    readMap
  );

  for (const seed of derivedSeeds) {
    const read = readMap.get(seed.id) || { isRead: false, readAt: null, firstSeenAt: seed.createdAtHint || dayIso };

    if (seed.item) {
      const item = seed.item;
      const loungeLow = item.loungeQty < threshold;
      const warehouseLow = item.warehouseQty < threshold;
      const loc =
        loungeLow && warehouseLow ? "Lounge & Warehouse" : loungeLow ? "Lounge" : "Warehouse";
      const qty = Math.min(
        loungeLow ? item.loungeQty : Number.POSITIVE_INFINITY,
        warehouseLow ? item.warehouseQty : Number.POSITIVE_INFINITY
      );
      notifications.push({
        id: seed.id,
        type: "low_stock",
        category: "Stock Alerts",
        title: "Low stock",
        description: `${item.productName} — ${qty} unit${qty !== 1 ? "s" : ""} in ${loc}`,
        href:
          loungeLow && !warehouseLow
            ? "/inventory/lounge"
            : warehouseLow && !loungeLow
              ? "/inventory/warehouse"
              : "/inventory",
        isRead: read.isRead,
        readAt: read.readAt,
        createdAt: read.firstSeenAt,
        status: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
      });
      continue;
    }

    if (seed.case) {
      const d = seed.case;
      notifications.push({
        id: seed.id,
        type: "variance",
        category: "Variance",
        title: d.type === "cash" ? "Cash variance" : "Stock variance",
        description: d.notes || `${d.severity || "medium"} severity — opened by ${d.createdBy}`,
        href: "/ops/discrepancies",
        isRead: read.isRead,
        readAt: read.readAt,
        createdAt: d.createdAt,
        status: d.status === "closed" ? "resolved" : "pending",
        acknowledgedAt: d.closedAt ?? null,
        acknowledgedBy: d.closedBy ?? null,
      });
      continue;
    }

    if (seed.voidCount != null) {
      notifications.push({
        id: seed.id,
        type: "unusual",
        category: "Activity",
        title: "Unusual activity",
        description: `${seed.voidCount} void/refund${seed.voidCount !== 1 ? "s" : ""} today. Review if needed.`,
        href: "/voids-refunds",
        isRead: read.isRead,
        readAt: read.readAt,
        createdAt: read.firstSeenAt || dayIso,
        status: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
      });
    }
  }

  notifications.sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return notifications;
}

function isDerivedAlertId(id) {
  return (
    typeof id === "string" &&
    (id.startsWith("low_") || id.startsWith("var_") || id === "unusual_voids_today")
  );
}

async function setHelpReadState(id, isRead) {
  const client = await supabase();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("help_requests")
    .update({
      is_read: isRead,
      read_at: isRead ? now : null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Notification not found");
  return { ok: true, id, isRead, readAt: isRead ? now : null };
}

async function setAlertReadState(id, isRead) {
  const client = await supabase();
  const now = new Date().toISOString();
  const readMap = await getReadMap();
  const existing = readMap.get(id);
  const firstSeenAt = existing?.firstSeenAt || now;

  const { error } = await client.from("notification_reads").upsert(
    {
      notification_id: id,
      is_read: isRead,
      read_at: isRead ? now : null,
      first_seen_at: firstSeenAt,
      updated_at: now,
    },
    { onConflict: "notification_id" }
  );
  if (error) throw error;
  return { ok: true, id, isRead, readAt: isRead ? now : null };
}

export async function markNotificationRead(id) {
  if (isDerivedAlertId(id)) return setAlertReadState(id, true);
  try {
    return await setHelpReadState(id, true);
  } catch {
    return setAlertReadState(id, true);
  }
}

export async function markNotificationUnread(id) {
  if (isDerivedAlertId(id)) return setAlertReadState(id, false);
  try {
    return await setHelpReadState(id, false);
  } catch {
    return setAlertReadState(id, false);
  }
}

export async function markAllNotificationsRead() {
  const list = await listNotifications();
  const unread = list.filter((n) => !n.isRead);
  const now = new Date().toISOString();
  const client = await supabase();

  const helpIds = unread.filter((n) => n.type === "help_request").map((n) => n.id);
  const alertIds = unread.filter((n) => n.type !== "help_request").map((n) => n.id);

  if (helpIds.length) {
    const { error } = await client
      .from("help_requests")
      .update({ is_read: true, read_at: now })
      .in("id", helpIds);
    if (error) throw error;
  }

  for (const id of alertIds) {
    await setAlertReadState(id, true);
  }

  return { ok: true, marked: unread.length };
}

export async function getUnreadNotificationCount() {
  const list = await listNotifications();
  return list.filter((n) => !n.isRead).length;
}
