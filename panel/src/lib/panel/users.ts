import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  countUsers,
  deleteUserRow,
  findUserRowByEmail,
  findUserRowById,
  findUserRowByOidcSubject,
  getSetting,
  insertUserRow,
  isPrimaryUserId,
  listUserRows,
  PRIMARY_USER_ROLE,
  setSetting,
  updateUserRow,
} from "@/lib/panel/store";
import { decryptSecret, encryptSecret } from "@/lib/panel/crypto";
import type { PanelRole } from "@/lib/panel/permissions";
import { getClusterConnection, listClusters } from "@/lib/panel/clusters";

export interface PanelUser {
  id: string;
  email: string;
  name: string;
  role: PanelRole;
  oidcSubject: string | null;
  hasPassword: boolean;
  createdAt: number;
}

export function resolveEffectiveRole(userId: string, role: PanelRole): PanelRole {
  return isPrimaryUserId(userId) ? PRIMARY_USER_ROLE : role;
}

export function isPrimaryUser(user: Pick<PanelUser, "id">): boolean {
  return isPrimaryUserId(user.id);
}

function mapUser(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  oidc_subject: string | null;
  password_hash: string | null;
  created_at: number;
}): PanelUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: resolveEffectiveRole(row.id, row.role as PanelRole),
    oidcSubject: row.oidc_subject,
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
  };
}

export function needsSetup(): boolean {
  return countUsers() === 0;
}

export function findUserByEmail(email: string) {
  return findUserRowByEmail(email);
}

export function findUserById(id: string) {
  return findUserRowById(id);
}

export function findUserByOidcSubject(subject: string) {
  return findUserRowByOidcSubject(subject);
}

export function listUsers(): PanelUser[] {
  return listUserRows().map(mapUser);
}

export async function createUser(input: {
  email: string;
  name: string;
  password?: string;
  role?: PanelRole;
  oidcSubject?: string;
}): Promise<PanelUser> {
  const id = randomUUID();
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
  const isFirstUser = countUsers() === 0;
  insertUserRow({
    id,
    email: input.email.toLowerCase(),
    name: input.name,
    password_hash: passwordHash,
    role: isFirstUser ? PRIMARY_USER_ROLE : (input.role ?? "viewer"),
    oidc_subject: input.oidcSubject ?? null,
    created_at: Date.now(),
  });
  return mapUser(findUserRowById(id)!);
}

export async function verifyPassword(email: string, password: string): Promise<PanelUser | null> {
  const row = findUserByEmail(email);
  if (!row?.password_hash) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? mapUser(row) : null;
}

export function updateUser(
  id: string,
  patch: { name?: string; role?: PanelRole; password?: string },
): PanelUser | null {
  const row = findUserById(id);
  if (!row) return null;

  const name = patch.name ?? row.name;
  const role = isPrimaryUserId(id) ? PRIMARY_USER_ROLE : (patch.role ?? row.role);
  let passwordHash = row.password_hash;
  if (patch.password) {
    passwordHash = bcrypt.hashSync(patch.password, 12);
  }

  updateUserRow(id, { name, role, password_hash: passwordHash });
  return mapUser(findUserRowById(id)!);
}

export function deleteUser(id: string): boolean {
  return deleteUserRow(id);
}

export interface UniverseConnectionConfig {
  apiUrl: string;
  apiToken: string;
  configured: boolean;
}

/** Legacy sync helper — prefer resolveActiveClusterConnection in async routes */
export function getUniverseConnection(): UniverseConnectionConfig | null {
  const clusters = listClusters();
  const id = getSetting("active_cluster_id") ?? clusters[0]?.id;
  if (!id) return null;
  const conn = getClusterConnection(id);
  if (!conn) return null;
  return { apiUrl: conn.apiUrl, apiToken: conn.apiToken, configured: true };
}

export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  defaultRole: PanelRole;
}

export function getOidcConfig(): OidcConfig {
  return {
    enabled: getSetting("oidc.enabled") === "true",
    issuer: getSetting("oidc.issuer") ?? "",
    clientId: getSetting("oidc.client_id") ?? "",
    clientSecret: getSetting("oidc.client_secret")
      ? decryptSecret(getSetting("oidc.client_secret")!)
      : "",
    defaultRole: (getSetting("oidc.default_role") as PanelRole) ?? "viewer",
  };
}

export function setOidcConfig(config: {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  defaultRole: PanelRole;
}) {
  setSetting("oidc.enabled", String(config.enabled));
  setSetting("oidc.issuer", config.issuer.replace(/\/$/, ""));
  setSetting("oidc.client_id", config.clientId);
  if (config.clientSecret) {
    setSetting("oidc.client_secret", encryptSecret(config.clientSecret));
  }
  setSetting("oidc.default_role", config.defaultRole);
}

export function getOidcPublicConfig() {
  const cfg = getOidcConfig();
  return {
    enabled: cfg.enabled && !!cfg.issuer && !!cfg.clientId,
    issuer: cfg.issuer,
    clientId: cfg.clientId,
  };
}

export async function linkOidcUser(input: {
  subject: string;
  email: string;
  name: string;
  defaultRole: PanelRole;
}): Promise<PanelUser> {
  const existing = findUserByOidcSubject(input.subject);
  if (existing) return mapUser(existing);

  const byEmail = findUserByEmail(input.email);
  if (byEmail) {
    updateUserRow(byEmail.id, { oidc_subject: input.subject });
    return mapUser(findUserRowById(byEmail.id)!);
  }

  return createUser({
    email: input.email,
    name: input.name,
    role: input.defaultRole,
    oidcSubject: input.subject,
  });
}
