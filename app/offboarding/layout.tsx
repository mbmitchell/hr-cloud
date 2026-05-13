import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offboarding",
};

export default function OffboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
