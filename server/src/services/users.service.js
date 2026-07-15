import { getSupabaseAdmin } from "../lib/supabase.js";
import { hashPassword } from "../lib/passwords.js";
import { isSupabaseAuthEnabled, signInWithSupabaseAuth } from "../lib/auth-supabase.js";
import { isSupabaseAdminEnabled } from "../lib/server-capabilities.js";
import { hasAuthUserIdColumn } from "../lib/auth-schema.js";
import { credentialsValid } from "../lib/auth-credentials.js";
import {
  isResendConfigured,
  sendPasswordChangedEmail,
  sendWelcomeEmail,
} from "./email.service.js";

const VALID_ROLES = new Set(["cashier", "manager", "senior_manager", "owner"]);

const USER_CREATE_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const userCreateIdempotencyCache = new Map(); // key -> { expiresAt, result }

const WELCOME_EMAIL_COOLDOWN_MS = 60 * 1000;

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
    phone: row.phone ?? null,
  };
}

const PROFILE_FIELDS = "id,name,email,role,password_hash,active,auth_user_id,phone";

export async function getUserByAuthId(authUserId) {
  const id = String(authUserId || "").trim();
  if (!id) return null;
  if (!(await hasAuthUserIdColumn())) return null;

  const client = await supabase();
  const { data, error } = await client
    .from("users")
    .select(PROFILE_FIELDS)
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
    phone: data.phone ?? null,
  };
}

export async function getUserByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle || !needle.includes("@") || /[%_]/.test(needle)) return null;

  const client = await supabase();

  const withAuth = await hasAuthUserIdColumn();
  const fields = withAuth ? PROFILE_FIELDS : "id,name,email,role,password_hash,active,phone";
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
    phone: data.phone ?? null,
  };
}

export async function getUserById(id) {
  const client = await supabase();
  const { data, error } = await client
    .from("users")
    .select("id,name,email,role,active,phone")
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
    .select("id,name,email,role,active,phone")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapUser);
}

