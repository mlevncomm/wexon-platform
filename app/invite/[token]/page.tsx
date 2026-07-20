import { lookupStaffInviteByPlaintext } from "@/lib/wexpay-staff-invite";
import { maskEmailHint } from "@/lib/wexon-email";
import { InviteAcceptForm } from "@/components/wexpay/InviteAcceptForm";

type Params = Promise<{ token: string }>;

export default async function InviteAcceptPage({ params }: { params: Params }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token || "").trim();
  const lookup = decoded ? await lookupStaffInviteByPlaintext(decoded) : { ok: false as const, code: "INVALID" };

  if (!lookup.ok) {
    const message =
      lookup.code === "EXPIRED"
        ? "Bu davetin süresi dolmuş."
        : lookup.code === "REVOKED"
          ? "Bu davet iptal edilmiş."
          : lookup.code === "ACCEPTED"
            ? "Bu davet zaten kullanılmış."
            : "Davet geçersiz.";

    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-950">Personel daveti</h1>
          <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
      <InviteAcceptForm
        token={decoded}
        organizationName={lookup.organizationName}
        emailHint={maskEmailHint(lookup.invite.email)}
        role={lookup.invite.role}
      />
    </main>
  );
}
