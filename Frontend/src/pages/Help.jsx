import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import ContactForm from '../components/ContactForm';
import { sbay } from '../api/client';
import { ghs } from '../utils/money';
import './pages.css';
import './Legal.css';

const SECTIONS = [
  ['buying', 'Buying'],
  ['selling', 'Selling'],
  ['fees', 'Fees'],
  ['safety', 'Staying safe'],
  ['faq', 'Questions'],
  ['contact', 'Contact us'],
];

/** How sBay works, what it costs, and how to reach the team. */
export default function Help() {
  const [settings, setSettings] = useState(null);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    sbay.getPublicSettings().then(setSettings).catch(() => {});
    sbay.getPlans().then((rows) => setPlans([...rows].sort((a, b) => a.price - b.price))).catch(() => {});
  }, []);

  const onboardingFee = Number(settings?.sellerOnboardingFee || 0);
  const feeRange = plans.length
    ? [...new Set([Math.min(...plans.map((p) => p.feePct)), Math.max(...plans.map((p) => p.feePct))])].map((n) => `${n}%`).join(' to ')
    : null;

  return (
    <div className="page">
      <TopBar showBack showSearch={false} />
      <main className="page-main">
        <div className="doc">
          <header className="doc-head">
            <h1>Help</h1>
            <p>How buying and selling on sBay works, what it costs, and how to reach us.</p>
          </header>

          <nav className="doc-toc" aria-label="On this page">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <div className="doc-body">
            <section id="buying">
              <h2>Buying</h2>
              <ol className="doc-steps">
                <li><strong>Find an item</strong>Search, or pick your campus on the home page to see what's for sale near you.</li>
                <li><strong>Pay with MoMo or card</strong>Checkout runs through Paystack. You see the item price and the service fee before you pay.</li>
                <li><strong>sBay holds the money</strong>The seller is told about your order, but they don't get paid yet.</li>
                <li><strong>Collect it</strong>A chat with the seller opens so you can agree where and when to meet, or how it's delivered.</li>
                <li><strong>Confirm you have it</strong>Once you're happy, confirm receipt in <Link to="/profile/orders">My orders</Link>. Only then is the seller paid.</li>
              </ol>
              <p>You can cancel an order until the seller ships it, and your payment is refunded. If something is wrong when the item arrives, <strong>don't confirm receipt</strong>. Message us instead and we'll sort it out with the seller.</p>
            </section>

            <section id="selling">
              <h2>Selling</h2>
              <ol className="doc-steps">
                <li><strong>Open your shop</strong>Choose a shop name and add where you want to be paid (MoMo or bank). Students add a photo of their student ID so we can verify the shop.</li>
                <li><strong>List an item</strong>Add photos, a price and where buyers can collect it. It goes live straight away.</li>
                <li><strong>Handle orders</strong>When someone pays, you get a notification. Agree a meet-up in the chat, then mark the order as shipped and delivered.</li>
                <li><strong>Get paid</strong>When the buyer confirms receipt, the sBay team sends the money to your payout account. You can follow each sale in your dashboard.</li>
              </ol>
              <p>Ready? <Link to="/become-seller">Start selling</Link>.</p>
            </section>

            <section id="fees">
              <h2>Fees</h2>
              <p>
                Buyers pay a service fee on top of the item price{feeRange ? ` (${feeRange}, depending on the seller's plan)` : ''}.
                It's shown at checkout before anyone pays. Sellers receive the full item price.
              </p>
              {plans.length > 0 && (
                <table className="doc-table">
                  <thead><tr><th>Seller plan</th><th>Price</th><th>Fee buyers pay</th><th>Active listings</th></tr></thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.code}>
                        <td>{p.name}</td>
                        <td>{p.price > 0 ? `${ghs(p.price)} / 30 days` : 'Free'}</td>
                        <td>{p.feePct}%</td>
                        <td>{p.maxListings || 'No limit'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {onboardingFee > 0 && (
                <p>New sellers pay a one-time fee of <strong>{ghs(onboardingFee)}</strong> before their first listing.</p>
              )}
              <p>Paid plans last 30 days and don't renew automatically.</p>
            </section>

            <section id="safety">
              <h2>Staying safe</h2>
              <ul>
                <li><strong>Always pay through sBay.</strong> If you pay a seller directly, by MoMo or cash, we can't help if something goes wrong.</li>
                <li><strong>Meet in a public place on campus</strong> during the day: a hall's front desk, the library or a busy junction.</li>
                <li><strong>Check the item before you confirm receipt.</strong> Switch on electronics and look for damage.</li>
                <li><strong>Keep the conversation in the sBay chat</strong> so there's a record if you need our help.</li>
                <li><strong>Never share your password or a MoMo PIN or code.</strong> sBay staff will never ask for them.</li>
              </ul>
              <p>See something suspicious? Report it with the form below.</p>
            </section>

            <section id="faq" className="doc-faq">
              <h2>Questions</h2>
              <details>
                <summary>When does the seller get my money?</summary>
                <p>Only after you confirm in My orders that you've received the item. Until then sBay holds it.</p>
              </details>
              <details>
                <summary>What if the seller never shows up?</summary>
                <p>If the order hasn't shipped you can cancel it yourself and you'll be refunded. If it was marked shipped but you never got it, contact us and we'll investigate before anyone is paid.</p>
              </details>
              <details>
                <summary>How long do refunds take?</summary>
                <p>We start the refund as soon as an order is canceled. It goes back to the card or MoMo wallet you paid with, and usually arrives within a few working days depending on your bank or network.</p>
              </details>
              <details>
                <summary>Do I need to be a student to sell?</summary>
                <p>No. Students can get a verified badge with their student ID; anyone else can open a shop by telling us what they do. Every shop must follow our <Link to="/terms">terms</Link>.</p>
              </details>
              <details>
                <summary>What can't I sell?</summary>
                <p>Anything illegal, plus alcohol, tobacco and vapes, drugs, weapons, fake or stolen goods, exam papers and assignment-writing services. The full list is in our <Link to="/terms#prohibited">terms</Link>.</p>
              </details>
              <details>
                <summary>How do I delete my account?</summary>
                <p>Go to Settings and choose Delete account. You'll need to finish or cancel any open orders first.</p>
              </details>
            </section>

            <section id="contact">
              <h2>Contact us</h2>
              <p>
                Send us a message and we'll reply by email.
                {settings?.supportEmail && <> You can also write to <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>.</>}
              </p>
              <div className="contact-card"><ContactForm /></div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
