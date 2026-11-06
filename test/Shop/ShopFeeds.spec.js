// A store feed at the Shop mount's reserved feed path (impl-commerce P14; design-commerce §9, design-shop §13.2): the path
// routes to the feed transition (and nothing else under feeds/ does), the active build is answered through the local
// facade and a remote frontend alike, and a feed with no active build, another extension or a product withdrawn after its
// build is 404. The build and publication rules are Mantle's (StoreFeeds).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const C = 'mantle.product.StoreChannelServices.'
const SITE = 'PASS_SHOP_FEED',
    HOST = 'feeds.shop.example.test'
const ids = { store: 'PASS_SHOP_FEED_STORE', mug: 'PSF_MUG', cup: 'PSF_CUP' }
const state = {}
const context = { site: { siteId: SITE } }
const feeds = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopFeeds.js')

spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Feed Store',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
        })
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'shop', pathPrefix: '/shop', targetId: ids.store },
        ])
        l.setState(SITE, 'published')
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-spec-secret',
        )
        setProperty('pass_client_' + l.ids.client + '_sites', SITE)
        const make = (entity, values) => l.run('create#' + entity, values)
        for (const productId of [ids.mug, ids.cup]) {
            make('mantle.product.Product', {
                productId,
                productName: 'Feed ' + productId,
                productTypeEnumId: 'PtDigital',
            })
            make('mantle.product.ProductPrice', {
                productId,
                pricePurposeEnumId: 'PppPurchase',
                priceTypeEnumId: 'PptCurrent',
                fromDate: 0,
                minQuantity: 1,
                price: '8.00',
                priceUomId: 'USD',
            })
            make('mantle.product.store.ProductStoreProduct', {
                productStoreId: ids.store,
                productId,
                fromDate: 0,
            })
        }
        const feedId = l.run(C + 'store#StoreFeed', {
            productStoreId: ids.store,
            siteId: SITE,
            feedName: 'Spec feed',
            feedKey: 'spec',
            formatEnumId: 'PsffCsv',
        }).productStoreFeedId
        const feedBuildId = l.run(C + 'build#StoreFeed', {
            productStoreFeedId: feedId,
        }).feedBuildId
        l.run(C + 'publish#StoreFeed', {
            productStoreFeedId: feedId,
            feedBuildId,
            expectedRevision: l.run(C + 'get#StoreFeed', {
                productStoreFeedId: feedId,
            }).feed.revision,
            operationKey: 'pass-shop-feed-' + ec.user.randomString(12),
        })
        state.l = l
    },
    cleanupSpec() {
        ec.message.clearErrors()
        login('john.doe')
    },
})

feature(
    'the feed path routes to the feed; its active build is served locally and remotely; a withdrawal takes it down',
    {
        when() {
            const l = state.l
            const routes = [
                l.route(SITE, HOST, '/shop/feeds/spec.csv'),
                l.route(SITE, HOST, '/shop/feeds/spec.html'),
                l.route(SITE, HOST, '/shop/feeds/a/b.csv'),
            ]
            logout()
            const local = feeds().feedOf(context, 'spec', 'csv')
            const remote = l.remote('getShopFeed', {
                siteId: SITE,
                feedKey: 'spec',
                extension: 'csv',
            })
            const otherExtension = feeds().feedOf(context, 'spec', 'xml')
            const unknown = feeds().feedOf(context, 'none', 'csv')
            login('john.doe')
            l.run(
                'mantle.product.StoreMerchandisingServices.publish#StoreProducts',
                {
                    productStoreId: ids.store,
                    productIds: [ids.cup],
                    action: 'withdraw',
                    changeReason: 'Spec',
                    operationKey: 'pass-shop-feed-' + ec.user.randomString(12),
                },
            )
            logout()
            const withdrawn = feeds().feedOf(context, 'spec', 'csv')
            login('john.doe')
            return { routes, local, remote, otherExtension, unknown, withdrawn }
        },
        then(r) {
            r.routes == ['/Shop/feed', 'refused:NotFound', 'refused:NotFound']
            r.local.status == 200
            r.local.contentType == 'text/csv; charset=utf-8'
            r.local.body.startsWith('id,title,description,link')
            r.local.body.includes(
                'https://' + HOST + '/shop/products/' + ids.mug + '/',
            )
            r.local.body.includes('8.00 USD')
            r.remote.result.content == r.local.body
            r.otherExtension.status == 404
            r.unknown.status == 404
            r.withdrawn.status == 404
        },
    },
)
