import { redirect } from "next/navigation";

// Session-aware redirect (→ /login when unauthenticated) lands in RFE-003/006.
export default function RootPage() {
  redirect("/dashboard");
}
