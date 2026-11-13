// Shop P3's "usable when" over HTTP (impl-shop P3; design-shop §18.1 "Two sites" and "Anonymous browse"), on ShopFixtures'
// demo sites: an anonymous visitor browses POPC_DEFAULT's published categories and products on ZIZI_SHOP (its root, the
// starter theme), searches, chooses a quantity and reads its returns policy page, at 390 px and on the desktop with the
// browser (P4: the purchase island prices the quantity), and without JavaScript with plain requests (every page is a link
// and the quote a GET of the product's page);
// ZIZI_DIGITAL (Shop at /shop, the PASS shell) shows only BOSS_COM_DIGITAL's product, and neither site another's;
// nothing unpublished shows anywhere (DEMO_VAR, a draft); the catalog pages are public for a minute to a cookieless
// visitor, with no cookie or session token, answer 304 to a revalidation, and are no-store for one with a session.
const SHOP = 'http://shop.zizi.localhost:' + server.port
const DIGITAL = 'http://digital.zizi.localhost:' + server.port
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
/* A plain request with no cookie, as a visitor's first. */
const plain = (url) => session().get(url)
feature(
    'an anonymous visitor browses ZIZI_SHOP at phone width: categories, a product, a quantity, search and the returns page',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            const home = page.goto(SHOP + '/')
            const homeView = { text: page.text(), overflow: overflow(page) }
            page.getByRole('link', { name: 'Categories', exact: true }).click()
            page.waitFor(() => location.pathname === '/Categories', {
                timeout: 15,
            })
            const categories = { text: page.text(), overflow: overflow(page) }
            page.getByRole('link', {
                name: 'Demo Category One',
                exact: true,
            }).click()
            page.waitFor(
                () => location.pathname.startsWith('/categories/DEMO_ONE/'),
                { timeout: 15 },
            )
            const category = {
                text: page.text(),
                path: page.evaluate(() => location.pathname),
                overflow: overflow(page),
            }
            page.getByRole('link', {
                name: 'Demo Product One-One',
                exact: true,
            }).click()
            page.waitFor(
                () => location.pathname.startsWith('/products/DEMO_1_1/'),
                { timeout: 15 },
            )
            const product = { text: page.text(), overflow: overflow(page) }
            // P4: the purchase island prices a changed quantity in place (the plain form's Show price is the no-script way)
            page.waitFor(
                () =>
                    !!document.querySelector('#ShopPurchase .m-public-island'),
                { timeout: 20 },
            )
            page.getByLabel('Quantity').fill('3')
            page.getByLabel('Quantity').press('Tab')
            page.waitFor(
                () => document.body.innerText.includes('3 × $16.99 = $50.97'),
                { timeout: 15 },
            )
            const quoted = page.text()
            page.goto(SHOP + '/Search')
            page.getByLabel('Search the store').fill('One-Two')
            page.getByRole('button', { name: 'Search', exact: true }).click()
            page.waitFor(() => location.search.includes('q='), { timeout: 15 })
            const search = { text: page.text(), overflow: overflow(page) }
            page.goto(SHOP + '/pages/returns')
            const returns = { text: page.text(), overflow: overflow(page) }
            return {
                home,
                homeView,
                categories,
                category,
                product,
                quoted,
                search,
                returns,
            }
        },
        then({
            home,
            homeView,
            categories,
            category,
            product,
            quoted,
            search,
            returns,
        }) {
            home.status === 200
            homeView.text.includes('Ziziwork Retail Store')
            homeView.text.includes('Demo Product One-One')
            !homeView.text.includes('Demo with Variants')
            homeView.overflow === false
            categories.text.includes('Demo Category One')
            categories.overflow === false
            category.path === '/categories/DEMO_ONE/demo-category-one'
            category.text.includes('Demo Product One-One')
            category.overflow === false
            product.text.includes('Demo Product One-One')
            product.text.includes('$16.99')
            product.overflow === false
            quoted.includes('3 × $16.99 = $50.97')
            search.text.includes('Demo Product One-Two')
            search.overflow === false
            returns.text.includes('Returns policy')
            returns.text.includes('within 30 days of delivery')
            returns.overflow === false
        },
    },
)
feature(
    'on the desktop ZIZI_DIGITAL shows only its own product, in the PASS shell; neither site shows the other’s',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 1440, height: 1000 },
            })
            page.goto(DIGITAL + '/shop')
            const home = page.text()
            page.goto(DIGITAL + '/shop/Search?q=Demo')
            const search = page.text()
            // the other store's product is Not Found here, which the browser reports
            page.allowProblems(/404 Not Found/)
            const crossed = page.goto(
                DIGITAL + '/shop/products/DEMO_1_1/demo-product-one-one',
            )
            const crossedText = page.text()
            const guide = page.goto(
                DIGITAL + '/shop/products/PASS_HTTP_GUIDE/digital-field-guide',
            )
            const guideText = page.text()
            const otherWay = plain(
                SHOP + '/products/PASS_HTTP_GUIDE/digital-field-guide',
            )
            return {
                home,
                search,
                crossed,
                crossedText,
                guide,
                guideText,
                otherWay,
            }
        },
        then({
            home,
            search,
            crossed,
            crossedText,
            guide,
            guideText,
            otherWay,
        }) {
            home.includes('Ziziwork Digital Store')
            home.includes('Digital field guide')
            !home.includes('Demo Product')
            !search.includes('Demo Product')
            crossed.status === 404
            !crossedText.includes('Demo Product One-One')
            guide.status === 200
            guideText.includes('$9.00')
            otherWay.status === 404
            !otherWay.text.includes('Digital field guide')
        },
    },
)
feature(
    'without JavaScript: the pages, the purchase selection and the old slug work as plain requests; nothing unpublished shows',
    {
        when() {
            return {
                home: plain(SHOP + '/'),
                oldSlug: plain(
                    SHOP + '/products/DEMO_1_1/an-old-name?quantity=2',
                ),
                quote: plain(
                    SHOP + '/products/DEMO_1_1/demo-product-one-one?quantity=2',
                ),
                unpublished: plain(
                    SHOP + '/products/DEMO_VAR/demo-with-variants',
                ),
                search: plain(SHOP + '/Search?q=Variants'),
                sitemap: plain(SHOP + '/sitemap.xml'),
                robots: plain(SHOP + '/robots.txt'),
                unknownPage: plain(SHOP + '/pages/no-such-page'),
            }
        },
        then({
            home,
            oldSlug,
            quote,
            unpublished,
            search,
            sitemap,
            robots,
            unknownPage,
        }) {
            home.status === 200
            home.text.includes('href="/products/DEMO_1_1/demo-product-one-one"')
            oldSlug.status === 301
            oldSlug.location.endsWith(
                '/products/DEMO_1_1/demo-product-one-one?quantity=2',
            )
            quote.status === 200
            quote.text.includes('2 × $16.99 = $33.98')
            quote.text.includes('<script type="application/ld+json">')
            quote.text.includes('"price":"16.99"')
            unpublished.status === 404
            !unpublished.text.includes('Demo with Variants')
            !search.text.includes('Demo with Variants')
            sitemap.status === 200
            sitemap.text.includes(
                '<loc>' +
                    SHOP +
                    '/products/DEMO_1_1/demo-product-one-one</loc>',
            )
            sitemap.text.includes('<loc>' + SHOP + '/pages/returns</loc>')
            !sitemap.text.includes('DEMO_VAR')
            robots.text.includes('Sitemap: ' + SHOP + '/sitemap.xml')
            unknownPage.status === 404
        },
    },
)
feature(
    'a cookieless visitor gets a public page with no cookie or token and a 304 to revalidate; one with a session no-store',
    {
        when() {
            const first = plain(
                SHOP + '/products/DEMO_1_1/demo-product-one-one',
            )
            const again = session().get(
                SHOP + '/products/DEMO_1_1/demo-product-one-one',
                {
                    headers: { 'If-None-Match': first.header('etag') || '' },
                },
            )
            // a visitor with a session (its cookie from the sign-in page): no-store
            const withSession = session()
            withSession.get(SHOP + '/account/Login')
            const mine = withSession.get(
                SHOP + '/products/DEMO_1_1/demo-product-one-one',
            )
            const notFound = plain(
                SHOP + '/products/DEMO_VAR/demo-with-variants',
            )
            // the PASS shell's Not Found (ZIZI_DIGITAL has no theme): the framework's page, never public
            const shellNotFound = plain(
                DIGITAL + '/shop/products/DEMO_1_1/demo-product-one-one',
            )
            return { first, again, mine, notFound, shellNotFound }
        },
        then({ first, again, mine, notFound, shellNotFound }) {
            first.status === 200
            first.header('cache-control') === 'public, max-age=60'
            first.headers('set-cookie').length === 0
            first.header('moquisessiontoken') == null
            !first.text.includes('moquiSessionToken')
            !!first.header('etag')
            again.status === 304
            mine.header('cache-control') === 'no-store'
            notFound.header('cache-control') === 'no-store'
            shellNotFound.status === 404
            String(shellNotFound.header('cache-control')).includes('no-store')
        },
    },
)
