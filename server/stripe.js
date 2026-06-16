/**
 * server/stripe.js — Stripe client + helpers.
 *
 * The key is read from STRIPE_SECRET_KEY in the environment. If absent, the
 * helpers throw a clear error at call time so the rest of the server can boot
 * for development without Stripe being configured.
 */

const Stripe = require('stripe');

let _stripe = null;

function getStripe() {
    if (_stripe) return _stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env or your environment.');
    }
    _stripe = new Stripe(key, { apiVersion: '2024-06-20' });
    return _stripe;
}

function isConfigured() {
    return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Build a single Checkout Session for a list of line items.
 * Each item: { slug, title, priceCents, qty, image? }
 */
async function createCheckoutSession({ items, successUrl, cancelUrl, customerEmail }) {
    const stripe = getStripe();
    return stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: items.map(it => ({
            quantity: it.qty,
            price_data: {
                currency: it.currency || 'eur',
                unit_amount: it.priceCents,
                product_data: {
                    name: it.title,
                    description: it.description || undefined,
                    images: it.image ? [it.image] : undefined,
                    metadata: { slug: it.slug },
                },
            },
        })),
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail || undefined,
        metadata: {
            // We re-encode the line items so the webhook can decrement stock.
            items: JSON.stringify(items.map(it => ({ slug: it.slug, qty: it.qty }))),
        },
    });
}

module.exports = {
    getStripe,
    isConfigured,
    createCheckoutSession,
};
