import { getSupabaseAdmin } from "../lib/supabase.js";
import { writeAudit } from "./pos.service.js";

async function supabase() {
  return getSupabaseAdmin();
}

function toDeliveryIntakeHeader(header) {
  return {
    id: header.id,
    intakeNumber: header.intake_number,
    supplier: header.supplier,
    invoiceNumber: header.invoice_number,
    deliveryReference: header.delivery_reference,
    deliveryDate: header.delivery_date,
    branchSite: header.branch_site ?? "",
    receiveIntoLocation: header.receive_into_location,
    receivedBy: header.received_by ?? "",
    notes: header.notes,
    status: header.status,
    confirmedAt: header.confirmed_at,
  };
}

function toDeliveryLine(line) {
  return {
    id: line.id,
    intakeId: line.intake_id,
    productId: line.product_id,
    expectedQty: line.expected_qty,
    actualQty: line.actual_qty,
    acceptedQty: line.accepted_qty,
    rejectedQty: line.rejected_qty,
    heldQty: line.held_qty,
    unitOfMeasure: line.unit_of_measure,
    unitCost: line.unit_cost_optional,
    batchNumber: line.batch_number,
    expiryDate: line.expiry_date,
    discrepancyReason: line.discrepancy_reason,
    decision: line.decision,
    verificationNotes: line.verification_notes,
    destination: line.destination_location,
  };
}

function toBlindCopyHeader(header) {
  return {
    id: header.id,
    blindCopyNumber: header.blind_copy_number,
    intakeId: header.intake_id,
    fromLocation: header.from_location,
    toLocation: header.to_location,
    createdBy: header.created_by_user_id,
    issuedBy: header.issued_by_user_id,
    receivedBy: header.received_by_user_id,
    issuedAt: header.issued_at,
    receivedAt: header.received_at,
    status: header.status,
  };
}