export async function createUser({ name, email, role, password }, { idempotencyKey } = {}) {
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedRole = String(role || "").trim();
  const pwd = String(password || "");

  if (!trimmedName) throw new Error("Name is required");
  if (!trimmedEmail || !trimmedEmail.includes("@")) throw new Error("Valid email is required");
  if (!VALID_ROLES.has(trimmedRole)) throw new Error("Invalid role");
  if (pwd.length < 6) throw new Error("Password must be at least 6 characters");

  if (idempotencyKey && typeof idempotencyKey === "string") {
    const cached = userCreateIdempotencyCache.get(idempotencyKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const existing = await getUserByEmail(trimmedEmail);
  if (existing) throw new Error("A user with this email already exists");

  const client = await supabase();
  let authUserId = null;

  const linkAuth = await hasAuthUserIdColumn();

  const adminReady = isSupabaseAdminEnabled();
  const authSignInReady = isSupabaseAuthEnabled();
  // #region agent log
  fetch("http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a458c3" },
    body: JSON.stringify({
      sessionId: "a458c3",
      runId: "email-debug",
      hypothesisId: "H1",
      location: "users.service.js:createUser",
      message: "createUser auth capability check",
      data: { adminReady, authSignInReady, linkAuth },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (adminReady) {
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
  let emailSent = false;
  let emailError = null;

  if (!authUserId && adminReady) {
    emailError = "Sign-in could not be set up for this user.";
  } else if (!isResendConfigured()) {
    emailError = "Welcome email could not be sent.";
  } else if (authUserId) {
    try {
      await sendWelcomeEmail({
        email: trimmedEmail,
        name: trimmedName,
        role: trimmedRole,
      });
      emailSent = true;
    } catch (err) {
      // Already reported to Sentry in email.service (tags: service=email). Keep user create.
      emailError = err instanceof Error ? err.message : String(err);
      console.error("Welcome email failed:", emailError);
    }
  }

  const result = { ...created, emailSent, emailError };

  if (idempotencyKey && typeof idempotencyKey === "string") {
    userCreateIdempotencyCache.set(idempotencyKey, {
      expiresAt: Date.now() + USER_CREATE_IDEMPOTENCY_TTL_MS,
      result,
    });
  }

  return result;
}

/** Link a profile missing auth_user_id to Supabase Auth (existing or new account). */
async function repairUserAuthLink(userId) {
  if (!(await hasAuthUserIdColumn())) {
    throw new Error("Sign-in linking is not available");
  }
  if (!isSupabaseAdminEnabled()) {
    throw new Error("Sign-in setup is not available on the server");
  }

  const client = await supabase();
  const row = await getUserRecordById(userId);
  if (!row) throw new Error("User not found");
  if (row.authUserId) return row;

  const email = row.email.trim().toLowerCase();
  const tempPassword = `Kg${Date.now().toString(36)}!`;

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: row.name },
  });

  let authId = authData?.user?.id ?? null;
  if (authError) {
    if (/already registered|already exists/i.test(authError.message)) {
      const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw new Error(authError.message);
      authId = existing.id;
    } else {
      throw new Error(authError.message);
    }
  }
  if (!authId) throw new Error("Failed to set up sign-in for this user");

  const { error: updateError } = await client
    .from("users")
    .update({ auth_user_id: authId, password_hash: null })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  return getUserRecordById(userId);
}

export async function sendUserWelcomeEmail(id) {
  const current = await getUserRecordById(id);
  // #region agent log
  fetch("http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a458c3" },
    body: JSON.stringify({
      sessionId: "a458c3",
      runId: "email-debug",
      hypothesisId: "H1",
      location: "users.service.js:sendUserWelcomeEmail",
      message: "send welcome precheck",
      data: {
        userFound: Boolean(current),
        hasAuthUserId: Boolean(current?.authUserId),
        resendReady: isResendConfigured(),
        adminReady: isSupabaseAdminEnabled(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!current) throw new Error("User not found");
  let profile = current;
  if (!profile.authUserId) {
    // #region agent log
    fetch("http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a458c3" },
      body: JSON.stringify({
        sessionId: "a458c3",
        runId: "email-debug",
        hypothesisId: "H1",
        location: "users.service.js:sendUserWelcomeEmail",
        message: "repairing missing auth_user_id",
        data: { userId: id },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    profile = await repairUserAuthLink(id);
  }
  if (!profile?.authUserId) {
    throw new Error("This user cannot receive a welcome email. Contact an owner for help.");
  }
  if (!isResendConfigured()) {
    throw new Error("Welcome email could not be sent. Try again later.");
  }

  const client = await supabase();
  const { data: cooldownRow } = await client
    .from("users")
    .select("last_welcome_email_at")
    .eq("id", id)
    .maybeSingle();

  if (cooldownRow?.last_welcome_email_at) {
    const lastSent = new Date(cooldownRow.last_welcome_email_at).getTime();
    if (Date.now() - lastSent < WELCOME_EMAIL_COOLDOWN_MS) {
      throw new Error("Welcome email was sent recently. Please wait a minute before resending.");
    }
  }

  await sendWelcomeEmail({
    email: profile.email,
    name: profile.name,
    role: profile.role,
  });

  await client
    .from("users")
    .update({ last_welcome_email_at: new Date().toISOString() })
    .eq("id", id);

  return { ok: true, emailSent: true };
}

/** Find a King G or Supabase Auth user eligible for password-reset email. */
export async function resolvePasswordResetRecipient(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle || !needle.includes("@")) return null;

  const profile = await getUserByEmail(needle);
  if (profile?.active === false) return null;
  if (profile?.authUserId) {
    return { email: needle, name: profile.name || needle };
  }

  if (!isSupabaseAuthEnabled()) return null;
  const client = await supabase();
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;

  const authUser = data?.users?.find((u) => u.email?.toLowerCase() === needle);
  if (!authUser) return null;

  return {
    email: needle,
    name: authUser.user_metadata?.display_name || profile?.name || needle,
  };
}

export async function updateUser(id, { name, email, role, active, phone }) {
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
  if (phone !== undefined) {
    const trimmed = String(phone || "").trim();
    patch.phone = trimmed || null;
  }

  if (Object.keys(patch).length === 0) {
    return mapUser({
      id: current.id,
      name: current.name,
      email: current.email,
      role: current.role,
      active: current.active,
      auth_user_id: current.authUserId,
      phone: current.phone ?? null,
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
    .select("id,name,email,role,active,phone")
    .single();
  if (error) throw error;
  return mapUser(data);
}

async function getUserRecordById(id) {
  const client = await supabase();
  const withAuth = await hasAuthUserIdColumn();
  const fields = withAuth ? PROFILE_FIELDS : "id,name,email,role,password_hash,active,phone";
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
    phone: data.phone ?? null,
  };
}

/** Self-service profile update (name, email, phone only). */
export async function updateOwnProfile(userId, { name, email, phone }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email;
  if (phone !== undefined) patch.phone = phone;
  if (Object.keys(patch).length === 0) {
    const current = await getUserById(userId);
    if (!current) throw new Error("User not found");
    return current;
  }
  return updateUser(userId, patch);
}

/** Self-service password change with current-password verification. */
export async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const current = String(currentPassword || "");
  const next = String(newPassword || "");
  if (!current) throw new Error("Current password is required");
  if (next.length < 6) throw new Error("New password must be at least 6 characters");

  const record = await getUserRecordById(userId);
  if (!record) throw new Error("User not found");

  if (record.authUserId && (await hasAuthUserIdColumn()) && isSupabaseAuthEnabled()) {
    const verified = await signInWithSupabaseAuth(record.email, current);
    if (!verified?.ok) {
      throw new Error("Current password is incorrect");
    }
    return updateUserPassword(userId, next);
  }

  if (!credentialsValid(record, current)) {
    throw new Error("Current password is incorrect");
  }
  return updateUserPassword(userId, next);
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
        // Already reported to Sentry in email.service. Password update still succeeds.
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
