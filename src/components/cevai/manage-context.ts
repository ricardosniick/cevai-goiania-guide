import { createContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { Experience } from "./types";

/** Lets cards owned by the signed-in user open the edit form and refresh lists after changes. */
export const ManageCtx = createContext<{ user: User; notify: (m: string) => void; onEdit: (e: Experience) => void } | null>(null);
