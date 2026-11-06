// Shop's one golden-path walk (impl-shop P5, impl-commerce F44), on ShopWalkFixtures' Shop of the HTTP test community: a
// guest opens a product, adds it to the cart, checks out (contact and the hosted payment option), places the order, goes
// to the test gateway's hosted page, which returns to the site, and sees the confirmation. The rules are the server specs'
// (mr-mantle ShopCheckout, mr-pass ShopCheckout); the scenarios with stock, price and outcome changes are acceptance.
feature(
    'a guest browses, adds to the cart, pays on the hosted page and sees the confirmation',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            page.goto('/shop/products/PASS_WALK_GUIDE/walk-field-guide')
            page.getByRole('button', {
                name: 'Add to cart',
                exact: true,
            }).click()
            page.goto('/shop/Cart')
            page.getByRole('button', { name: 'Check out' }).click()
            page.waitFor(() => location.pathname.endsWith('/Checkout'), {
                timeout: 15,
            })
            page.getByLabel('Email').fill('walker@shop.example.test')
            page.getByLabel('Name').fill('Wendy Walker')
            page.getByRole('button', { name: 'Save contact' }).click()
            page.waitFor(
                () =>
                    document.body.innerText.includes(
                        'Saved your contact details',
                    ),
                { timeout: 15 },
            )
            page.getByRole('radio', { name: /Credit Card/ }).click()
            page.getByRole('button', { name: 'Choose payment' }).click()
            page.waitFor(
                () => document.body.innerText.includes('Chose how to pay'),
                { timeout: 15 },
            )
            page.getByRole('button', {
                name: 'Place order and pay $15.00',
            }).click()
            page.waitFor(() => location.pathname.endsWith('/PaymentResult'), {
                timeout: 15,
            })
            const pending = page.text()
            const provider = page
                .getByRole('link', { name: 'Continue to the payment page' })
                .attribute('href')
            // the test gateway's hosted page sends the payer straight back to the canonical return address; the result page
            // looks the payment up (polling) and shows the placed order
            page.goto(provider.replace(/^https:\/\/[^/]+/, ''))
            page.waitFor(
                () => location.pathname.endsWith('/OrderConfirmation'),
                { timeout: 15 },
            )
            return {
                pending,
                provider,
                confirmation: page.text(),
                url: page.url(),
                overflow: page.evaluate(
                    () => document.documentElement.scrollWidth > innerWidth,
                ),
                qr: page.evaluate(
                    () => !!document.querySelector('.shop-order-qr svg'),
                ),
            }
        },
        then({ pending, provider, confirmation, url, overflow, qr }) {
            pending.includes('Your payment is not confirmed yet')
            provider.includes('/shop/Checkout/return?ref=')
            confirmation.includes('Thank you for your order')
            confirmation.includes('Walk field guide')
            confirmation.includes('$15.00')
            confirmation.includes('walker@shop.example.test')
            !url.includes('key=')
            overflow === false
            qr === true
        },
    },
)
