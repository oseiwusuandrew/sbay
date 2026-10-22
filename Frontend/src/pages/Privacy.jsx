import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import './pages.css';
import './Legal.css';

const UPDATED = '22 October 2026';

const SECTIONS = [
  ['collect', 'What we collect'],
  ['use', 'How we use it'],
  ['see', 'Who can see what'],
  ['share', 'Who we share it with'],
  ['keep', 'How long we keep it'],
  ['rights', 'Your choices'],
  ['security', 'Security'],
  ['device', 'Storage on your device'],
  ['contact', 'Contact'],
];

/** Privacy notice: what sBay stores about people and why. */
export default function Privacy() {
  return (
    <div className="page">
      <TopBar showBack showSearch={false} />
      <main className="page-main">
        <div className="doc">
          <header className="doc-head">
            <h1>Privacy notice</h1>
            <p className="doc-meta">Last updated {UPDATED}</p>
          </header>

          <nav className="doc-toc" aria-label="On this page">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <div className="doc-body">
            <section id="collect">
              <h2>What we collect</h2>
              <ul>
                <li><strong>Account:</strong> your name, email, phone number and, if you add them, a photo and location. If you sign in with Google we receive your name, email and profile photo from Google.</li>
                <li><strong>Sellers:</strong> shop name and description, payout account (MoMo number or bank details), and for verification either your university and a photo of your student ID, or your occupation and business registration number.</li>
                <li><strong>Activity:</strong> your listings and their photos, orders, chat messages, reviews and support messages.</li>
                <li><strong>Payments:</strong> Paystack processes payments. We receive the payment reference, amount, and the card brand and last four digits; never your full card number or MoMo PIN.</li>
              </ul>
            </section>

            <section id="use">
              <h2>How we use it</h2>
              <p>To run the marketplace: show listings and shops, process orders and hold payments in escrow, pay sellers and refund buyers, verify sellers, connect buyers and sellers in chat, send order updates by email or text, answer support requests, and prevent fraud and misuse.</p>
              <p>We don't sell your information and we don't show third-party ads.</p>
            </section>

            <section id="see">
              <h2>Who can see what</h2>
              <ul>
                <li><strong>Anyone:</strong> your shop name, description, location, listings, ratings and reviews; your name and photo next to reviews you write.</li>
                <li><strong>The person you're trading with:</strong> your name, photo, the messages you send them, and the delivery location you give for an order.</li>
                <li><strong>The sBay team only:</strong> your email, phone number, payout account, verification details and student ID photo, and order and support history, used to run the service and resolve problems.</li>
              </ul>
            </section>

            <section id="share">
              <h2>Who we share it with</h2>
              <p>Only the services that run sBay for us: Paystack (payments), our hosting and database providers, and the email and text-message services that send your notifications. We may also disclose information when Ghanaian law requires it.</p>
            </section>

            <section id="keep">
              <h2>How long we keep it</h2>
              <ul>
                <li>While your account is open we keep your information so the service works.</li>
                <li>When you delete your account we remove your name, email, phone number, photo, payout details and student ID photo straight away, and take down your listings.</li>
                <li>Records of completed orders and payments are kept, without your contact details, for as long as the law requires for accounting and disputes.</li>
              </ul>
            </section>

            <section id="rights">
              <h2>Your choices</h2>
              <p>You can view and change most of your details in Settings, and delete your account there. To ask for a copy of your information, or for anything you can't change yourself, <Link to="/help#contact">contact us</Link>. You also have rights under Ghana's Data Protection Act, 2012 (Act 843), including complaining to the Data Protection Commission.</p>
            </section>

            <section id="security">
              <h2>Security</h2>
              <p>Passwords are stored hashed, never in plain text, and all traffic is encrypted with HTTPS. Access to personal and verification details is limited to the sBay team. No system is perfectly secure, so use a password you don't use anywhere else.</p>
            </section>

            <section id="device">
              <h2>Storage on your device</h2>
              <p>sBay stores a few things in your browser so the app works: your sign-in, your cart, saved items, recently viewed listings and your chosen campus. We don't use advertising or tracking cookies.</p>
            </section>

            <section id="contact">
              <h2>Contact</h2>
              <p>Questions about your information? <Link to="/help#contact">Send us a message</Link>.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
