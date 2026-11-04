// Purchasing's Supplier app pages (impl-purchasing P16; design-purchasing §13): SupplierHome, QuoteResponse and
// OrderAcknowledgement rendered once each for their links, with no competitor, internal request or internal navigation; a
// purchase order's link of an earlier revision says SupersededRevision and shows nothing of the order; a bad link shows
// nothing; and Purchasing's operations are registered alike in PASS and the authority. Mantle's SupplierPortal spec covers
// the services' rules; the acceptance walks (SupplierPortalHttp, RemoteHttp) post through the pages.
const fixtures = () =>
    ec.resource.script('component://mr-pass/test/Supplier/SupplierFixtures.js')
const siteId = 'PASS_SUPPLIER_PAGES',
    org = 'PASS_SUPPLIER_PAGES_ORG',
    supplier = 'PASS_SUPPLIER_PAGES_SUP'
let docs
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            path,
            {
                resolvedSiteId: siteId,
                publicHost: 'suppliers.example.test',
                publicPath: '/' + path.toLowerCase(),
                ...parameters,
            },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const c = (name, parameters) =>
            ec.service
                .sync()
                .name(name)
                .parameters(parameters)
                .disableAuthz()
                .call()
        for (const [partyId, name, roleTypeId] of [
            [org, 'Pages Buying Co', 'OrgInternal'],
            [supplier, 'Pages Supplier', 'Supplier'],
        ]) {
            c('create#mantle.party.Party', {
                partyId,
                partyTypeEnumId: 'PtyOrganization',
            })
            c('create#mantle.party.Organization', {
                partyId,
                organizationName: name,
            })
            c('create#mantle.party.PartyRole', { partyId, roleTypeId })
        }
        c('create#mantle.public.PublicSite', {
            siteId,
            name: 'Supplier pages',
            state: 'published',
            registrationMode: 'invitation',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        c('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId: ec.user.userAccount.partyId,
            state: 'active',
            role: 'owner',
            revision: 1,
        })
        c('mantle.public.SiteServices.store#Mounts', {
            input: {
                siteId,
                expectedRevision: 1,
                mounts: [
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'supplier', pathPrefix: '/supplier', targetId: org },
                ],
                hosts: [
                    { hostname: 'suppliers.example.test', canonical: true },
                ],
            },
        })
        docs = fixtures().documents({
            prefix: 'PASS_SUPPLIER_PAGES',
            org,
            supplierPartyId: supplier,
        })
        ec.artifactExecution.enableAuthz()
    },
})
feature(
    "the Supplier app's pages show a link's own documents with no competitor, internal request or navigation",
    {
        when() {
            logout()
            const home = render('Supplier/SupplierHome', {
                token: docs.tokens.order,
            })
            const quote = render('Supplier/QuoteResponse', {
                token: docs.tokens.quote,
            })
            const order = render('Supplier/OrderAcknowledgement', {
                token: docs.tokens.order,
            })
            const superseded = render('Supplier/OrderAcknowledgement', {
                token: docs.tokens.superseded,
            })
            const bad = render('Supplier/QuoteResponse', {
                token: 'x'.repeat(48),
            })
            login('john.doe')
            return { home, quote, order, superseded, bad }
        },
        then({ home, quote, order, superseded, bad }) {
            home.errors.length === 0
            home.html.includes(
                'Purchase order ' + docs.orderId + ' · revision 2',
            )
            home.html.includes('Pages Buying Co')
            !home.html.includes(docs.quoteId)
            quote.errors.length === 0
            quote.html.includes('Request for quotation ' + docs.requestId)
            quote.html.includes('Powder-coated steel, 40 mm.')
            quote.html.includes('id="SupplierOffer"')
            quote.html.includes('name="price_01"')
            !quote.html.includes('Rival Brackets')
            !quote.html.includes(docs.rivalQuoteId)
            !quote.html.includes('Chatter')
            quote.html.includes('aria-label="Supplier"')
            order.errors.length === 0
            order.html.includes('Purchase order ' + docs.orderId)
            order.html.includes('Revision 2')
            order.html.includes('id="AcknowledgeOrder"')
            order.html.includes('Wall anchor')
            order.html.includes('/BillUpload?token=' + docs.tokens.order)
            superseded.html.includes('id="SupersededRevision"')
            superseded.html.includes('revision 1')
            !superseded.html.includes('Wall anchor')
            !superseded.html.includes('id="AcknowledgeOrder"')
            bad.html.includes('This page is not available')
            !bad.html.includes(docs.quoteId)
        },
    },
)
feature(
    'PASS and the authority register the Supplier operations alike, and their link writes need no session',
    {
        when() {
            const pass = ec.resource.script(
                'component://mr-pass/service/pass/Schema.js',
            )
            const mantle = ec.resource.script(
                'component://mr-mantle/service/mantle/forum/ForumSchema.js',
            )
            const passRoutes = ec.resource.script(
                'component://mr-pass/service/pass/Routes.js',
            )
            const mantleRoutes = ec.resource.script(
                'component://mr-mantle/script/PassRoutes.js',
            )
            const ops = [
                'getSupplierHome',
                'getQuoteInvitation',
                'saveQuoteResponse',
                'submitQuoteResponse',
                'getPublishedPurchaseOrder',
                'acknowledgePurchaseOrder',
                'reportDropShipDelivery',
            ]
            return {
                schema: ops.every(
                    (op) =>
                        pass[op] &&
                        JSON.stringify(pass[op]) === JSON.stringify(mantle[op]),
                ),
                routes: ops.every(
                    (op) =>
                        JSON.stringify(passRoutes.find((r) => r[2] === op)) ===
                        JSON.stringify(mantleRoutes.find((r) => r[2] === op)),
                ),
                posts: passRoutes.filter(
                    (r) => ops.includes(r[2]) && r[0] === 'POST',
                ).length,
            }
        },
        then({ schema, routes, posts }) {
            schema === true
            routes === true
            posts === 4
        },
    },
)
