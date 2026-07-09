import { getSupabaseAdmin } from "../lib/supabase.js";

const BUCKET = "delivery-documents";
const SIGNED_URL_TTL_SEC = 3600;

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 10 * 1024 * 1024;

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateFile(file, label) {
  if (!file || !file.buffer?.length) {
    throw new Error(`${label} is required`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`${label} must be under 10 MB`);
  }
  const mime = String(file.mimetype || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`${label} must be PDF, JPEG, or PNG`);
  }
  const ext = (file.originalname || "").split(".").pop()?.toLowerCase();
  if (!ext || !["pdf", "jpg", "jpeg", "png"].includes(ext)) {
    throw new Error(`${label} must have a .pdf, .jpg, .jpeg, or .png extension`);
  }
}

async function supabase() {
  return getSupabaseAdmin();
}

function mapRecord(row) {
  return {
    id: row.id,
    poRef: row.po_ref,
    supplier: row.supplier,
    invoiceRef: row.invoice_ref ?? null,
    status: row.status,
    invoiceFileName: row.invoice_file_name ?? null,
    podFileName: row.pod_file_name ?? null,
    hasInvoice: Boolean(row.invoice_storage_path),
    hasPod: Boolean(row.pod_storage_path),
    createdAt: row.created_at,
  };
}

export async function listDeliveryRecords() {
  const client = await supabase();
  const { data, error } = await client
    .from("delivery_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRecord);
}

export async function createDeliveryRecord({
  poRef,
  supplier,
  invoiceRef,
  invoiceFile,
  podFile,
  uploadedBy,
}) {
  const trimmedPo = String(poRef || "").trim();
  const trimmedSupplier = String(supplier || "").trim();
  if (!trimmedPo) throw new Error("PO reference is required");
  if (!trimmedSupplier) throw new Error("Supplier is required");

  validateFile(invoiceFile, "Invoice");
  validateFile(podFile, "Proof of delivery");

  const client = await supabase();
  const id = randomId("DEL");
  const basePath = `${id}`;

  const invoicePath = `${basePath}/invoice-${Date.now()}.${invoiceFile.originalname.split(".").pop()}`;
  const podPath = `${basePath}/pod-${Date.now()}.${podFile.originalname.split(".").pop()}`;

  const { error: invoiceErr } = await client.storage
    .from(BUCKET)
    .upload(invoicePath, invoiceFile.buffer, {
      contentType: invoiceFile.mimetype,
      upsert: false,
    });
  if (invoiceErr) throw new Error("Invoice upload failed");

  const { error: podErr } = await client.storage
    .from(BUCKET)
    .upload(podPath, podFile.buffer, {
      contentType: podFile.mimetype,
      upsert: false,
    });
  if (podErr) {
    await client.storage.from(BUCKET).remove([invoicePath]).catch(() => {});
    throw new Error("POD upload failed");
  }

  const row = {
    id,
    po_ref: trimmedPo,
    supplier: trimmedSupplier,
    invoice_ref: String(invoiceRef || "").trim() || null,
    status: "pending",
    invoice_storage_path: invoicePath,
    pod_storage_path: podPath,
    invoice_file_name: invoiceFile.originalname,
    pod_file_name: podFile.originalname,
    uploaded_by: uploadedBy ?? null,
  };

  const { data, error } = await client.from("delivery_records").insert(row).select("*").single();
  if (error) {
    await client.storage.from(BUCKET).remove([invoicePath, podPath]).catch(() => {});
    throw error;
  }

  return mapRecord(data);
}

export async function getDeliveryDocumentUrl(recordId, docType) {
  const client = await supabase();
  const { data, error } = await client.from("delivery_records").select("*").eq("id", recordId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Delivery record not found");

  const path = docType === "invoice" ? data.invoice_storage_path : data.pod_storage_path;
  if (!path) throw new Error("Document not found");

  const { data: signed, error: signErr } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (signErr) throw signErr;
  return { url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SEC };
}
