// src/pages/Terms.jsx
import React from 'react';

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last updated: February 26, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using Snaprium ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree with any part of these terms, you may not use the Service.</p>
        </section>

        <section>
          <h2>2. Use of the Service</h2>
          <p>You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to use the Service:</p>
          <ul>
            <li>In any way that violates any applicable law or regulation</li>
            <li>To transmit or send unsolicited advertising or promotional material</li>
            <li>To impersonate any person or entity</li>
          </ul>
        </section>

        <section>
          <h2>3. Intellectual Property</h2>
          <p>The Service and its original content, features, and functionality are owned by Snaprium and are protected by international copyright, trademark, and other intellectual property laws.</p>
        </section>

        <section>
          <h2>4. Termination</h2>
          <p>We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
        </section>

        <section>
          <h2>5. Limitation of Liability</h2>
          <p>In no event shall Snaprium be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>If you have any questions about these Terms, contact us at support@snaprium.com</p>
        </section>
      </div>
    </div>
  );
}