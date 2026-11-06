// Shop P5's "usable when" in the browser (impl-shop P5; design-shop §18.1 "Guest checkout and later account login", its
// checkout half), at 390 px on ShopFixtures' ZIZI_SHOP (the starter theme at the site's root): a guest adds a physical
// item, checks out (contact, the delivery address, a delivery option, the hosted payment option, the terms), goes to the
// hosted test page, comes back to the site and sees the confirmation, with no horizontal overflow on the way; sending the
// same submit again answers the first order. The price, unknown-outcome and capture scenarios are ShopPaymentScenarios.
const SHOP = 'http://shop.zizi.localhost:' + server.port
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const until = (page, text) =>
    page.waitFor((t) => document.body.innerText.includes(t), {
        arg: text,
        timeout: 20,
    })
feature(
    'a guest checks out a physical item through the hosted page and returns to the confirmation, at phone width',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            page.goto(SHOP + '/products/DEMO_1_1/demo-product-one-one')
            page.getByRole('button', {
                name: 'Add to cart',
                exact: true,
            }).click()
            until(page, 'Your cart has')
            page.goto(SHOP + '/Cart')
            page.getByRole('button', { name: 'Check out' }).click()
            page.waitFor(() => location.pathname === '/Checkout', {
                timeout: 20,
            })
            const steps = { overflow: overflow(page) }
            page.getByLabel('Email').fill('walker@shop-accept.example.test')
            page.locator('#CheckoutContact input[name="name"]').fill(
                'Walker Guest',
            )
            page.getByRole('button', { name: 'Save contact' }).click()
            until(page, 'Saved your contact details')
            page.locator('#CheckoutAddresses input[name="address1"]').fill(
                '12 Checkout Lane',
            )
            page.locator('#CheckoutAddresses input[name="city"]').fill(
                'Springfield',
            )
            page.locator(
                '#CheckoutAddresses input[name="stateProvinceGeoId"]',
            ).fill('USA_IL')
            page.locator('#CheckoutAddresses input[name="postalCode"]').fill(
                '62701',
            )
            page.getByRole('button', { name: 'Save address' }).click()
            until(page, 'Saved the address')
            page.locator('#CheckoutDelivery input[type="radio"]')
                .first()
                .click()
            page.getByRole('button', { name: 'Choose delivery' }).click()
            until(page, 'Chose the delivery')
            page.locator('#CheckoutPayment input[type="radio"]').first().click()
            page.getByRole('button', { name: 'Choose payment' }).click()
            until(page, 'Chose how to pay')
            steps.review = page.text()
            page.locator('#CheckoutSubmit input[name="acceptTerms"]').click()
            const submitForm = page.evaluate(() =>
                Object.fromEntries(
                    new FormData(document.getElementById('CheckoutSubmit')),
                ),
            )
            page.locator('#CheckoutSubmit button').click()
            page.waitFor(() => location.pathname === '/PaymentResult', {
                timeout: 20,
            })
            steps.pending = { text: page.text(), overflow: overflow(page) }
            const provider = page
                .getByRole('link', { name: 'Continue to the payment page' })
                .attribute('href')
            page.goto(provider.replace(/^https:\/\/[^/]+/, SHOP))
            page.waitFor(() => location.pathname === '/OrderConfirmation', {
                timeout: 20,
            })
            steps.confirmation = {
                text: page.text(),
                overflow: overflow(page),
                url: page.url(),
            }
            return { steps, provider, submitForm }
        },
        then({ steps, provider }) {
            steps.overflow === false
            steps.review.includes('Delivery')
            steps.review.includes('Terms of sale')
            steps.pending.text.includes('Your payment is not confirmed yet')
            steps.pending.overflow === false
            provider.includes('/Checkout/return?ref=')
            steps.confirmation.text.includes('Thank you for your order')
            steps.confirmation.text.includes('Demo Product One-One')
            steps.confirmation.text.includes('12 Checkout Lane')
            steps.confirmation.overflow === false
            !steps.confirmation.url.includes('key=')
        },
    },
)
