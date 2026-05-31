import { computeCollectionEfficiencyForUser } from "@/lib/analytics";
import EfficiencyWidget from "./EfficiencyWidget";

export default async function EfficiencySection({
  userId, plan,
}: {
  userId: string; plan: string;
}) {
  const metrics = await computeCollectionEfficiencyForUser(userId);

  return (
    <div className="mb-8">
      <EfficiencyWidget metrics={metrics} plan={plan} />
    </div>
  );
}
