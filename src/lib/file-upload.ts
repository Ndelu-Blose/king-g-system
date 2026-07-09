const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png']);
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateUploadFile(
  file: File | null | undefined,
  label: string,
  { required = true }: { required?: boolean } = {}
): FileValidationResult {
  if (!file) {
    if (required) return { ok: false, message: `${label} is required.` };
    return { ok: true };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: `${label} must be under 10 MB.` };
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, message: `${label} must be PDF, JPEG, or PNG.` };
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return { ok: false, message: `${label} must have a .pdf, .jpg, .jpeg, or .png extension.` };
  }
  return { ok: true };
}

export async function uploadIncidentAttachment(
  file: File,
  incidentId: string
): Promise<{ storagePath: string; fileName: string }> {
  const check = validateUploadFile(file, 'Attachment', { required: true });
  if (!check.ok) throw new Error(check.message);

  const { getSupabase } = await import('./supabase');
  const client = getSupabase();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const storagePath = `${incidentId}/attachment-${Date.now()}.${ext}`;

  const { error } = await client.storage.from('incident-attachments').upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error('Attachment upload failed. Please try again.');

  return { storagePath, fileName: file.name };
}

export async function getIncidentAttachmentUrl(storagePath: string): Promise<string> {
  const { getSupabase } = await import('./supabase');
  const client = getSupabase();
  const { data, error } = await client.storage
    .from('incident-attachments')
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) throw new Error('Failed to open attachment');
  return data.signedUrl;
}
