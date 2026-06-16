/**
 * cart.js — client-side cart for the portfolio.
 *
 * Cart state lives in localStorage under the key `portfolio:cart` as an
 * array of { slug, qty }. Stock enforcement is done by the server at
 * checkout time; this module is best-effort and only prevents obviously
 * invalid local state (qty > stock, qty < 1, duplicates summed).
 *
 * Public API (window.cart):
 *   load()            — read from localStorage
 *   save()            — write to localStorage
 *   items()           — array of { slug, qty }
 *   count()           — total quantity across all items
 *   add(slug, qty)    — add or increment; qty defaults to 1
 *   setQty(slug, qty) — set exact quantity
 *   remove(slug)
 *   clear()
 *   totalCents(projects) — sum of price * qty
 *   subtotalString(projects) — formatted as € 0.00
 *
 * The drawer markup and rendering are defined in index.html and the
 * styles live in style.css. This file wires the behavior.
 */

(function () {
    const KEY = 'portfolio:cart';

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.filter(it => it && it.slug) : [];
        } catch {
            return [];
        }
    }

    function save(items) {
        localStorage.setItem(KEY, JSON.stringify(items));
        document.dispatchEvent(new CustomEvent('cart:change', { detail: { items: load() } }));
    }

    function items() { return load(); }

    function count() {
        return load().reduce((sum, it) => sum + (parseInt(it.qty, 10) || 0), 0);
    }

    function add(slug, qty) {
        qty = Math.max(1, parseInt(qty, 10) || 1);
        const list = load();
        const existing = list.find(it => it.slug === slug);
        if (existing) existing.qty += qty;
        else list.push({ slug, qty });
        save(list);
    }

    function setQty(slug, qty) {
        qty = Math.max(0, parseInt(qty, 10) || 0);
        const list = load();
        const idx = list.findIndex(it => it.slug === slug);
        if (qty === 0) {
            if (idx !== -1) list.splice(idx, 1);
        } else if (idx !== -1) {
            list[idx].qty = qty;
        } else {
            list.push({ slug, qty });
        }
        save(list);
    }

    function remove(slug) {
        save(load().filter(it => it.slug !== slug));
    }

    function clear() { save([]); }

    /**
     * Parse a price string like "€ 2,400", "€ 950", "€ 1.99", "$1,200.50",
     * "$1.200,50" into integer cents.
     *
     * Heuristic: if a separator has exactly 1 or 2 digits after it, it's the
     * decimal separator; otherwise it's a thousands separator and the number
     * is a whole amount. If both . and , are present, the rightmost one is
     * the decimal separator.
     */
    function parsePriceCents(str) {
        if (str == null) return 0;
        let s = String(str).trim();
        const neg = s.startsWith('-');
        s = s.replace(/^-/, '').replace(/[^\d.,]/g, '');
        if (!s) return 0;

        const lastDot = s.lastIndexOf('.');
        const lastCom = s.lastIndexOf(',');
        const hasDot = lastDot !== -1;
        const hasCom = lastCom !== -1;

        let decIdx = -1;
        if (hasDot && hasCom) {
            decIdx = Math.max(lastDot, lastCom);
        } else if (hasDot && !hasCom) {
            const tail = s.length - lastDot - 1;
            const dotCount = (s.match(/\./g) || []).length;
            // "1.99" -> tail=2, decimal.
            // "1.234.567" -> many dots, never decimal.
            // "2.400" -> single dot, 3 digits after = thousands.
            if ((tail === 1 || tail === 2) && dotCount === 1) decIdx = lastDot;
        } else if (!hasDot && hasCom) {
            const tail = s.length - lastCom - 1;
            const comCount = (s.match(/,/g) || []).length;
            // "1,99" -> tail=2, decimal.
            // "2,400" -> single comma, 3 digits after = thousands.
            if ((tail === 1 || tail === 2) && comCount === 1) decIdx = lastCom;
        }

        let intPart, fracPart = '';
        if (decIdx === -1) {
            intPart = s;
        } else {
            intPart  = s.slice(0, decIdx);
            fracPart = s.slice(decIdx + 1);
        }
        intPart  = intPart.replace(/[.,]/g, '');
        fracPart = fracPart.replace(/[.,]/g, '').slice(0, 2).padEnd(2, '0');

        const cents = ((parseInt(intPart, 10) || 0) * 100) + (parseInt(fracPart, 10) || 0);
        return neg ? -cents : cents;
    }

    function formatEUR(cents) {
        const sign = cents < 0 ? '-' : '';
        const v = Math.abs(cents);
        const euros = Math.floor(v / 100);
        const cs = String(v % 100).padStart(2, '0');
        return `${sign}€ ${euros.toLocaleString('en-US')},${cs}`;
    }

    function totalCents(projects) {
        const map = Object.fromEntries((projects || []).map(p => [p.slug, p]));
        return load().reduce((sum, it) => {
            const p = map[it.slug];
            if (!p) return sum;
            return sum + parsePriceCents(p.price) * (parseInt(it.qty, 10) || 0);
        }, 0);
    }

    function subtotalString(projects) {
        return formatEUR(totalCents(projects));
    }

    // ---- drawer rendering ----

    function findProject(slug, projects) {
        return (projects || []).find(p => p.slug === slug);
    }

    function renderDrawer(projects) {
        const list = load();
        const container = document.getElementById('cart-items');
        const totalEl  = document.getElementById('cart-total');
        const emptyEl  = document.getElementById('cart-empty');
        const checkoutBtn = document.getElementById('cart-checkout');
        if (!container) return;

        container.innerHTML = '';

        if (!list.length) {
            if (emptyEl) emptyEl.style.display = '';
            if (totalEl) totalEl.textContent = '€ 0,00';
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (checkoutBtn) checkoutBtn.disabled = false;

        for (const it of list) {
            const p = findProject(it.slug, projects);
            if (!p) continue;

            const row = document.createElement('div');
            row.className = 'cart-line';

            const stock = Number.isInteger(p.stock) ? p.stock : 0;
            const lineCents = parsePriceCents(p.price) * (parseInt(it.qty, 10) || 0);
            const decDisabled = it.qty <= 1 ? 'disabled' : '';
            const incDisabled = it.qty >= stock ? 'disabled' : '';

            row.innerHTML = `
                <img class="cart-line-thumb" src="${p.cover || ''}" alt="">
                <div class="cart-line-body">
                    <div class="cart-line-title">${escapeHtml(p.title || it.slug)}</div>
                    <div class="cart-line-meta">${escapeHtml(p.price || '')}${stock ? ` · ${stock} in stock` : ' · Sold out'}</div>
                    <div class="cart-line-controls">
                        <div class="cart-qty-stepper" role="group" aria-label="Quantity">
                            <button class="cart-qty-btn" data-action="dec" data-slug="${it.slug}" ${decDisabled} aria-label="Decrease">−</button>
                            <span class="cart-qty-value" data-slug="${it.slug}">${it.qty}</span>
                            <button class="cart-qty-btn" data-action="inc" data-slug="${it.slug}" ${incDisabled} aria-label="Increase">+</button>
                        </div>
                        <button class="cart-line-remove" data-action="remove" data-slug="${it.slug}">Remove</button>
                    </div>
                </div>
                <div class="cart-line-price">${formatEUR(lineCents)}</div>
            `;
            container.appendChild(row);
        }

        if (totalEl) totalEl.textContent = formatEUR(totalCents(projects));
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;'
        }[c]));
    }

    function updateCartBadge() {
        const badge = document.getElementById('cart-count');
        if (badge) {
            const c = count();
            badge.textContent = c;
            badge.style.display = c > 0 ? '' : 'none';
        }
    }

    function openDrawer() {
        const d = document.getElementById('cart-drawer');
        const b = document.getElementById('cart-drawer-backdrop');
        if (d) d.classList.add('open');
        if (b) b.classList.add('open');
    }

    function closeDrawer() {
        const d = document.getElementById('cart-drawer');
        const b = document.getElementById('cart-drawer-backdrop');
        if (d) d.classList.remove('open');
        if (b) b.classList.remove('open');
    }

    // Re-render whenever the cart changes.
    document.addEventListener('cart:change', () => {
        updateCartBadge();
        // Drawer contents are re-rendered by script.js, which has the projects list.
        document.dispatchEvent(new CustomEvent('cart:rerender'));
    });

    // Click delegation for the drawer.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const slug   = btn.dataset.slug;
        if (!slug) return;

        if (action === 'inc') {
            const list = load();
            const it = list.find(x => x.slug === slug);
            if (it) { it.qty += 1; save(list); }
        } else if (action === 'dec') {
            const list = load();
            const it = list.find(x => x.slug === slug);
            if (it) { it.qty = Math.max(1, it.qty - 1); save(list); }
        } else if (action === 'remove') {
            remove(slug);
        }
    });

    // Open/close hooks.
    document.addEventListener('click', (e) => {
        if (e.target.closest('#cart-button')) {
            e.preventDefault();
            openDrawer();
        }
        if (e.target.closest('#cart-close') || e.target.closest('#cart-drawer-backdrop')) {
            e.preventDefault();
            closeDrawer();
        }
    });

    // Checkout button.
    document.addEventListener('click', async (e) => {
        if (!e.target.closest('#cart-checkout')) return;
        const list = load();
        if (!list.length) return;
        const btn = e.target.closest('#cart-checkout');
        btn.disabled = true;
        const oldText = btn.textContent;
        btn.textContent = 'Redirecting…';
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: list }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Checkout failed');
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (err) {
            alert('Checkout error: ' + err.message);
            btn.disabled = false;
            btn.textContent = oldText;
        }
    });

    // Esc closes the drawer.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });

    // Expose API.
    window.cart = {
        load, save, items, count,
        add, setQty, remove, clear,
        totalCents, subtotalString,
        open: openDrawer,
        close: closeDrawer,
        render: renderDrawer,
        updateBadge: updateCartBadge,
        // Exposed for debugging / tests.
        _parsePriceCents: parsePriceCents,
    };

    // Initial badge.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateCartBadge);
    } else {
        updateCartBadge();
    }
})();
