// Shop P4's "usable when" in the browser (impl-shop P4; design-shop §18.1 "Guest checkout and later account login", its cart
// half), at 390 px on ShopFixtures' ZIZI_SHOP (the starter theme at the site's root): a guest chooses
// a quantity on a product page, whose purchase island updates the price and adds to the cart announcing its count without
// leaving the page, adds a second item, opens the cart (its island), applies TEST2 and sees the discount; signing in merges
// the guest cart into the shopper's own cart, with the page's notice. The product image comes through the public image
// route (F61). The plain forms and the stale-change refusal are ShopCartRemoteHttp's.
const SHOP = 'http://shop.zizi.localhost:' + server.port
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const island = (page, id) =>
    page.waitFor(
        (mountId) =>
            !!document.querySelector('#' + mountId + ' .m-public-island'),
        { arg: id, timeout: 20 },
    )
feature(
    'a guest fills a cart at phone width through the islands, applies TEST2, then signs in and the carts merge',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            page.goto(SHOP + '/products/DEMO_1_1/demo-product-one-one')
            island(page, 'ShopPurchase')
            const image = page.evaluate(() =>
                Array.from(document.images).some(
                    (img) =>
                        img.src.includes('/media?productContentId=') &&
                        img.naturalWidth > 0,
                ),
            )
            page.getByLabel('Quantity').fill('2')
            page.getByLabel('Quantity').press('Tab')
            page.waitFor(
                () => document.body.innerText.includes('2 × $16.99 = $33.98'),
                { timeout: 15 },
            )
            page.getByRole('button', {
                name: 'Add to cart',
                exact: true,
            }).click()
            page.waitFor(
                () =>
                    document.body.innerText.includes('Your cart has 2 items.'),
                { timeout: 15 },
            )
            const added = {
                path: page.evaluate(() => location.pathname),
                overflow: overflow(page),
            }
            page.goto(SHOP + '/products/DEMO_3_1/demo-product-three-one')
            island(page, 'ShopPurchase')
            page.getByRole('button', {
                name: 'Add to cart',
                exact: true,
            }).click()
            page.waitFor(
                () =>
                    document.body.innerText.includes('Your cart has 3 items.'),
                { timeout: 15 },
            )
            page.getByRole('link', { name: /^View cart/ }).click()
            page.waitForURL(/\/Cart$/)
            island(page, 'ShopCart')
            const cart = { text: page.text(), overflow: overflow(page) }
            page.getByLabel('Promotion code', { exact: true }).fill('TEST2')
            page.getByRole('button', { name: 'Apply', exact: true }).click()
            page.waitFor(
                () => document.body.innerText.includes('Applied the code'),
                { timeout: 15 },
            )
            const coded = page.text()
            page.goto(SHOP + '/account/Login?returnTo=/Cart')
            page.getByLabel('Email or username', { exact: true }).fill(
                'pass_http_shopper',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            // the sign-in returns to the cart, which shows the merge's notice once
            page.waitForURL(/\/Cart$/)
            island(page, 'ShopCart')
            page.waitFor(
                () => document.body.innerText.includes('Demo Product One-Two'),
                { timeout: 15 },
            )
            const merged = { text: page.text(), overflow: overflow(page) }
            return { image, added, cart, coded, merged }
        },
        then({ image, added, cart, coded, merged }) {
            image === true
            added.path === '/products/DEMO_1_1/demo-product-one-one'
            added.overflow === false
            cart.text.includes('Demo Product One-One')
            cart.text.includes('Demo Product Three-One')
            cart.overflow === false
            coded.includes('TEST2: Buy 1 Get 1 Half Off')
            coded.includes('Discounts')
            merged.text.includes(
                'We added the items from this browser to your cart.',
            )
            merged.text.includes('Demo Product One-One')
            merged.text.includes('Demo Product Three-One')
            merged.text.includes('Demo Product One-Two')
            merged.overflow === false
        },
    },
)
