import { getSupabaseAdmin } from "../lib/supabase.js";
import { hashPassword } from "../lib/passwords.js";
import { isSupabaseAuthEnabled } from "../lib/auth-supabase.js";
import { hasAuthUserIdColumn } from "../lib/auth-schema.js";
import {
  isResendConfigured,
  sendPasswordChangedEmail,
  sendWelcomeEmail,
} from "./email.service.js";

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
    authUserId: row.auth_user_id ?? null,
  };
}

export async function getUserByAuthId(authUserId) {
  const id = String(authUserId || "").trim();
  if (!id) return null;
  if (!(await hasAuthUserIdColumn())) return null;

  const client = await supabase();
  const { data, error } = await client
    .from("users")
    .select("id,name,email,role,password_hash,active,auth_user_id")
    .eq("auth_user_id", id)
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
    authUserId: data.auth_user_id ?? null,
  };
}

export async function getUserByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle || !needle.includes("@") || /[%_]/.test(needle)) return null;

  const client = await supabase();

  const withAuth = await hasAuthUserIdColumn();
  const fields = withAuth
    ? "id,name,email,role,password_hash,active,auth_user_id"
    : "id,name,email,role,password_hash,active";
  const { data, error } = await client
    .from("users")
    .select(fields)
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
    authUserId: data.auth_user_id ?? null,
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
  let authUserId = null;

  const linkAuth = await hasAuthUserIdColumn();

  if (isSupabaseAuthEnabled()) {
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: trimmedEmail,
      password: pwd,
      email_confirm: true,
      user_metadata: { display_name: trimmedName },
    });
    if (authError) {
      const msg = authError.message || "Failed to create auth user";
      if (/already registered|already exists/i.test(msg)) {
        throw new Error("A user with this email already exists in Authentication");
      }
      throw new Error(msg);
    }
    authUserId = authData.user?.id ?? null;
  }

  const row = {
    id: randomId("user"),
    name: trimmedName,
    email: trimmedEmail,
    role: trimmedRole,
    password_hash: authUserId && linkAuth ? null : hashPassword(pwd),
    active: true,
  };
  if (linkAuth && authUserId) row.auth_user_id = authUserId;

  const selectFields = linkAuth ? "id,name,email,role,active,auth_user_id" : "id,name,email,role,active";
  const { data, error } = await client.from("users").insert(row).select(selectFields).single();
  if (error) {
    if (authUserId) {
      await client.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    throw error;
  }

  const created = mapUser(data);
  if (authUserId && isResendConfigured()) {
    try {
      await sendWelcomeEmail({
        email: trimmedEmail,
        name: trimmedName,
        role: trimmedRole,
      });
    } catch (emailError) {
      console.error("Welcome email failed:", emailError?.message || emailError);
    }
  }
  return created;
}

export async function updateUser(id, { name, email, role, active }) {
  const client = await supabase();
  const current = await getUserRecordById(id);
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

  if (Object.keys(patch).length === 0) {
    return mapUser({
      id: current.id,
      name: current.name,
      email: current.email,
      role: current.role,
      active: current.active,
      auth_user_id: current.authUserId,
    });
  }

  if (
    patch.email &&
    patch.email !== current.email.toLowerCase() &&
    current.authUserId &&
    (await hasAuthUserIdColumn()) &&
    isSupabaseAuthEnabled()
  ) {
    const { error: authEmailError } = await client.auth.admin.updateUserById(current.authUserId, {
      email: patch.email,
    });
    if (authEmailError) {
      throw new Error(authEmailError.message || "Failed to update auth email");
    }
  }

  const { data, error } = await client
    .from("users")
    .update(patch)
    .eq("id", id)
    .select("id,name,email,role,active")
    .single();
  if (error) throw error;
  return mapUser(data);
}

async function getUserRecordById(id) {
  const client = await supabase();
  const withAuth = await hasAuthUserIdColumn();
  const fields = withAuth
    ? "id,name,email,role,password_hash,active,auth_user_id"
    : "id,name,email,role,password_hash,active";
  const { data, error } = await client.from("users").select(fields).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    passwordHash: data.password_hash ?? null,
    active: data.active !== false,
    authUserId: data.auth_user_id ?? null,
  };
}

export async function updateUserPassword(id, password) {
  const pwd = String(password || "");
  if (pwd.length < 6) throw new Error("Password must be at least 6 characters");

  const client = await supabase();
  const current = await getUserRecordById(id);
  if (!current) throw new Error("User not found");

  if (current.authUserId && (await hasAuthUserIdColumn()) && isSupabaseAuthEnabled()) {
    const { error: authError } = await client.auth.admin.updateUserById(current.authUserId, {
      password: pwd,
    });
    if (authError) throw new Error(authError.message || "Failed to update auth password");

    if (isResendConfigured()) {
      try {
        await sendPasswordChangedEmail({ email: current.email, name: current.name });
      } catch (emailError) {
        console.error("Password-changed email failed:", emailError?.message || emailError);
      }
    }
    return { ok: true };
  }

  const { error } = await client
    .from("users")
    .update({ password_hash: hashPassword(pwd) })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function deleteUser(id) {
  const client = await supabase();
  const withAuth = await hasAuthUserIdColumn();
  const { data: row, error: fetchError } = await client
    .from("users")
    .select(withAuth ? "id,auth_user_id" : "id")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!row) throw new Error("User not found");

  if (row.auth_user_id && (await hasAuthUserIdColumn()) && isSupabaseAuthEnabled()) {
    const { error: authError } = await client.auth.admin.deleteUser(row.auth_user_id);
    if (authError) throw new Error(authError.message || "Failed to delete auth user");
  }

  const { error } = await client.from("users").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
