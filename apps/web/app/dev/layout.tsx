import { notFound } from "next/navigation";

// The /dev labs are for the local dev server only (`next dev`). Any production build answers 404, so they never ship.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
