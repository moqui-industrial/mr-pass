// Shop P9's accessibility and device checks in the browser (impl-shop P9; design-shop §18.1 "Accessibility and devices"),
// on ShopFixtures' demo sites at 390 px: a guest buys with the keyboard alone (Tab to each control, typing, Space for a
// choice, Enter to send), from the product page's Add to cart through the cart and every checkout step to the payment
// page; the purchase island's count, the cart's totals and the checkout's totals are in polite live regions; a field the
// authority refuses (an email address without a domain the browser accepts) comes back as an alert the field is described
// by, the field marked invalid and focused; no page of the walk scrolls sideways. Motion: with reduced motion emulated, the
// starter theme (ZIZI_SHOP) and the PASS shell (ZIZI_DIGITAL's Shop at /shop) stop every animation and transition, and
// without it their rule does not apply. A signed-in shopper's account pages and ZIZI_DIGITAL's Shop pages do not scroll
// sideways at 390 px. With the page's scripts off, a guest finds a product from the home page, shows a quantity's price
// and adds it to the cart through the plain forms.
// Run: ./moq accept mr-pass --spec ShopFixtures,ShopAccessibilityHttp
const SHOP = 'http://shop.zizi.localhost:' + server.port
const DIGITAL = 'http://digital.zizi.localhost:' + server.port
const PHONE = { width: 390, height: 844 }
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const until = (page, text) =>
    page.waitFor((t) => document.body.innerText.includes(t), {
        arg: text,
        timeout: 20,
    })
const island = (page, id) =>
    page.waitFor(
        (mountId) =>
            !!document.querySelector('#' + mountId + ' .m-public-island'),
        { arg: id, timeout: 20 },
    )
/* Tab until the focused element matches the selector (and the text, for a button); fails when Tab never reaches it. */
function tabTo(page, selector, text) {
    for (let i = 0; i < 80; i++) {
        page.keyboard.press('Tab')
        const there = page.evaluate(
            ({ selector, text }) => {
                const el = document.activeElement
                return (
                    !!el &&
                    el.matches(selector) &&
                    (!text || el.innerText.trim() === text)
                )
            },
            { selector, text: text || null },
        )
        if (there) return i + 1
    }
    throw new Error('Tab never reached ' + selector + (text ? ' ' + text : ''))
}
const focused = (page) =>
    page.evaluate(() => {
        const el = document.activeElement
        return {
            name: el?.getAttribute('name') || null,
            invalid: el?.getAttribute('aria-invalid') || null,
            describedBy: el?.getAttribute('aria-describedby') || null,
        }
    })
/* Whether the element holding the text is inside a polite live region (or a status or alert). */
const live = (page, text) =>
    page.evaluate((t) => {
        const all = Array.from(document.querySelectorAll('body *')).filter(
            (el) =>
                el.children.length === 0 &&
                el.textContent.includes(t) &&
                el.offsetParent !== null,
        )
        return all.some(
            (el) =>
                !!el.closest('[aria-live="polite"],[role=status],[role=alert]'),
        )
    }, text)
/* The page's motion: whether every element's animations and transitions are stopped (at most 0.1 ms), and whether the
 * reduced-motion rule is what set the body's transition (0s when it does not apply). */
const motion = (page) =>
    page.evaluate(() => {
        const seconds = (text) =>
            Math.max(
                ...String(text)
                    .split(',')
                    .map(
                        (part) =>
                            parseFloat(part) *
                            (/ms\s*$/.test(part) ? 0.001 : 1),
                    ),
            )
        let longest = 0
        for (const el of Array.from(document.querySelectorAll('*'))) {
            const style = getComputedStyle(el)
            longest = Math.max(
                longest,
                seconds(style.transitionDuration),
                seconds(style.animationDuration),
            )
        }
        return {
            stopped: longest <= 0.0001,
            ruled: getComputedStyle(document.body).transitionDuration !== '0s',
        }
    })
