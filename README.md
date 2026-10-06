# College Mini Project - Online FoodShop

A small static food-ordering website built with HTML, CSS, Bootstrap 5 and a little JavaScript/jQuery.

## Pages
- `index.html` - home page with an image carousel and sidebar navigation
- `order.html` - menu (fast food, drinks, tea/coffee) with prices
- `aboutus.html` - about the shop
- `contact.html` - contact cards
- `cart.html` - shopping cart (jQuery + `script1.js`): change quantities or remove items; subtotal, 5% tax and shipping are recalculated
- `login.html` - login form (`script.js`); demo users `user1`/`pword1` ... `user4`/`pword4`. Client-side only, not real security.

## Styles
`style.css` (main), `style1.css` (contact), `style2.css` (login), `cart.css` (cart).
`style3.css` is the original SCSS source of the cart styles (needs compiling; kept for reference).

## Run
Open `index.html` in a browser. Bootstrap, jQuery, Font Awesome and Google Fonts load from CDNs, so internet access is needed.

`PROJECT PPT.pptx` is the project presentation.

## Library versions (updated 2026-10)
Bootstrap 5.3.8 (CSS + bundle JS), jQuery 4.0.0 (cart page), Font Awesome 7.3.1 (contact, login; `fa-solid`/`fa-regular`/`fa-brands` prefixes). All CDN files carry SRI hashes (sha384) + `crossorigin`; Google Fonts use the `css2` API with `display=swap`.
