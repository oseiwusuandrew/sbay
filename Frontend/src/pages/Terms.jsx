import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import './pages.css';
import './Legal.css';

const UPDATED = '22 October 2026';

const SECTIONS = [
  ['about', 'About these terms'],
  ['accounts', 'Your account'],
  ['buying', 'Buying'],
  ['selling', 'Selling'],
  ['prohibited', 'What you can’t sell'],
  ['payments', 'Payments, escrow and fees'],
  ['cancellations', 'Cancellations and problems'],
  ['conduct', 'Behaviour'],
  ['ending', 'Suspension and closing'],
  ['liability', 'Our responsibility'],
  ['changes', 'Changes and contact'],
];

/** Terms of use for buyers and sellers. */
export default function Terms() {
  return (
    <div className="page">
      <TopBar showBack showSearch={false} />
      <main className="page-main">
        <div className="doc">
          <header className="doc-head">
            <h1>Terms of use</h1>
            <p className="doc-meta">Last updated {UPDATED}</p>
          </header>

          <nav className="doc-toc" aria-label="On this page">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <div className="doc-body">
            <section id="about">
              <h2>About these terms</h2>
              <p>sBay is a marketplace where students and other people in Ghana buy and sell items to each other. sBay is not the seller of the items listed; each listing belongs to the seller who posted it. By creating an account or placing an order you agree to these terms and to our <Link to="/privacy">privacy notice</Link>.</p>
            </section>

            <section id="accounts">
              <h2>Your account</h2>
              <ul>
                <li>Give accurate details, and keep your password to yourself. You're responsible for what happens on your account.</li>
                <li>One person, one account. Opening another account to get around a restriction is not allowed.</li>
                <li>You must be old enough to enter a contract under Ghanaian law, or have a parent's or guardian's permission.</li>
              </ul>
            </section>

            <section id="buying">
              <h2>Buying</h2>
              <ul>
                <li>When you pay for an order, the money is held by sBay (escrow) and the seller is not paid until you confirm you've received the item.</li>
                <li>Only confirm receipt once you have the item and it matches the listing. Confirming releases the payment and can't be undone.</li>
                <li>Arrange collection or delivery through the sBay chat.</li>
              </ul>
            </section>

            <section id="selling">
              <h2>Selling</h2>
              <ul>
                <li>Only list items you own and are allowed to sell. Photos, descriptions, condition and price must be accurate.</li>
                <li>Keep listings up to date. Mark items as sold or delete them when they're no longer available.</li>
                <li>Respond to orders promptly and hand over the item as agreed. Repeatedly cancelling or not turning up can lead to your shop being restricted.</li>
                <li>Verification is reviewed by the sBay team. We may refuse or remove a verified badge if details can't be confirmed.</li>
                <li>You are responsible for any tax due on what you earn.</li>
              </ul>
            </section>

            <section id="prohibited">
              <h2>What you can’t sell</h2>
              <p>Anything illegal in Ghana, and in particular:</p>
              <ul>
                <li>alcohol, tobacco, vapes and e-cigarettes;</li>
                <li>drugs, medicines that need a prescription, and drug paraphernalia;</li>
                <li>weapons, ammunition, explosives and dangerous materials;</li>
                <li>counterfeit, replica or stolen goods;</li>
                <li>exam papers, answers, and assignment or exam-writing services;</li>
                <li>adult content, live animals, and personal data or accounts.</li>
              </ul>
              <p>We remove listings that break these rules and may restrict the seller.</p>
            </section>

            <section id="payments">
              <h2>Payments, escrow and fees</h2>
              <ul>
                <li>Payments are processed by Paystack with mobile money or card. sBay does not see or store your full card number or MoMo PIN.</li>
                <li>Buyers pay a service fee on top of the item price. The fee depends on the seller's plan and is shown at checkout before you pay. Current fees are listed on the <Link to="/help#fees">help page</Link>.</li>
                <li>Sellers receive the item price once the buyer confirms receipt, paid to the payout account in their shop settings.</li>
                <li>Sellers may be asked to pay a one-time onboarding fee and may buy a paid plan. Paid plans last 30 days and do not renew automatically. Plan payments are not refundable once the plan is active, unless the law requires it.</li>
                <li>Only payments made through sBay are protected. If you pay a seller directly we can't help recover the money.</li>
              </ul>
            </section>

            <section id="cancellations">
              <h2>Cancellations and problems</h2>
              <ul>
                <li>The buyer or seller can cancel an order before it ships. The buyer is refunded in full to the original payment method.</li>
                <li>If an item doesn't arrive or isn't as described, the buyer should not confirm receipt and should contact us. We'll look at the order, the chat and any photos, and decide whether to refund the buyer or pay the seller. Both sides agree to cooperate and to accept that decision for payments made through sBay.</li>
              </ul>
            </section>

            <section id="conduct">
              <h2>Behaviour</h2>
              <p>Be honest and respectful. Harassment, threats, discrimination, scams, spam, fake reviews and attempts to take a sale off sBay to avoid fees are not allowed.</p>
            </section>

            <section id="ending">
              <h2>Suspension and closing</h2>
              <ul>
                <li>We may hide listings, restrict or close accounts that break these terms or put other users at risk. A restricted seller's listings are hidden while the restriction lasts.</li>
                <li>You can delete your account in Settings once you have no orders in progress. Records of completed orders are kept as described in the <Link to="/privacy#keep">privacy notice</Link>.</li>
              </ul>
            </section>

            <section id="liability">
              <h2>Our responsibility</h2>
              <p>We work to keep sBay running and safe, but we don't guarantee it will always be available or error-free, and we're not responsible for what happens at meet-ups or for items sold outside sBay. Nothing in these terms limits rights you have under Ghanaian consumer law.</p>
            </section>

            <section id="changes">
              <h2>Changes and contact</h2>
              <p>We may update these terms. If a change matters, we'll tell you in the app before it applies. Questions? <Link to="/help#contact">Contact us</Link>.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
