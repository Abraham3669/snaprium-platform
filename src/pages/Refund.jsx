import React from "react";

export default function Refund() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Refund Policy</h1>
        <p className="last-updated">Last updated: November 14, 2026</p>

        <section>
          <p>
            At Snaprium, we strive to provide a valuable learning experience for
            students. How you request a refund depends on where you bought your
            subscription.
          </p>
        </section>

        <section>
          <h2>Purchases made in the iPhone app</h2>
          <p>
            If you subscribed to Snaprium Unlimited inside the iPhone app, the
            payment was handled by Apple, and Apple decides and processes all
            refunds. We are not able to refund App Store purchases ourselves.
          </p>
          <ul>
            <li>
              Go to{" "}
              <a
                href="https://reportaproblem.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="refund-email-link"
              >
                reportaproblem.apple.com
              </a>
              , sign in with your Apple ID, choose the Snaprium purchase, and
              select "Request a refund".
            </li>
            <li>
              To stop future charges, cancel anytime in Settings &gt; your name
              &gt; Subscriptions on your iPhone, at least 24 hours before the
              current period ends.
            </li>
          </ul>
        </section>

        <section>
          <h2>Purchases made on our website</h2>
          <p>
            If you subscribed on our website, you may request a refund within 7
            days of the original purchase.
          </p>
          <ul>
            <li>Refund requests must be made within 7 days of purchase.</li>
            <li>The request must be submitted by the account owner.</li>
          </ul>
        </section>

        <section>
          <h2>How to Request a Website Refund</h2>
          <p>
            To request a refund for a website purchase, please contact us at{" "}
            <a
              href="mailto:support@snaprium.com?subject=Refund Request"
              className="refund-email-link"
            >
              support@snaprium.com
            </a>{" "}
            with your account email and purchase details.
          </p>
        </section>

        <section>
          <h2>Processing</h2>
          <p>
            Approved website refunds will be processed using the original
            payment method. Processing times may vary depending on your payment
            provider. App Store refunds are processed by Apple on its own
            timeline.
          </p>
        </section>
      </div>
    </div>
  );
}