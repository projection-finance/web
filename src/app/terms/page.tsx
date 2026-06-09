import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use — Projection Finance",
  description:
    "Terms and conditions governing the use of Projection Finance, the DeFi simulation platform for Aave V3.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-[#303549] mb-1">Terms of Use</h1>
        <p className="text-xs text-gray-400 mb-8">Last updated: February 23, 2026</p>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Projection Finance (&quot;the Platform&quot;), you agree to be bound
              by these Terms of Use. If you do not agree, please do not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">2. Description of Service</h2>
            <p>
              Projection Finance is a DeFi simulation and projection tool. It allows users to visualize
              and simulate lending positions on protocols such as Aave V3. The Platform provides
              informational projections only and does not execute any on-chain transactions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">3. Not Financial Advice</h2>
            <p>
              The simulations, projections, and data provided by Projection Finance are for
              informational and educational purposes only. They do not constitute financial advice,
              investment advice, trading advice, or any other kind of advice. You should not make
              any financial decisions based solely on the output of this Platform. Always do your
              own research and consult a qualified financial advisor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">4. No Guarantees</h2>
            <p>
              Projections are based on current on-chain data and user-defined parameters. Actual
              results may differ significantly due to market volatility, protocol changes, smart
              contract risks, oracle failures, or other factors beyond our control. We make no
              guarantees about the accuracy, completeness, or reliability of any projection.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">5. User Accounts</h2>
            <p>
              You may use parts of the Platform without an account. To access certain features
              (such as saving projections), you must create an account. You are responsible for
              maintaining the security of your account credentials and for all activities under
              your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">6. Pricing</h2>
            <p>
              Projection Finance is free and open-source. All features are available to every user
              with no limits, no subscriptions and no payments. The source code is available under
              its open-source license.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Platform for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Platform or its systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform</li>
              <li>Scrape, crawl, or use automated tools to extract data from the Platform without permission</li>
              <li>Resell or redistribute the Platform&apos;s features or data commercially</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">8. Intellectual Property</h2>
            <p>
              All content, branding, design, code, and features of Projection Finance are owned by
              us or our licensors. You may not copy, modify, distribute, or create derivative works
              without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Projection Finance and its operators shall not
              be liable for any indirect, incidental, special, consequential, or punitive damages,
              including but not limited to loss of profits, data, or funds, arising from your use
              of or inability to use the Platform.
            </p>
            <p className="mt-2">
              The Platform is a simulation tool and does not interact with any blockchain or smart
              contract on your behalf. Any on-chain actions you take based on projections are entirely
              your own responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">10. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties
              of any kind, whether express or implied, including but not limited to implied warranties
              of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">11. Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be posted on this
              page with an updated date. Continued use of the Platform after changes constitutes
              acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable law,
              without regard to conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#303549] mb-2">13. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
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
