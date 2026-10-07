# College Mini Project - Online FoodShop

A static food-ordering website: browse the menu, filter and search, build a cart, apply coupons, check out and see your order history. Plain HTML, CSS and JavaScript, no build step and no external libraries or CDNs.

**Live demo:** https://shishir19999.github.io/College-Mini-Project/

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Home: parallax hero, feature cards, carousel, popular dishes |
| `menu.html` | Menu with category tabs, search, veg / non-veg and price filters, sorting |
| `favorites.html` | Dishes saved with the heart button |
| `cart.html` | Cart with steppers, coupon codes, delivery fee, tax and totals |
| `checkout.html` | Three steps: details, payment (mock), review, then confirmation with an order id |
| `orders.html` | Order history for the logged-in account, with "order again" |
| `login.html` | Log in / register (demo authentication) |
| `contact.html` | Contact form with validation and a success state |
| `aboutus.html` | Story, values and team |
| `404.html` | Not-found page |
| `order.html` | Old address, redirects to `menu.html` |

## Features

- Add to cart from every dish with quantity steppers; the cart persists in `localStorage`
- Coupons: `WELCOME10` (10% off), `FEAST50` (Rs 50 off orders above Rs 250), `FREESHIP` (free delivery)
- Delivery fee Rs 30 (free above Rs 300 or for pickup), 5% tax, live totals
- Multi-step checkout with inline validation; no card data is stored
- Order history and favorites saved per browser
- Demo authentication: seeded users exist only as SHA-256 hashes (WebCrypto) and registered users are stored the same way; there are no plaintext credentials in the code
- Light and dark theme (follows the system, remembered), skip link, focus rings, ARIA labels, loading / empty / error states
- Responsive from 320px; images are served as AVIF / WebP with JPEG fallbacks (`assets/img`); originals are kept in the project root
- Parallax and scroll reveal (see below)

## Demo logins

| Email | Password |
| --- | --- |
| `demo@example.com` | `Demo@1234` |
| `student@example.com` | `Student@123` |

You can also register your own account. Everything is stored in your browser only. This is a front-end demo, not real security. The contact details on the contact page are placeholders.

## Parallax note

The hero and section backgrounds, floating shapes and image frames use parallax, and cards use a scroll reveal. Only `transform` and `opacity` are animated, driven by `IntersectionObserver` and `requestAnimationFrame`, with no libraries. It is switched off for `prefers-reduced-motion`, on small screens (under 768px), in data-saver mode and on low-power devices. It is not loaded on the menu, cart, checkout, orders or login pages.

## How to run

Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8080
```

All links and assets are relative, so the site works from a sub-path such as `/College-Mini-Project/` on GitHub Pages.

`PROJECT PPT.pptx` is the project presentation.

## Notes

`style.css`, `style1-3.css`, `cart.css`, `script.js`, `script1.js`, `sha256.js` are leftovers from the earlier version and are no longer used by any page.
