// Shop P3's "usable when" through a remote frontend (impl-shop P3; design-shop §18.1 "Two sites", "Anonymous browse"): run
// against the remote frontend of docs/Deployment.md "Reproducing the remote check" (its authority serving ShopFixtures,
// the frontend ShopRemoteFixtures), the demo Shop sites read over the authority connection: ZIZI_SHOP's themed catalog
// (the release fetched and verified by the frontend), a product's quote, the returns page and search; ZIZI_DIGITAL only
// its own product; nothing unpublished; the public catalog headers and a 304. Against `./moq accept mr-pass`'s served
// server (a local authority) it checks the same pages.
const SHOP = 'http://shop.zizi.localhost:' + server.port
const DIGITAL = 'http://digital.zizi.localhost:' + server.port
const plain = (url, opts) => session().get(url, opts)
feature(
    'ZIZI_SHOP and ZIZI_DIGITAL read over the authority show only their own published products',
    {
        when() {
            return {
                home: plain(SHOP + '/'),
                category: plain(
                    SHOP + '/categories/DEMO_ONE/demo-category-one',
                ),
                quote: plain(
                    SHOP + '/products/DEMO_1_1/demo-product-one-one?quantity=2',
                ),
                search: plain(SHOP + '/Search?q=Demo'),
                returns: plain(SHOP + '/pages/returns'),
                unpublished: plain(
                    SHOP + '/products/DEMO_VAR/demo-with-variants',
                ),
                digital: plain(DIGITAL + '/shop'),
                crossed: plain(
                    DIGITAL + '/shop/products/DEMO_1_1/demo-product-one-one',
                ),
                otherWay: plain(
                    SHOP + '/products/PASS_HTTP_GUIDE/digital-field-guide',
                ),
            }
        },
        then({
            home,
            category,
            quote,
            search,
            returns,
            unpublished,
            digital,
            crossed,
            otherWay,
        }) {
            home.status === 200
            home.text.includes('Ziziwork Retail Store')
            home.text.includes('Demo Product One-One')
            category.text.includes('Demo Product One-One')
            quote.text.includes('2 × $16.99 = $33.98')
            quote.text.includes('"price":"16.99"')
            search.text.includes('Demo Product One-Two')
            !search.text.includes('Demo with Variants')
            returns.text.includes('within 30 days of delivery')
            unpublished.status === 404
            digital.text.includes('Digital field guide')
            !digital.text.includes('Demo Product')
            crossed.status === 404
            otherWay.status === 404
        },
    },
)
feature(
    'the remote catalog pages are public for a minute to a cookieless visitor and revalidate with a 304',
    {
        when() {
            const first = plain(
                SHOP + '/products/DEMO_1_1/demo-product-one-one',
            )
            const again = plain(
                SHOP + '/products/DEMO_1_1/demo-product-one-one',
                {
                    headers: { 'If-None-Match': first.header('etag') || '' },
                },
            )
            return { first, again }
        },
        then({ first, again }) {
            first.header('cache-control') === 'public, max-age=60'
            first.headers('set-cookie').length === 0
            !first.text.includes('moquiSessionToken')
            again.status === 304
        },
    },
)
