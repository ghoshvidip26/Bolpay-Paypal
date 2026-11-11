"use client";

import { createContext, useContext } from "react";

export type ViewerRole = "owner" | "supervisor";

export interface Viewer {
  displayName: string;
  role: ViewerRole;
  businessName: string;
}

/**
 * Who is signed in, from the verified server session. Only decides what the UI shows:
 * the API checks the role again on every request.
 */
const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return <ViewerContext value={viewer}>{children}</ViewerContext>;
}

export function useViewer() {
  const v = useContext(ViewerContext);
  if (!v) throw new Error("useViewer must be used inside <ViewerProvider>");
  return { ...v, isOwner: v.role === "owner" };
}

/** Some accounts carry the role in their name ("Priyanka (Owner)"); the role is shown separately. */
export function personName(displayName: string) {
  return displayName.replace(/\s*\((owner|supervisor)\)\s*$/i, "") || displayName;
}
