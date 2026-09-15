// src/pages/Privacy.jsx
import React from "react";

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: September 15, 2026</p>

        <section>
          <p>
            Snaprium (“we”, “us”) is a study app that helps students understand
            math and physics and study with friends. This policy explains what
            we collect and why.
          </p>
        </section>

        <section>
          <h2>1. Information We Collect</h2>
          <ul>
            <li>Account details: name, email, profile photo, and sign-in data (including Google sign-in)</li>
            <li>Study content: photos of questions you upload, chat messages, and room activity</li>
            <li>Usage data: pages used, device type, and basic app diagnostics</li>
            <li>Subscription data: plan status and payment events from our payment provider</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use It</h2>
          <ul>
            <li>Create your account and keep you signed in</li>
            <li>Solve questions and generate study explanations</li>
            <li>Run study rooms, including chat, shared photos, and optional video or screen share</li>
            <li>Apply plan limits and process upgrades</li>
            <li>Improve the product and fix problems</li>
          </ul>
        </section>

        <section>
          <h2>3. Who Helps Us Process Data</h2>
          <p>We do not sell your personal information. We use trusted providers to run Snaprium:</p>
          <ul>
            <li>Firebase / Google for accounts and app data</li>
            <li>OpenAI to generate study answers from text or question photos</li>
            <li>Daily for optional video, voice, and screen sharing in study rooms</li>
            <li>Paddle for checkout and subscription billing</li>
            <li>Hosting and infrastructure providers that keep the site online</li>
          </ul>
          <p>
            Question photos and messages sent to AI are processed to return a
            response. Video and screen share stay inside the study session tools
            and are not used to train Snaprium as a public dataset.
          </p>
        </section>

        <section>
          <h2>4. Study Rooms</h2>
          <p>
            If you join a room, other people in that room can see your display
            name, messages, shared photos, and — if you turn them on — your
            camera, microphone, or screen.
          </p>
        </section>

        <section>
          <h2>5. Data Security</h2>
          <p>
            We use reasonable technical measures to protect your data. No
            internet service is fully secure.
          </p>
        </section>

        <section>
          <h2>6. Your Rights</h2>
          <p>
            You can ask to access, correct, or delete your account data by
            emailing support@snaprium.com.
          </p>
        </section>

        <section>
          <h2>7. Children</h2>
          <p>
            Snaprium is built for students. If you are under the age required
            to have an account in your country, use Snaprium only with a
            parent or guardian.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>support@snaprium.com</p>
        </section>
      </div>
    </div>
  );
}