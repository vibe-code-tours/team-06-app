import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  KeyRound,
  QrCode,
  Store,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "QA Test Manual — Restaurant QR Order System",
};

const demoAccounts = [
  { role: "manager", label: "Manager" },
  { role: "kitchen_staff", label: "Kitchen Staff" },
  { role: "waiter", label: "Waiter" },
  { role: "cashier", label: "Cashier" },
];

export default function QaManualPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-brand-blue">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-white/10 text-white shrink-0">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                QA Test Manual
              </h1>
              <p className="text-sm text-white/60 mt-0.5">
                A quick guide to testing the full order flow
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Demo accounts */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-blue mb-3">
            <KeyRound className="h-5 w-5" />
            Demo Accounts
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-brand-orange/10 border-b border-gray-200">
              <p className="text-sm text-gray-700">
                Password for every account:{" "}
                <code className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-brand-orange">
                  password
                </code>
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {demoAccounts.map((account) => (
                <div
                  key={account.role}
                  className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {account.label}
                  </span>
                  <code className="text-sm font-mono text-gray-600">
                    {account.role}@demo.local
                  </code>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main flow: full order lifecycle */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-blue mb-3">
            <QrCode className="h-5 w-5" />
            Main Flow — Full Order Lifecycle
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            This walks one order through every role. Use a separate browser (or
            an incognito window) per staff role so you can stay logged in as
            more than one at a time.
          </p>

          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-brand-blue text-white text-sm font-semibold shrink-0">
                1
              </span>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Get a table QR code.</span> Log in
                as <code className="text-brand-orange">waiter</code>, open the
                Tables tab, and download the QR code for any table.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-brand-blue text-white text-sm font-semibold shrink-0">
                2
              </span>
              <div className="text-sm text-gray-700">
                <span className="font-medium">
                  Place an order from a phone.
                </span>{" "}
                Scan the downloaded QR with a mobile phone, browse the menu, and
                submit an order. Keep this tab open — you&apos;ll watch the
                order status update live.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-brand-blue text-white text-sm font-semibold shrink-0">
                3
              </span>
              <div className="text-sm text-gray-700">
                <span className="font-medium">
                  Move the order through the kitchen.
                </span>{" "}
                Back on a computer, log in as{" "}
                <code className="text-brand-orange">kitchen_staff</code> and
                advance the order&apos;s status (Accept → Cooking → Ready).
                Watch the customer&apos;s phone update as each step happens.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-brand-blue text-white text-sm font-semibold shrink-0">
                4
              </span>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Take payment.</span> Once the
                order is <code className="text-brand-orange">Ready</code>, log
                out (or use a separate browser) and log in as{" "}
                <code className="text-brand-orange">cashier</code>. Find the
                order and accept the payment.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500 text-white text-sm font-semibold shrink-0">
                ✓
              </span>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Done.</span> The order flow is
                complete — the customer&apos;s phone should show the order as
                paid.
              </div>
            </li>
          </ol>
        </section>

        {/* Other roles */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-blue mb-3">
            <Store className="h-5 w-5" />
            Other Roles to Spot-Check
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <BarChart3 className="h-4 w-4 text-brand-blue" />
                <span className="font-medium text-sm">Manager</span>
              </div>
              <p className="text-sm text-gray-500">
                Log in and check the orders overview — a summary of today&apos;s
                activity across the restaurant.
              </p>
            </div>
            {/* <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <ChefHat className="h-4 w-4 text-brand-orange" />
                <span className="font-medium text-sm">Restaurant Owner</span>
              </div>
              <p className="text-sm text-gray-500">
                Log in and try creating a table, creating a menu item, and
                inviting a staff member.
              </p>
            </div> */}
          </div>
        </section>

        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:underline"
          >
            Go to sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="pt-4">
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 leading-relaxed">
              Found a bug or something confusing? Please note down which step
              you were on, which role you were logged in as, and what you
              expected to happen — then send it back as feedback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
