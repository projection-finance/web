import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Projection Finance",
  description:
    "How Projection Finance collects, uses and protects your data. Read our full privacy policy.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-[#303549] mb-1">Privacy Policy</h1>
        <p className="text-xs text-gray-400 mb-8">Last updated: February 23, 2026</p>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">1. Introduction</h2>
            <p>
              Projection Finance (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website and platform
              at projectionfinance.com. This Privacy Policy explains how we collect, use, and protect your
              information when you use our services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">2. Information We Collect</h2>
            <p className="font-medium text-[#303549] mb-1">Account information</p>
            <p className="mb-3">
              When you create an account, we collect your email address and, if you sign in via Google or
              GitHub, your name and profile picture as provided by those services.
            </p>
            <p className="font-medium text-[#303549] mb-1">Usage data</p>
            <p className="mb-3">
              We use Umami, a privacy-focused, cookie-free analytics tool, to collect anonymous usage
              data such as pages visited, referrer, browser type, and device information. Umami does
              not use cookies, does not track personal data, and does not share data with third parties.
              No consent is required for this type of analytics under GDPR.
            </p>
            <p className="font-medium text-[#303549] mb-1">Wallet addresses</p>
            <p>
              If you enter a blockchain wallet address to use our simulation tools, we process it to
              fetch on-chain data from public blockchain networks. We do not store wallet addresses on
              our servers beyond the duration of your session unless you save a projection.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and improve our platform and services</li>
              <li>To authenticate your account</li>
              <li>To save and load your projections if you use that feature</li>
              <li>To analyze platform usage and improve user experience</li>
              <li>To communicate with you about your account or service updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">4. Cookies &amp; Tracking</h2>
            <p>
              We use essential cookies required for authentication and session management only.
              Our analytics solution (Umami) is entirely cookie-free and does not track users across
              websites. No analytics cookies are placed on your device.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">5. Third-Party Services</h2>
            <p>We use the following third-party services that may process your data:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><span className="font-medium text-[#303549]">Google / GitHub</span> &mdash; OAuth authentication</li>
              <li><span className="font-medium text-[#303549]">Resend</span> &mdash; transactional emails</li>
              <li><span className="font-medium text-[#303549]">Umami</span> &mdash; privacy-focused, cookie-free usage analytics</li>
            </ul>
            <p className="mt-2">
              Each of these services has their own privacy policy governing how they handle data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">6. Data Retention</h2>
            <p>
              We retain your account information for as long as your account is active. Saved projections
              are stored until you delete them or close your account. Analytics data is retained in
              aggregated, anonymized form.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">7. Your Rights</h2>
            <p>
              Depending on your location, you may have rights under applicable data protection laws
              (such as the GDPR or CCPA), including the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Withdraw consent for analytics tracking at any time</li>
              <li>Request a copy of your data in a portable format</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us
              at{" "}
              <a href="mailto:support@projectionfinance.com" className="text-[#5382E3] hover:underline">
                support@projectionfinance.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">8. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal
              data. However, no method of transmission over the internet is 100% secure, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">9. Children</h2>
            <p>
              Our services are not directed to individuals under the age of 16. We do not knowingly
              collect personal data from children.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any significant
              changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">11. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:support@projectionfinance.com" className="text-[#5382E3] hover:underline">
                support@projectionfinance.com
              </a>{" "}
              or visit our{" "}
              <Link href="/contact" className="text-[#5382E3] hover:underline">
                Contact page
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
