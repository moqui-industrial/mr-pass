// Shop's cart on PASS (impl-shop P4; design-shop §6 Cart, §7.1, §13.1; F44, F45): the cart page's one render through the
// published starter theme (the shop.cart component's lines, forms and totals with its island, never the capability); the
// cart writes as token writes, with the first add an anonymous one, the three TOKEN_WRITES lists equal, and a remote
// frontend's answers and refusals (a stale revision, a refused code) the same as a local page's; sign-in attaching the
// session's cart and sign-out dropping it. The cart's rules are Mantle's (mr-mantle test/order/ShopCart).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const shopCart = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_CART',
    HOST = 'cart.shop.example.test'
const ids = { mug: 'PSCART_MUG', store: 'PASS_SHOP_CART_STORE' }
const state = {}
const siteInfo = { mounts: [{ app: 'shop', pathPrefix: '/shop' }] }
/* The trusted context the Shop pages read (getShopContext). */
const context = () => lib().facade('getShopContext', { siteId: SITE }).result
const sessionToken = () =>
    ec.web.sessionAttributes[shopCart().tokenKey(SITE)] || null
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Cart Store',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
            requireInventory: 'N',
            defaultDisableShippingCalc: 'Y',
        })
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'account', pathPrefix: '/account' },
            { app: 'shop', pathPrefix: '/shop', targetId: ids.store },
        ])
        l.setState(SITE, 'published')
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-spec-secret',
        )
        setProperty(
            'pass_client_' + l.ids.client + '_sites',
            'PASS_SHOP_CAT,' + SITE,
        )
        l.run('create#mantle.product.Product', {
            productId: ids.mug,
            productName: 'Spec cart mug',
            productTypeEnumId: 'PtDigital',
        })
        l.run('create#mantle.product.ProductPrice', {
            productId: ids.mug,
            pricePurposeEnumId: 'PppPurchase',
            priceTypeEnumId: 'PptCurrent',
            fromDate: 0,
            minQuantity: 1,
            price: '10.00',
            priceUomId: 'USD',
        })
        l.run('create#mantle.product.store.ProductStoreProduct', {
            productStoreId: ids.store,
            productId: ids.mug,
            fromDate: 0,
        })
        const themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: ids.store,
            starter: 'mr-pass/starter',
        }).themeId
        const { validationDigest } = l.run(T + 'validate#Theme', { themeId })
        state.release = l.run(T + 'publish#Theme', {
            operationKey:
                'SHOPCART-' +
                Date.now() +
                '-' +
                Math.floor(Math.random() * 1e6),
            themeId,
            siteId: SITE,
            validationDigest,
            expectedActiveRevision: 0,
        })
    },
    cleanup() {
        ec.web.sessionAttributes.remove(shopCart().tokenKey(SITE))
        login('john.doe')
    },
})
feature(
    "the cart page renders the session's cart through the theme's cart component and its island, never the capability",
    {
        when() {
            logout()
            try {
                const added = shopCart().call(context(), 'addCartItem', {
                    productId: ids.mug,
                    quantity: '2',
                })
                const rendered = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                    .render(
                        'Shop/Cart',
                        {
                            resolvedSiteId: SITE,
                            publicHost: HOST,
                            publicPath: '/shop/Cart',
                        },
                        null,
                    )
                return {
                    added,
                    token: sessionToken(),
                    html: rendered.output,
                    errors: rendered.errorMessages,
                }
            } finally {
                login('john.doe')
            }
        },
        then({ added, token, html, errors }) {
            errors.length == 0
            added.result.summary.itemCount == 2
            added.result.token == null
            token.length == 48
            html.includes(
                'href="/shop/theme/' +
                    state.release.manifestDigest +
                    '/store.css"',
            )
            html.includes('Spec cart mug')
            html.includes('$10.00 each')
            html.includes('$20.00')
            html.includes('action="/shop/Cart/update"')
            html.includes('action="/shop/Cart/remove"')
            html.includes('action="/shop/Cart/applyCode"')
            html.includes('name="expectedRevision"')
            html.includes('name="operationId"')
            html.includes('data-moqui-island="ShopCart"')
            html.includes('/js/WebrootPublic.qvt.js')
            html.includes('href="/shop/Cart">Cart</a>')
            !html.includes(token)
            !html.includes('Error rendering')
        },
    },
)
feature(
    "cart writes are token writes, the first add anonymous; a remote frontend's answers and refusals equal a local page's",
    {
        when() {
            const transport = ec.resource.script(
                'component://mr-pass/service/pass/Transport.js',
            )
            const lists = [
                transport.TOKEN_WRITES,
                ec.resource.script('component://mr-mantle/script/PassApi.js')
                    .TOKEN_WRITES,
                ec.resource.script(
                    'component://mr-mantle/script/PassAuthority.js',
                ).TOKEN_WRITES,
            ]
            const routed = (operation, input) => {
                try {
                    return transport.routeOf(operation, input).method
                } catch (error) {
                    return error.moquiErrorKind
                }
            }
            logout()
            try {
                const added = lib().remote('addCartItem', {
                    siteId: SITE,
                    productId: ids.mug,
                    quantity: '1',
                })
                const token = added.result?.token
                const remoteCart = lib().remote('getCart', {
                    siteId: SITE,
                    token,
                })
                const localCart = lib().facade('getCart', {
                    siteId: SITE,
                    token,
                })
                const line = localCart.result.cart.items[0].orderItemSeqId
                const staleInput = {
                    siteId: SITE,
                    token,
                    orderItemSeqId: line,
                    quantity: '4',
                    expectedRevision: '0',
                }
                const codeInput = {
                    siteId: SITE,
                    token,
                    promoCode: 'NOPE',
                    expectedRevision: localCart.result.cart.revision,
                }
                return {
                    lists,
                    anonymousAdd: routed('addCartItem', { siteId: SITE }),
                    changeWithoutToken: routed('updateCartItem', {
                        siteId: SITE,
                    }),
                    changeWithToken: routed('updateCartItem', {
                        siteId: SITE,
                        token: 'x',
                    }),
                    added,
                    remoteCart,
                    localCart,
                    remoteStale: lib().remote('updateCartItem', staleInput),
                    localStale: lib().facade('updateCartItem', staleInput),
                    remoteCode: lib().remote('applyPromoCode', codeInput),
                    localCode: lib().facade('applyPromoCode', codeInput),
                    noToken: lib().remote('getCart', { siteId: SITE }),
                }
            } finally {
                login('john.doe')
            }
        },
        then({
            lists,
            anonymousAdd,
            changeWithoutToken,
            changeWithToken,
            added,
            remoteCart,
            localCart,
            remoteStale,
            localStale,
            remoteCode,
            localCode,
            noToken,
        }) {
            JSON.stringify(lists[0]) === JSON.stringify(lists[1])
            JSON.stringify(lists[1]) === JSON.stringify(lists[2])
            ;[
                'addCartItem',
                'updateCartItem',
                'removeCartItem',
                'applyPromoCode',
                'removePromoCode',
            ].every((operation) => lists[0].includes(operation))
            anonymousAdd == 'POST'
            changeWithoutToken == 'AuthenticationRequired'
            changeWithToken == 'POST'
            added.result.token.length == 48
            JSON.stringify(remoteCart.result.cart) ===
                JSON.stringify(localCart.result.cart)
            remoteStale.kind == 'Conflict'
            remoteStale.reason == 'staleRevision'
            localStale.kind == 'Conflict'
            localStale.reason == 'staleRevision'
            remoteStale.message == localStale.message
            remoteCode.kind == 'Unprocessable'
            remoteCode.reason == 'promoCodeInvalid'
            remoteCode.fieldErrors[0].field == 'promoCode'
            remoteCode.message == localCode.message
            remoteCode.message == 'This code cannot be used with this cart'
            noToken.result.cart.empty == true
        },
    },
)
feature(
    "sign-in attaches the session's cart to the account; sign-out drops it",
    {
        when() {
            logout()
            let guestToken
            try {
                shopCart().call(context(), 'addCartItem', {
                    productId: ids.mug,
                    quantity: '1',
                })
                guestToken = sessionToken()
            } finally {
                login('john.doe')
            }
            const attached = shopCart().signedIn(SITE, guestToken, siteInfo)
            const attachedToken = sessionToken()
            shopCart().signingOut(SITE, siteInfo)
            const afterSignOut = sessionToken()
            logout()
            try {
                return {
                    guestToken,
                    attached,
                    attachedToken,
                    afterSignOut,
                    oldToken: lib().facade('getCart', {
                        siteId: SITE,
                        token: attachedToken,
                    }),
                }
            } finally {
                login('john.doe')
            }
        },
        then({ guestToken, attached, attachedToken, afterSignOut, oldToken }) {
            attached.attached == true
            attachedToken != guestToken
            attachedToken.length == 48
            afterSignOut == null
            oldToken.result.cart.empty == true
        },
    },
)
