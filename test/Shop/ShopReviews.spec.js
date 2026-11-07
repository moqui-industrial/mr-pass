// Shop's product reviews on PASS (Commerce P9; design-shop §5 PublicReviews and SubmitReview): a verified buyer's review with a
// scanned photo through the facade, as the Review page sends it; a remote frontend reads the same approved reviews and the
// authority serves the photo by its digest only once the review is approved; the product page (one shell render) shows the
// review, the store's reply and the photo and no account; the Review page (one render) offers the buyer the change form; the
// review operations' routes (a POST submit, the photo a GET download). The rules are Mantle's (mr-mantle
// test/product/StoreReviews).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'PASS_SHOP_REVIEWS',
    HOST = 'reviews.shop.example.test'
const ids = {
    store: 'PASS_SHOP_REV_STORE',
    mug: 'PSREV_MUG',
    buyer: 'PSREV_BUYER',
}
// a 1x1 PNG
const PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const state = {}
function renderWith(path, screenPath, parameters) {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            screenPath,
            {
                resolvedSiteId: SITE,
                publicHost: HOST,
                publicPath: path,
                ...parameters,
            },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
const authority = (operation, input) =>
    ec.resource.script('component://mr-mantle/script/PassAuthority.js').handle({
        operation,
        siteId: SITE,
        input,
        clientId: lib().ids.client,
        clientVerified: true,
    })
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Review Store',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
            requireInventory: 'N',
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
        setProperty('pass_client_' + l.ids.client + '_sites', SITE)
        l.run('create#mantle.product.Product', {
            productId: ids.mug,
            productName: 'Spec review mug',
            productTypeEnumId: 'PtAsset',
            ownerPartyId: l.ids.org,
        })
        l.run('create#mantle.product.store.ProductStoreProduct', {
            productStoreId: ids.store,
            productId: ids.mug,
            fromDate: 0,
        })
        l.run('create#mantle.party.Party', {
            partyId: ids.buyer,
            partyTypeEnumId: 'PtyPerson',
        })
        l.run('create#mantle.party.Person', {
            partyId: ids.buyer,
            firstName: 'Petra',
            lastName: 'Photo',
        })
        l.run('create#moqui.security.UserAccount', {
            userId: ids.buyer,
            username: ids.buyer,
            partyId: ids.buyer,
            emailAddress: 'petra@psrev.example.test',
            currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
            passwordHashType: 'SHA',
            timeZone: 'UTC',
        })
        l.run('create#moqui.security.public.VerifiedAddress', {
            userId: ids.buyer,
            emailAddress: 'petra@psrev.example.test',
            verifiedAt: ec.user.nowTimestamp,
        })
        // the buyer's completed order of the mug (written as records: the order's rules are Mantle's)
        const orderId = l.run('create#mantle.order.OrderHeader', {
            productStoreId: ids.store,
            statusId: 'OrderOpen',
            currencyUomId: 'USD',
            placedDate: ec.user.nowTimestamp,
        }).orderId
        l.run('create#mantle.order.OrderPart', {
            orderId,
            orderPartSeqId: '01',
            customerPartyId: ids.buyer,
            vendorPartyId: l.ids.org,
            statusId: 'OrderOpen',
        })
        l.run('create#mantle.order.OrderItem', {
            orderId,
            orderItemSeqId: '01',
            orderPartSeqId: '01',
            itemTypeEnumId: 'ItemProduct',
            productId: ids.mug,
            quantity: 1,
            unitAmount: '9.00',
        })
        const was = ec.artifactExecution.disableAuthz()
        try {
            for (const entity of [
                'mantle.order.OrderHeader',
                'mantle.order.OrderPart',
            ])
                for (const row of ec.entity
                    .find(entity)
                    .condition({ orderId })
                    .list()) {
                    row.statusId = 'OrderCompleted'
                    row.update()
                }
        } finally {
            if (!was) ec.artifactExecution.enableAuthz()
        }
        state.orderId = orderId
    },
    cleanupSpec() {
        login('john.doe')
    },
})
feature(
    "a buyer's review with a scanned photo is public once approved, locally and remotely, its photo served by digest only then",
    {
        when() {
            login(ids.buyer)
            let submitted, pendingPhoto
            try {
                const review = {
                    siteId: SITE,
                    productId: ids.mug,
                    rating: '5',
                    body: 'Keeps the tea hot.',
                    displayChoice: 'name',
                }
                const written = lib().facade('submitProductReview', review)
                // the photo as the Review page's next call adds it: a FileItem keeps its methods only in process, so the
                // authority's module takes it as the service would
                submitted = {
                    result: ec.resource
                        .script(
                            'component://mr-mantle/service/mantle/product/StoreReviews.js',
                        )
                        .execute(
                            'submitReview',
                            Object.assign({}, review, {
                                productReviewId: written.result.review.id,
                                expectedRevision:
                                    written.result.review.revision,
                                file: {
                                    name: 'mug.png',
                                    size: 68,
                                    contentType: 'image/png',
                                    write(location) {
                                        ec.resource
                                            .getLocationReference(location)
                                            .putBytes(
                                                StringUtilities.base64Decode(
                                                    PNG,
                                                ),
                                            )
                                    },
                                },
                            }),
                        ),
                }
            } finally {
                login('john.doe')
            }
            const digest = ec.entity
                .find('mantle.product.ProductReviewImage')
                .condition({ productReviewId: submitted.result.review.id })
                .disableAuthz()
                .one()?.digest
            pendingPhoto = authority('getShopReviewImage', {
                reviewImage: digest,
            })
            lib().run(
                'mantle.product.StoreMerchandisingServices.moderate#Review',
                {
                    decision: 'approve',
                    productReviewId: submitted.result.review.id,
                    expectedLastUpdatedStamp: ec.entity
                        .find('mantle.product.ProductReview')
                        .condition({ productReviewId: submitted.result.review.id })
                        .disableAuthz()
                        .one().lastUpdatedStamp,
                },
            )
            lib().run(
                'mantle.product.StoreMerchandisingServices.reply#Review',
                {
                    productReviewId: submitted.result.review.id,
                    replyText: 'Glad it keeps you warm.',
                    expectedLastUpdatedStamp: ec.entity
                        .find('mantle.product.ProductReview')
                        .condition({ productReviewId: submitted.result.review.id })
                        .disableAuthz()
                        .one().lastUpdatedStamp,
                },
            )
            logout()
            try {
                const local = lib().facade('getProductReviews', {
                    siteId: SITE,
                    productId: ids.mug,
                })
                const remote = lib().remote('getProductReviews', {
                    siteId: SITE,
                    productId: ids.mug,
                })
                const photo = authority('getShopReviewImage', {
                    reviewImage: digest,
                })
                const product = renderWith(
                    '/shop/products/' + ids.mug + '/spec-review-mug',
                    'Shop/Products/ProductDetail',
                    {
                        productId: ids.mug,
                        productSlug: 'spec-review-mug',
                    },
                )
                return {
                    submitted,
                    digest,
                    pendingPhoto,
                    local,
                    remote,
                    photo,
                    product,
                }
            } finally {
                login('john.doe')
            }
        },
        then(r) {
            r.submitted.result.review.statusText == 'Waiting for approval'
            r.submitted.result.imageRefused == null
            r.submitted.result.review.imageCount == 1
            r.digest.length == 64
            r.pendingPhoto.error.code == 'NotFound'
            r.local.result.summary.count == 1
            r.remote.result.summary.count == 1
            r.remote.result.reviews[0].authorLabel == 'Petra P.'
            r.remote.result.reviews[0].reply.text == 'Glad it keeps you warm.'
            r.remote.result.reviews[0].images[0].url ==
                '/shop/media?reviewImage=' + r.digest
            r.photo.download != null
            r.product.errors.length == 0
            r.product.html.includes('id="ProductReviews"')
            r.product.html.includes('Keeps the tea hot.')
            r.product.html.includes('Reply from Shop Spec Review Store')
            r.product.html.includes('reviewImage=' + r.digest)
            !r.product.html.includes(ids.buyer)
            !r.product.html.includes('psrev.example.test')
        },
    },
)
feature(
    "the Review page offers the buyer the change form; the review operations' routes are a POST and a GET download",
    {
        when() {
            login(ids.buyer)
            try {
                const page = renderWith('/shop/Review', 'Shop/Review', {
                    productId: ids.mug,
                })
                const routes = ec.resource.script(
                    'component://mr-pass/service/pass/Routes.js',
                )
                return { page, routes }
            } finally {
                login('john.doe')
            }
        },
        then({ page, routes }) {
            page.errors.length == 0
            page.html.includes('id="SubmitReview"')
            page.html.includes('Change your review')
            page.html.includes('enctype="multipart/form-data"')
            page.html.includes('Keeps the tea hot.')
            routes.find((route) => route[2] === 'submitProductReview')[0] ==
                'POST'
            routes.find((route) => route[2] === 'getShopReviewImage')[0] ==
                'GET'
        },
    },
)
