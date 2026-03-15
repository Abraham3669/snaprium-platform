import React from "react";

export default function Refund() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Refund Policy</h1>
        <p className="last-updated">Last updated: March 15, 2026</p>

        <section>
          <p>
            At Snaprium, we strive to provide a valuable learning experience for
            students. If you are not satisfied with your subscription, you may
            request a refund within 7 days of the original purchase.
          </p>
        </section>

        <section>
          <h2>Eligibility</h2>
          <ul>
            <li>Refund requests must be made within 7 days of purchase.</li>
            <li>The request must be submitted by the account owner.</li>
          </ul>
        </section>

        <section>
          <h2>How to Request a Refund</h2>
          <p>
            To request a refund, please contact us at
            <strong> support@snaprium.com </strong>
            with your account email and purchase details.
          </p>
        </section>

        <section>
          <h2>Processing</h2>
          <p>
            Approved refunds will be processed using the original payment
            method. Processing times may vary depending on your payment
            provider.
          </p>
        </section>
      </div>
    </div>
  );
}