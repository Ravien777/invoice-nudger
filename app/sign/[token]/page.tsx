import { prisma } from "@/lib/prisma";
import SignContractClient from "./SignContractClient";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { signingToken: token },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      signedAt: true,
      signedByName: true,
      clientName: true,
      signingToken: true,
      expiresAt: true,
      pdfUrl: true,
    },
  });

  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Contract not found</h1>
          <p className="text-gray-500">
            This link may be invalid or the contract may have been removed.
          </p>
        </div>
      </div>
    );
  }

  if (contract.expiresAt && contract.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Contract has expired</h1>
          <p className="text-gray-500">
            This contract expired on{" "}
            {new Date(contract.expiresAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            . Contact the sender for a new one.
          </p>
        </div>
      </div>
    );
  }

  if (contract.status === "signed") {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Contract signed ✓</h1>
            <p className="text-gray-500 mt-1">
              Signed by {contract.signedByName} on{" "}
              {contract.signedAt &&
                new Date(contract.signedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
            </p>
            {contract.pdfUrl && (
              <a
                href={contract.pdfUrl}
                download
                className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Download PDF
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 md:p-10">
            <h1 className="text-xl font-bold text-gray-800 mb-1">{contract.title}</h1>
            <p className="text-sm text-gray-500 mb-6">
              Prepared for {contract.clientName}
            </p>
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: contract.body }}
            />
          </div>
        </div>
        <SignContractClient
          contractId={contract.id}
          token={contract.signingToken}
          title={contract.title}
          clientName={contract.clientName}
        />
      </div>
    </div>
  );
}
