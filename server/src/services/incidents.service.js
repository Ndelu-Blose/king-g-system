import { getSupabaseAdmin } from "../lib/supabase.js";

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapIncident(row, event) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    location: row.location ?? null,
    reportedAt: row.reported_at,
    reportedBy: row.reported_by_name ?? null,
    resolved: row.status === "resolved",
    resolvedAt: row.resolved_at ?? null,
    resolvedNotes: row.resolution_notes ?? null,
    attachmentName: event?.attachment_name ?? null,
    attachmentStoragePath: event?.attachment_url ?? null,
  };
}

export async function listIncidents() {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("incidents")
    .select("*")
    .order("reported_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  let events = [];
  if (ids.length) {
    const { data: eventRows, error: eventErr } = await client
      .from("incident_events")
      .select("incident_id,attachment_name,attachment_url,created_at")
      .in("incident_id", ids);
    if (eventErr) throw eventErr;
    events = eventRows ?? [];
  }
  const attachmentByIncident = new Map();
  for (const event of events) {
    if (!event.attachment_name && !event.attachment_url) continue;
    const prev = attachmentByIncident.get(event.incident_id);
    if (!prev || String(event.created_at) > String(prev.created_at)) {
      attachmentByIncident.set(event.incident_id, event);
    }
  }
  return rows.map((row) => mapIncident(row, attachmentByIncident.get(row.id)));
}

export async function createIncident({
  id,
  type,
  title,
  description,
  location,
  actorId,
  actorName,
  actorRole,
  reportedBy,
  attachmentName,
  attachmentStoragePath,
  reportedAt: reportedAtInput,
}) {
  const cleanTitle = String(title ?? "").trim();
  const cleanDescription = String(description ?? "").trim();
  const cleanType = String(type ?? "").trim();
  if (!cleanTitle || !cleanDescription || !cleanType) {
    return { ok: false, error: "Type, title, and description are required" };
  }

  const client = getSupabaseAdmin();
  const incidentId = String(id ?? "").trim() || newId("inc");
  const parsedReportedAt = Date.parse(String(reportedAtInput ?? ""));
  const reportedAt = Number.isFinite(parsedReportedAt) ? new Date(parsedReportedAt).toISOString() : new Date().toISOString();
  const row = {
    id: incidentId,
    type: cleanType,
    title: cleanTitle,
    description: cleanDescription,
    location: String(location ?? "").trim() || null,
    status: "open",
    reported_at: reportedAt,
    reported_by_user_id: actorId ?? null,
    reported_by_name: String(reportedBy ?? "").trim() || actorName || null,
  };
  const { error } = await client.from("incidents").insert(row);
  if (error) {
    if (/duplicate|unique/i.test(error.message || "")) {
      const existing = await listIncidents();
      const found = existing.find((item) => item.id === incidentId);
      if (found) return { ok: true, incident: found, created: false };
    }
    throw error;
  }

  const { error: eventErr } = await client.from("incident_events").insert({
    id: newId("iev"),
    incident_id: incidentId,
    event_type: "reported",
    actor_user_id: actorId ?? null,
    actor_role: actorRole ?? null,
    note: cleanDescription,
    attachment_name: attachmentName ?? null,
    attachment_url: attachmentStoragePath ?? null,
    created_at: reportedAt,
  });
  if (eventErr) throw eventErr;

  return { ok: true, incident: mapIncident(row, { attachment_name: attachmentName, attachment_url: attachmentStoragePath }), created: true };
}

export async function resolveIncident(id, { actorId, notes }) {
  const client = getSupabaseAdmin();
  const resolvedAt = new Date().toISOString();
  const { data, error } = await client
    .from("incidents")
    .update({
      status: "resolved",
      resolved_at: resolvedAt,
      resolved_by_user_id: actorId ?? null,
      resolution_notes: notes ?? null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Incident not found" };

  await client.from("incident_events").insert({
    id: newId("iev"),
    incident_id: id,
    event_type: "resolved",
    actor_user_id: actorId ?? null,
    note: notes ?? null,
    created_at: resolvedAt,
  });
  return { ok: true };
}
