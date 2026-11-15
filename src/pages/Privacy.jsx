// src/pages/Privacy.jsx
import React from "react";

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: November 14, 2026</p>

        <section>
          <p>
            Snaprium (“we”, “us”) is a social study platform. Students study in
            circles and live sessions, share boards, and can use an AI photo
            solver to understand math and physics questions. This policy
            explains what we collect, why we collect it, and the choices you
            have.
          </p>
        </section>

        <section>
          <h2>1. Information We Collect</h2>
          <ul>
            <li>Account details: name, email address, profile photo, and sign-in data (including Google and Apple sign-in)</li>
            <li>Study content: photos of questions you upload, messages, boards, replies, and circle and session activity</li>
            <li>Usage data: pages and features used, device type, and basic app diagnostics</li>
            <li>Subscription data: your plan status and purchase events from Apple or our website payment provider. We do not receive or store your full card number.</li>
            <li>GIF searches you make in chat, which are sent to our GIF provider</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use It</h2>
          <ul>
            <li>Create your account and keep you signed in</li>
            <li>Solve questions and generate study explanations</li>
            <li>Run circles and live study sessions, including chat, shared photos, and optional video, voice, or screen share</li>
            <li>Apply plan limits, process subscriptions, and restore your purchases</li>
            <li>Keep the Service safe, and prevent abuse</li>
            <li>Improve the product and fix problems</li>
          </ul>
        </section>

        <section>
          <h2>3. Who Helps Us Process Data</h2>
          <p>
            We do not sell your personal information. We use trusted providers
            to run Snaprium:
          </p>
          <ul>
            <li>Firebase / Google for accounts, sign-in, and app data</li>
            <li>Apple, for Sign in with Apple, and for App Store purchases and subscriptions in the iPhone app</li>
            <li>RevenueCat to manage and verify subscriptions in the iPhone app</li>
            <li>Paddle for checkout and subscription billing on our website</li>
            <li>OpenAI to generate study answers from text or question photos</li>
            <li>Daily for optional video, voice, and screen sharing in live sessions</li>
            <li>Giphy to search and show GIFs in chat</li>
            <li>Vercel and other infrastructure providers that keep the Service online</li>
          </ul>
          <p>
            Question photos and messages sent to AI are processed to return a
            response. Video and screen share stay inside the live session tools
            and are not used to build a public dataset.
          </p>
        </section>

        <section>
          <h2>4. Circles and Live Sessions</h2>
          <p>
            If you join a circle or session, other members can see your display
            name, profile photo, messages, shared photos, and, if you turn them
            on, your camera, microphone, or screen. Only share what you are
            comfortable with the people in that circle.
          </p>
        </section>

        <section>
          <h2>5. Keeping and Deleting Your Data</h2>
          <p>
            We keep your data while your account is active. You can delete your
            account from within the app, or by emailing support@snaprium.com.
            When you delete your account, we delete your sign-in and profile and
            remove the messages and content you posted. Circles you own are
            handed to another member where possible, or closed. Some data may
            remain for a limited time in backups, or where we must keep it to
            meet legal obligations. Deleting your account does not cancel an
            App Store subscription, which you manage in your Apple ID settings.
          </p>
        </section>

        <section>
          <h2>6. Your Rights and Choices</h2>
          <p>
            You can ask to access, correct, or delete your account data by
            emailing support@snaprium.com. You can also edit your profile in the
            app, and turn your camera, microphone, and screen share on or off in
            sessions.
          </p>
        </section>

        <section>
          <h2>7. International Processing</h2>
          <p>
            Our providers may process data in countries other than your own,
            including the United States. We choose providers that protect data
            with reasonable safeguards.
          </p>
        </section>

        <section>
          <h2>8. Data Security</h2>
          <p>
            We use reasonable technical measures to protect your data. No
            internet service is fully secure.
          </p>
        </section>

        <section>
          <h2>9. Children</h2>
          <p>
            Snaprium is built for students and is intended for people aged 13
            and over. If you are under the age required to have an account in
            your country, use Snaprium only with a parent or guardian. If you
            believe a child has given us personal information without
            permission, contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. When we do, we will
            change the date at the top of this page and, where appropriate,
            tell you in the app.
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