export async function saveIntakeDraft({ payload, user } = {}) {
  const client = await supabase();
  const p = payload || {};

  const row = {
    id: p.id,
    intake_number: p.intakeNumber,
    supplier: p.supplier,
    invoice_number: p.invoiceNumber,
    delivery_reference: p.deliveryReference,
    delivery_date: p.deliveryDate,
    branch_site: p.branchSite,
    receive_into_location: p.receiveIntoLocation,
    received_by: p.receivedBy,
    notes: p.notes ?? null,
    status: p.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = p.id
    ? await client.from("delivery_intakes").update(row).eq("id", p.id).select("*").single()
    : await client
        .from("delivery_intakes")
        .insert({ ...row, created_at: new Date().toISOString() })
        .select("*")
        .single();

  if (error) throw error;

  return { header: toDeliveryIntakeHeader(data), lines: [] };
}

export async function saveExpectedLines(intakeId, lines) {
  const client = await supabase();

  if (!Array.isArray(lines)) throw new Error("lines must be an array");

  const { error: delErr } = await client
    .from("delivery_intake_lines")
    .delete()
    .eq("intake_id", intakeId);
  if (delErr) throw delErr;

  const rows = lines.map((line) => ({
    id: line.id,
    intake_id: intakeId,
    product_id: line.productId,
    expected_qty: line.expectedQty,
    actual_qty: line.expectedQty,
    accepted_qty: line.expectedQty,
    rejected_qty: 0,
    held_qty: 0,
    unit_of_measure: line.unitOfMeasure,
    unit_cost_optional: line.unitCostOptional ?? null,
    batch_number: line.batchNumber ?? null,
    expiry_date: line.expiryDate ?? null,
    decision: "accept",
    destination_location: line.destinationLocation ?? null,
  }));

  const { error: insErr } = await client.from("delivery_intake_lines").insert(rows);
  if (insErr) throw insErr;

  const { data: header, error: hErr } = await client
    .from("delivery_intakes")
    .update({ status: "expected_captured", updated_at: new Date().toISOString() })
    .eq("id", intakeId)
    .select("*")
    .single();
  if (hErr) throw hErr;

  const { data: savedLines, error: lErr } = await client
    .from("delivery_intake_lines")
    .select("*")
    .eq("intake_id", intakeId);
  if (lErr) throw lErr;

  return {
    header: toDeliveryIntakeHeader(header),
    lines: (savedLines ?? []).map(toDeliveryLine),
  };
}

export async function saveVerification(intakeId, lines, status) {
  const client = await supabase();
  if (!Array.isArray(lines)) throw new Error("lines must be an array");

  for (const line of lines) {
    const acceptedQty = line.decision === "accept" ? Math.max(0, Number(line.actualQty) || 0) : 0;
    const rejectedQty = line.decision === "reject" ? Math.max(0, Number(line.actualQty) || 0) : 0;
    const heldQty = line.decision === "hold" ? Math.max(0, Number(line.actualQty) || 0) : 0;

    const { error } = await client
      .from("delivery_intake_lines")
      .update({
        actual_qty: line.actualQty ?? line.expectedQty,
        accepted_qty: acceptedQty,
        rejected_qty: rejectedQty,
        held_qty: heldQty,
        discrepancy_reason: line.discrepancyReason ?? null,
        decision: line.decision ?? "accept",
        verification_notes: line.verificationNotes ?? null,
        destination_location: line.destinationLocation ?? null,
      })
      .eq("id", line.id);

    if (error) throw error;
  }

  const { data: header, error: hErr } = await client
    .from("delivery_intakes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", intakeId)
    .select("*")
    .single();
  if (hErr) throw hErr;

  const { data: savedLines, error: lErr } = await client
    .from("delivery_intake_lines")
    .select("*")
    .eq("intake_id", intakeId);
  if (lErr) throw lErr;

  return {
    header: toDeliveryIntakeHeader(header),
    lines: (savedLines ?? []).map(toDeliveryLine),
  };
}

export async function confirmIntake(intakeId, { user } = {}) {
  const client = await supabase();

  // Load header first so we can make this operation idempotent.
  const { data: header, error: hErr } = await client.from("delivery_intakes").select("*").eq("id", intakeId).maybeSingle();
  if (hErr) throw hErr;
  if (!header) throw new Error("Intake not found");

  // Idempotency: if already confirmed, do not re-apply stock deltas.
  if (header.status === "confirmed") {
    const { data: savedLines, error: linesErr } = await client
      .from("delivery_intake_lines")
      .select("*")
      .eq("intake_id", intakeId);
    if (linesErr) throw linesErr;
    return {
      header: toDeliveryIntakeHeader(header),
      lines: (savedLines ?? []).map(toDeliveryLine),
    };
  }

  const { data: lines, error: lErr } = await client
    .from("delivery_intake_lines")
    .select("*")
    .eq("intake_id", intakeId);
  if (lErr) throw lErr;

  for (const line of lines ?? []) {
    const accepted = Number(line.accepted_qty) || 0;
    if (accepted <= 0) continue;

    const { data: inv, error: invErr } = await client
      .from("inventory")
      .select("product_id,total_qty,lounge_qty,warehouse_qty")
      .eq("product_id", line.product_id)
      .single();
    if (invErr) throw invErr;

    const isBackStore = String(line.destination_location || "").toLowerCase().includes("back store");
    const next = {
      total_qty: (inv.total_qty ?? 0) + accepted,
      lounge_qty: (inv.lounge_qty ?? 0) + (isBackStore ? accepted : 0),
      warehouse_qty: (inv.warehouse_qty ?? 0) + (isBackStore ? 0 : accepted),
    };

    const { error: updErr } = await client.from("inventory").update(next).eq("product_id", line.product_id);
    if (updErr) throw updErr;
  }

  const now = new Date().toISOString();
  const { data: updatedHeader, error: hErr2 } = await client
    .from("delivery_intakes")
    .update({
      status: "confirmed",
      confirmed_at: now,
      updated_at: now,
    })
    .eq("id", intakeId)
    .select("*")
    .single();
  if (hErr2) throw hErr2;

  const { data: savedLines, error: linesErr } = await client
    .from("delivery_intake_lines")
    .select("*")
    .eq("intake_id", intakeId);
  if (linesErr) throw linesErr;

  // Critical audit trail: capture who confirmed and link to intake.
  await writeAudit({
    action: "intake.confirmed",
    actorId: user?.id ?? null,
    actorRole: user?.role ?? null,
    entityType: "intake",
    entityId: intakeId,
    before: { status: header.status, confirmedAt: header.confirmed_at ?? null },
    after: { status: "confirmed", confirmedAt: now },
    timestamp: now,
  });

  return {
    header: toDeliveryIntakeHeader(updatedHeader),
    lines: (savedLines ?? []).map(toDeliveryLine),
  };
}

export async function generateBlindCopy(intakeId, { user } = {}) {
  const client = await supabase();

  // Idempotency: only generate once per intake.
  const { data: existingCopy, error: existingErr } = await client
    .from("blind_transfer_copies")
    .select("*")
    .eq("intake_id", intakeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existingCopy) return { header: toBlindCopyHeader(existingCopy), lines: [] };

  const { data: intake, error: iErr } = await client
    .from("delivery_intakes")
    .select("*")
    .eq("id", intakeId)
    .single();
  if (iErr) throw iErr;

  const { data: lines, error: lErr } = await client
    .from("delivery_intake_lines")
    .select("*")
    .eq("intake_id", intakeId)
    .gt("accepted_qty", 0);
  if (lErr) throw lErr;

  const blindCopyNumber = `BTC-${Date.now()}`;
  const { data: header, error: hErr } = await client
    .from("blind_transfer_copies")
    .insert({
      blind_copy_number: blindCopyNumber,
      intake_id: intakeId,
      from_location: "Receiving Bay",
      to_location: intake.receive_into_location,
      status: "generated",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (hErr) throw hErr;

  const blindLines = (lines ?? []).map((line) => ({
    blind_copy_id: header.id,
    product_id: line.product_id,
    qty: line.accepted_qty,
    unit_of_measure: line.unit_of_measure,
    batch_number: line.batch_number,
    expiry_date: line.expiry_date,
    destination_bin: line.destination_location,
  }));

  if (blindLines.length) {
    const { error: blErr } = await client.from("blind_transfer_copy_lines").insert(blindLines);
    if (blErr) throw blErr;
  }

  await writeAudit({
    action: "blind_copy.generated",
    actorId: user?.id ?? null,
    actorRole: user?.role ?? null,
    entityType: "intake",
    entityId: intakeId,
    after: { blindCopyId: header.id, blindCopyNumber: header.blind_copy_number },
    timestamp: header.created_at ?? new Date().toISOString(),
  });

  return { header: toBlindCopyHeader(header), lines: [] };
}

export async function issueBlindCopy(blindCopyId, { user } = {}) {
  const client = await supabase();
  const { data: current, error: selErr } = await client.from("blind_transfer_copies").select("*").eq("id", blindCopyId).maybeSingle();
  if (selErr) throw selErr;
  if (!current) throw new Error("Blind copy not found");

  // Idempotency: don't duplicate audit/history if already issued.
  if (current.status === "issued") {
    return { header: toBlindCopyHeader(current), lines: [] };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await client
    .from("blind_transfer_copies")
    .update({
      status: "issued",
      issued_at: now,
      updated_at: now,
    })
    .eq("id", blindCopyId)
    .select("*")
    .single();
  if (updErr) throw updErr;

  await writeAudit({
    action: "blind_copy.issued",
    actorId: user?.id ?? null,
    actorRole: user?.role ?? null,
    entityType: "blind_copy",
    entityId: blindCopyId,
    before: { status: current.status },
    after: { status: "issued", issuedAt: now },
    timestamp: now,
  });

  return { header: toBlindCopyHeader(updated), lines: [] };
}

export async function getIntakeById(intakeId) {
  const client = await supabase();
  const { data: header, error: hErr } = await client
    .from("delivery_intakes")
    .select("*")
    .eq("id", intakeId)
    .maybeSingle();
  if (hErr) throw hErr;
  if (!header) return null;

  const { data: lines, error: lErr } = await client
    .from("delivery_intake_lines")
    .select("*")
    .eq("intake_id", intakeId);
  if (lErr) throw lErr;

  return {
    header: toDeliveryIntakeHeader(header),
    lines: (lines ?? []).map(toDeliveryLine),
  };
}

export async function getBlindCopyById(blindCopyId) {
  const client = await supabase();
  const { data: header, error: hErr } = await client
    .from("blind_transfer_copies")
    .select("*")
    .eq("id", blindCopyId)
    .maybeSingle();
  if (hErr) throw hErr;
  if (!header) return null;

  // For parity with existing frontend usage, we return an empty list unless needed.
  const { data: lines, error: lErr } = await client
    .from("blind_transfer_copy_lines")
    .select("product_id,qty,unit_of_measure,batch_number,expiry_date,destination_bin")
    .eq("blind_copy_id", header.id);
  if (lErr) throw lErr;

  return {
    header: toBlindCopyHeader(header),
    lines: (lines ?? []).map((line) => ({
      productId: line.product_id,
      qty: line.qty,
      unitOfMeasure: line.unit_of_measure,
      batchNumber: line.batch_number,
      expiryDate: line.expiry_date,
      destinationBin: line.destination_bin,
    })),
  };
}

