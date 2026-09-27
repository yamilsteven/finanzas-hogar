"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type HouseholdMemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member" | "viewer";
  member_key: string;
  display_name: string;
  status: string;
};

export type HouseholdRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  created_at?: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  active_household_id: string | null;
  primary_currency: string;
};

type AuthState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  household: HouseholdRow | null;
  members: HouseholdMemberRow[];
  myMembership: HouseholdMemberRow | null;
  isPlatformAdmin: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
  setActiveHousehold: (householdId: string) => Promise<{ error?: string }>;
};

async function loadContext(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      profile: null,
      household: null,
      members: [] as HouseholdMemberRow[],
      myMembership: null,
      isPlatformAdmin: false,
    };
  }

  const [{ data: profile }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let householdId = profile?.active_household_id as string | null;

  if (!householdId) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    householdId = membership?.household_id ?? null;
  }

  if (!householdId) {
    return {
      profile: (profile as ProfileRow) ?? null,
      household: null,
      members: [] as HouseholdMemberRow[],
      myMembership: null,
      isPlatformAdmin: Boolean(adminRow),
    };
  }

  const [{ data: household }, { data: members }] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).maybeSingle(),
    supabase
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .eq("status", "active")
      .order("member_key"),
  ]);

  const list = (members as HouseholdMemberRow[]) ?? [];
  const myMembership = list.find((m) => m.user_id === userId) ?? null;

  return {
    profile: (profile as ProfileRow) ?? null,
    household: (household as HouseholdRow) ?? null,
    members: list,
    myMembership,
    isPlatformAdmin: Boolean(adminRow),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  user: null,
  profile: null,
  household: null,
  members: [],
  myMembership: null,
  isPlatformAdmin: false,
  error: null,

  bootstrap: async () => {
    const { configured } = getSupabaseConfig();
    if (!configured) {
      set({ ready: true, session: null, user: null, error: null });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      set({ ready: true });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      set({
        ready: true,
        session: null,
        user: null,
        profile: null,
        household: null,
        members: [],
        myMembership: null,
        isPlatformAdmin: false,
      });
    } else {
      const ctx = await loadContext(session.user.id);
      set({
        ready: true,
        session,
        user: session.user,
        ...ctx,
        error: null,
      });
    }

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!nextSession?.user) {
        set({
          session: null,
          user: null,
          profile: null,
          household: null,
          members: [],
          myMembership: null,
          isPlatformAdmin: false,
        });
        return;
      }
      const ctx = await loadContext(nextSession.user.id);
      set({
        session: nextSession,
        user: nextSession.user,
        ...ctx,
        error: null,
      });
    });
  },

  signIn: async (email, password) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { error: "Supabase no está configurado (.env.local)" };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    if (!data.session?.user) return { error: "No se pudo iniciar sesión" };

    const ctx = await loadContext(data.session.user.id);
    set({
      session: data.session,
      user: data.session.user,
      ...ctx,
      error: null,
      ready: true,
    });
    return {};
  },

  signUp: async (email, password) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { error: "Supabase no está configurado (.env.local)" };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    if (!data.session?.user) {
      return {
        error:
          "Cuenta creada. Si el proyecto exige confirmar email, revisa tu bandeja y luego inicia sesión.",
      };
    }

    const ctx = await loadContext(data.session.user.id);
    set({
      session: data.session,
      user: data.session.user,
      ...ctx,
      error: null,
      ready: true,
    });
    return {};
  },

  signOut: async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      household: null,
      members: [],
      myMembership: null,
      isPlatformAdmin: false,
    });
  },

  refreshHousehold: async () => {
    const user = get().user;
    if (!user) return;
    const ctx = await loadContext(user.id);
    set(ctx);
  },

  setActiveHousehold: async (householdId) => {
    const supabase = getSupabaseBrowserClient();
    const user = get().user;
    if (!supabase || !user) {
      return { error: "Sin sesión" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        active_household_id: householdId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) return { error: error.message };

    const ctx = await loadContext(user.id);
    set(ctx);
    return {};
  },
}));