feature(
    'a guest buys with the keyboard alone at phone width; totals are announced and a refused field is labelled and focused',
    {
        when() {
            const page = browser.newPage({ viewport: PHONE })
            const sideways = []
            const look = (name) => {
                if (overflow(page)) sideways.push(name)
            }
            page.goto(SHOP + '/products/DEMO_1_1/demo-product-one-one')
            island(page, 'ShopPurchase')
            look('product')
            const quoteLive = page.evaluate(
                () =>
                    document
                        .querySelector('#ShopPurchase .shop-quote')
                        ?.getAttribute('aria-live') || null,
            )
            tabTo(page, '#ShopPurchase button.shop-add')
            page.keyboard.press('Enter')
            until(page, 'Your cart has')
            const countLive = live(page, 'Your cart has')
            page.goto(SHOP + '/Cart')
            island(page, 'ShopCart')
            look('cart')
            const cartTotalsLive = page.evaluate(
                () =>
                    document
                        .getElementById('ShopCartTotals')
                        ?.getAttribute('aria-live') || null,
            )
            tabTo(page, '#ShopCart button[type="submit"]', 'Check out')
            page.keyboard.press('Enter')
            page.waitFor(() => location.pathname === '/Checkout', {
                timeout: 20,
            })
            look('checkout')
            // Contact: an address the browser takes and the authority refuses
            tabTo(page, '#CheckoutContact input[name="emailAddress"]')
            page.keyboard.type('keys@shop-accept')
            tabTo(page, '#CheckoutContact input[name="name"]')
            page.keyboard.type('Keyboard Guest')
            page.keyboard.press('Enter')
            until(page, 'Enter the email address for your order')
            page.waitFor(
                () =>
                    document.activeElement?.getAttribute('name') ===
                    'emailAddress',
                { timeout: 10 },
            )
            const refused = {
                focus: focused(page),
                alert: page.evaluate(() => {
                    const notice = document.getElementById('ShopNotice')
                    return notice
                        ? {
                              role: notice.getAttribute('role'),
                              text: notice.innerText,
                          }
                        : null
                }),
                overflow: overflow(page),
            }
            page.keyboard.type('keys@shop-accept.example.test')
            tabTo(page, '#CheckoutContact input[name="name"]')
            page.keyboard.type('Keyboard Guest')
            page.keyboard.press('Enter')
            until(page, 'Saved your contact details')
            // the delivery address
            tabTo(page, '#CheckoutAddresses input[name="address1"]')
            page.keyboard.type('5 Keyboard Way')
            tabTo(page, '#CheckoutAddresses input[name="city"]')
            page.keyboard.type('Springfield')
            tabTo(page, '#CheckoutAddresses input[name="stateProvinceGeoId"]')
            page.keyboard.type('USA_IL')
            tabTo(page, '#CheckoutAddresses input[name="postalCode"]')
            page.keyboard.type('62701')
            page.keyboard.press('Enter')
            until(page, 'Saved the address')
            look('address')
            // a delivery option and the payment option: Space chooses, Enter on the button sends
            tabTo(page, '#CheckoutDelivery input[type="radio"]')
            page.keyboard.press(' ')
            tabTo(page, '#CheckoutDelivery button', 'Choose delivery')
            page.keyboard.press('Enter')
            until(page, 'Chose the delivery')
            tabTo(page, '#CheckoutPayment input[type="radio"]')
            page.keyboard.press(' ')
            tabTo(page, '#CheckoutPayment button', 'Choose payment')
            page.keyboard.press('Enter')
            until(page, 'Chose how to pay')
            look('review')
            const checkoutTotals = page.evaluate(() => {
                const totals = document.getElementById('CheckoutTotals')
                return totals
                    ? {
                          live: totals.getAttribute('aria-live'),
                          text: totals.innerText,
                      }
                    : null
            })
            tabTo(page, '#CheckoutSubmit input[name="acceptTerms"]')
            page.keyboard.press(' ')
            tabTo(page, '#CheckoutSubmit button')
            page.keyboard.press('Enter')
            page.waitFor(() => location.pathname === '/PaymentResult', {
                timeout: 20,
            })
            look('payment result')
            // the provider's page is the hosted test page, which returns the payer to the confirmation; the result page's
            // own check may find the test payment approved first (F77) and go there by itself
            const provider = page.evaluate(
                () => document.querySelector('a.shop-pay-link')?.href || null,
            )
            if (provider && page.url().includes('/PaymentResult'))
                page.goto(provider.replace(/^https:\/\/[^/]+/, SHOP))
            page.waitFor(() => location.pathname === '/OrderConfirmation', {
                timeout: 20,
            })
            look('confirmation')
            return {
                sideways,
                quoteLive,
                countLive,
                cartTotalsLive,
                refused,
                checkoutTotals,
                confirmation: page.text(),
            }
        },
        then(r) {
            r.sideways.length === 0
            r.quoteLive === 'polite'
            r.countLive === true
            r.cartTotalsLive === 'polite'
            r.refused.alert.role === 'alert'
            r.refused.alert.text.includes(
                'Enter the email address for your order',
            )
            r.refused.focus.name === 'emailAddress'
            r.refused.focus.invalid === 'true'
            r.refused.focus.describedBy === 'ShopNotice'
            r.refused.overflow === false
            r.checkoutTotals.live === 'polite'
            r.checkoutTotals.text.includes('Total')
            r.confirmation.includes('Thank you for your order')
            r.confirmation.includes('5 Keyboard Way')
        },
    },
)
feature(
    'the starter theme and the PASS shell stop animations and transitions under reduced motion',
    {
        when() {
            const page = browser.newPage({
                viewport: PHONE,
                reducedMotion: 'reduce',
            })
            page.goto(SHOP + '/')
            const themed = motion(page)
            page.goto(DIGITAL + '/shop/')
            const shell = motion(page)
            page.setEmulation({ reducedMotion: 'no-preference' })
            page.goto(SHOP + '/')
            const themedMoving = motion(page)
            page.goto(DIGITAL + '/shop/')
            const shellMoving = motion(page)
            return { themed, shell, themedMoving, shellMoving }
        },
        then({ themed, shell, themedMoving, shellMoving }) {
            themed.stopped === true
            themed.ruled === true
            shell.stopped === true
            shell.ruled === true
            themedMoving.ruled === false
            shellMoving.ruled === false
        },
    },
)
feature(
    "without JavaScript a guest finds a product, shows a quantity's price and adds it to the cart with the plain forms",
    {
        when() {
            const page = browser.newPage({ viewport: PHONE, javaScript: false })
            page.goto(SHOP + '/')
            const product = page
                .locator('a[href="/products/DEMO_1_1/demo-product-one-one"]')
                .first()
            product.click()
            page.waitForURL(/\/products\/DEMO_1_1\//)
            const islandMounted = page.evaluate(
                () =>
                    !!document.querySelector('#ShopPurchase .m-public-island'),
            )
            page.getByLabel('Quantity').fill('2')
            page.getByRole('button', {
                name: 'Show price',
                exact: true,
            }).click()
            until(page, '2 × $16.99 = $33.98')
            page.getByRole('button', {
                name: 'Add to cart',
                exact: true,
            }).click()
            page.waitForURL(/\/Cart$/)
            return {
                islandMounted,
                cart: page.text(),
                sideways: overflow(page),
            }
        },
        then({ islandMounted, cart, sideways }) {
            islandMounted === false
            cart.includes('Demo Product One-One')
            cart.includes('$16.99 each')
            sideways === false
        },
    },
)
feature(
    "a signed-in shopper's account pages and ZIZI_DIGITAL's Shop pages do not scroll sideways at 390 px",
    {
        when() {
            const page = browser.newPage({ viewport: PHONE })
            page.goto(SHOP + '/account/Login?returnTo=/Account')
            page.getByLabel('Email or username', { exact: true }).fill(
                'pass_http_shopper',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL(/\/Account$/)
            const pages = {}
            for (const path of [
                '/Account',
                '/Orders',
                '/Downloads',
                '/Subscriptions',
                '/Addresses',
                '/PaymentMethods',
                '/account',
            ]) {
                const status = page.goto(SHOP + path).status
                pages['shop' + path] = { status, overflow: overflow(page) }
            }
            for (const path of ['/shop/', '/shop/Categories', '/shop/Cart']) {
                const status = page.goto(DIGITAL + path).status
                pages['digital' + path] = { status, overflow: overflow(page) }
            }
            return { pages }
        },
        then({ pages }) {
            Object.keys(pages).length === 10
            Object.values(pages).every((p) => p.status === 200)
            Object.values(pages).every((p) => p.overflow === false)
        },
    },
)
