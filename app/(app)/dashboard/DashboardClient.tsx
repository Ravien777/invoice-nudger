"use client";

import OnboardingModal from "../components/OnboardingModal";
import { useState } from "react";

export default function DashboardClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [onboardingDone, setOnboardingDone] = useState(false);

  return (
    <>
      <OnboardingModal
        open={!onboardingDone}
        onDismiss={() => setOnboardingDone(true)}
      />
      {children}
    </>
  );
}
