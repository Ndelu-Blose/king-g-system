import { getSupabaseAdmin } from "../lib/supabase.js";
import { hashPassword } from "../lib/passwords.js";

const VALID_ROLES = new Set(["cashier", "manager", "senior_manager", "owner"]);

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function supabase() {
  return getSupabaseAdmin();
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active !== false,
  };
}

export async function getUserByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle || !needle.includes("@") || /[%_]/.test(needle)) return null;

  const client = await supabase();

  const { data, error } = await client
    .from("users")
    .select("id,name,email,role,password_hash,active")
    .eq("email", needle)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    passwordHash: data.password_hash ?? null,
    active: data.active !== false,
  };
}

export async function getUserById(id) {
  const client = await supabase();
  const { data, error } = await client
    .from("users")
    .select("id,name,email,role,active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapUser(data);
}

export async function listUsers() {
  const client = await supabase();
  const { data, error } = await client
    .from("users")
    .select("id,name,email,role,active")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapUser);
}

export async function createUser({ name, email, role, password }) {
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedRole = String(role || "").trim();
  const pwd = String(password || "");

  if (!trimmedName) throw new Error("Name is required");
  if (!trimmedEmail || !trimmedEmail.includes("@")) throw new Error("Valid email is required");
  if (!VALID_ROLES.has(trimmedRole)) throw new Error("Invalid role");
  if (pwd.length < 6) throw new Error("Password must be at least 6 characters");

  const existing = await getUserByEmail(trimmedEmail);
  if (existing) throw new Error("A user with this email already exists");

  const client = await supabase();
  const row = {
    id: randomId("user"),
    name: trimmedName,
    email: trimmedEmail,
    role: trimmedRole,
    password_hash: hashPassword(pwd),
    active: true,
  };
  const { data, error } = await client.from("users").insert(row).select("id,name,email,role,active").single();
  if (error) throw error;
  return mapUser(data);
}

export async function updateUser(id, { name, email, role, active }) {
  const client = await supabase();
  const current = await getUserById(id);
  if (!current) throw new Error("User not found");

  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new Error("Name is required");
    patch.name = trimmed;
  }
  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) throw new Error("Valid email is required");
    if (trimmed !== current.email.toLowerCase()) {
      const existing = await getUserByEmail(trimmed);
      if (existing && existing.id !== id) throw new Error("A user with this email already exists");
    }
    patch.email = trimmed;
  }
  if (role !== undefined) {
    const trimmedRole = String(role).trim();
    if (!VALID_ROLES.has(trimmedRole)) throw new Error("Invalid role");
    patch.role = trimmedRole;
  }
  if (active !== undefined) patch.active = !!active;

  if (Object.keys(patch).length === 0) return current;

  const { data, error } = await client
    .from("users")
    .update(patch)
    .eq("id", id)
    .select("id,name,email,role,active")
    .single();
  if (error) throw error;
  return mapUser(data);
}

export async function updateUserPassword(id, password) {
  const pwd = String(password || "");
  if (pwd.length < 6) throw new Error("Password must be at least 6 characters");

  const client = await supabase();
  const current = await getUserById(id);
  if (!current) throw new Error("User not found");

  const { error } = await client
    .from("users")
    .update({ password_hash: hashPassword(pwd) })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function deleteUser(id) {
  const client = await supabase();
  const current = await getUserById(id);
  if (!current) throw new Error("User not found");

  const { error } = await client.from("users").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
