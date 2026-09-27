"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { HouseholdMemberRow, HouseholdRow } from "@/store/authStore";

export type InvitationRow = {
  id: string;
  household_id: string;
  email: string;
  role: "owner" | "member" | "viewer";
  member_key: string;
  display_name: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
};

export type HouseholdListItem = HouseholdRow & {
  member_count: number;
};

export type CreateHouseholdResult = {
  ok: boolean;
  household_id: string;
  mode: "member_linked" | "invite_pending";
  owner_user_id: string | null;
  invite_token: string | null;
};

export function inviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

export async function listHouseholdsForAdmin(): Promise<{
  data: HouseholdListItem[];
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: [], error: "Supabase no configurado" };

  const { data: households, error } = await supabase
    .from("households")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  const list = (households as HouseholdRow[]) ?? [];
  if (list.length === 0) return { data: [] };

  const ids = list.map((h) => h.id);
  const { data: members, error: memErr } = await supabase
    .from("household_members")
    .select("household_id")
    .in("household_id", ids)
    .eq("status", "active");

  if (memErr) return { data: [], error: memErr.message };

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const hid = (m as { household_id: string }).household_id;
    counts.set(hid, (counts.get(hid) ?? 0) + 1);
  }

  return {
    data: list.map((h) => ({
      ...h,
      member_count: counts.get(h.id) ?? 0,
    })),
  };
}

export async function listMembersForHousehold(
  householdId: string
): Promise<{ data: HouseholdMemberRow[]; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: [], error: "Supabase no configurado" };

  const { data, error } = await supabase
    .from("household_members")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("member_key");

  if (error) return { data: [], error: error.message };
  return { data: (data as HouseholdMemberRow[]) ?? [] };
}

export async function listInvitationsForHousehold(
  householdId: string
): Promise<{ data: InvitationRow[]; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: [], error: "Supabase no configurado" };

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as InvitationRow[]) ?? [] };
}

export async function createHouseholdAsAdmin(input: {
  name: string;
  ownerEmail: string;
  ownerDisplayName: string;
  ownerMemberKey?: string;
}): Promise<{ data?: CreateHouseholdResult; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const { data, error } = await supabase.rpc("create_household_as_admin", {
    p_name: input.name,
    p_owner_email: input.ownerEmail,
    p_owner_display_name: input.ownerDisplayName,
    p_owner_member_key: input.ownerMemberKey ?? "a",
  });

  if (error) return { error: error.message };
  return { data: data as CreateHouseholdResult };
}

export async function createInvitation(input: {
  householdId: string;
  email: string;
  displayName: string;
  memberKey: string;
  role?: "owner" | "member" | "viewer";
}): Promise<{ token?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const { data, error } = await supabase.rpc("create_invitation", {
    p_household_id: input.householdId,
    p_email: input.email,
    p_display_name: input.displayName,
    p_member_key: input.memberKey,
    p_role: input.role ?? "member",
  });

  if (error) return { error: error.message };
  const row = data as { invite_token?: string };
  return { token: row.invite_token };
}

export async function revokeInvitation(
  invitationId: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteHouseholdAsAdmin(
  householdId: string
): Promise<{ error?: string; name?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const { data, error } = await supabase.rpc("delete_household_as_admin", {
    p_household_id: householdId,
  });

  if (error) return { error: error.message };
  const row = data as { name?: string; ok?: boolean };
  return { name: row.name };
}

export async function acceptInvitation(
  token: string
): Promise<{ householdId?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) return { error: error.message };
  const row = data as { household_id?: string };
  return { householdId: row.household_id };
}

export async function getInvitationByToken(token: string): Promise<{
  data?: InvitationRow & { household_name?: string };
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const { data, error } = await supabase.rpc("peek_invitation", {
    p_token: token,
  });

  if (error) return { error: error.message };
  if (!data) return { error: "Invitación no encontrada" };

  const row = data as {
    id: string;
    household_id: string;
    household_name?: string;
    email: string;
    role: "owner" | "member" | "viewer";
    member_key: string;
    display_name: string;
    status: string;
    expires_at: string;
    token: string;
  };

  return {
    data: {
      id: row.id,
      household_id: row.household_id,
      email: row.email,
      role: row.role,
      member_key: row.member_key,
      display_name: row.display_name,
      token: row.token,
      status: row.status,
      expires_at: row.expires_at,
      created_at: "",
      accepted_at: null,
      household_name: row.household_name,
    },
  };
}
