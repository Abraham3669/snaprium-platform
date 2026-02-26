// src/pages/Privacy.jsx
import React from 'react';

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: February 26, 2026</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly, such as:</p>
          <ul>
            <li>Name and email when you create an account</li>
            <li>Images you upload for processing</li>
            <li>Usage data (pages visited, features used)</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <p>We use the information to:</p>
          <ul>
            <li>Provide, maintain, and improve the Service</li>
            <li>Process and respond to your requests</li>
            <li>Send you updates and support messages</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>3. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul>
            <li>Service providers who assist us (e.g., cloud storage, analytics)</li>
            <li>Law enforcement when required by law</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>
        </section>

        <section>
          <h2>5. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. Contact us at support@snaprium.com to exercise these rights.</p>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>If you have questions about this Privacy Policy, contact us at support@snaprium.com</p>
        </section>
      </div>
    </div>
  );
}