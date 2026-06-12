import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AcceptButton from "./AcceptButton";

export const metadata: Metadata = { title: "Team Invitation" };

export default async function TeamAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { inviteToken: token },
    include: { owner: { select: { name: true, email: true } } },
  });

  if (!teamMember || teamMember.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
        <div className="max-w-md w-full bg-surface-secondary rounded-xl border border-border-default p-8 text-center">
          <h1 className="text-xl font-semibold text-text-primary mb-2">
            Invitation Not Found
          </h1>
          <p className="text-sm text-text-secondary">
            This invitation link is invalid or has already been used.
          </p>
        </div>
      </div>
    );
  }

  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user?.email;
  const emailMatches = session?.user?.email === teamMember.memberEmail;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
      <div className="max-w-md w-full bg-surface-secondary rounded-xl border border-border-default p-8">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <svg
              className="h-6 w-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">
            Team Invitation
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            You&apos;ve been invited to join a team
          </p>
        </div>

        <div className="bg-surface-tertiary rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Business</span>
            <span className="text-text-primary font-medium">
              {teamMember.owner.name || teamMember.owner.email}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Invited Email</span>
            <span className="text-text-primary font-medium">
              {teamMember.memberEmail}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Role</span>
            <span className="text-text-primary font-medium capitalize">
              {teamMember.role}
            </span>
          </div>
        </div>

        {isLoggedIn && emailMatches ? (
          <AcceptButton token={token} />
        ) : isLoggedIn ? (
          <div className="text-center">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-text-secondary">
                You are logged in as <strong>{session?.user?.email}</strong>,
                but this invitation was sent to{" "}
                <strong>{teamMember.memberEmail}</strong>.
              </p>
            </div>
            <a
              href={`/api/auth/signout?callbackUrl=/team/accept?token=${token}`}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
            >
              Switch Account
            </a>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-4">
              Please sign in with the email address this invitation was sent to.
            </p>
            <a
              href={`/api/auth/signin?callbackUrl=/team/accept?token=${token}`}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
            >
              Sign In to Accept
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
