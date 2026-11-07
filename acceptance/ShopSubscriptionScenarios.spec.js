// Shop P7's "usable when" on the server (impl-shop P7; design-shop §18.1 "Prepaid/recurring purchase", "Renewal
// race/failure/cancellation", "Multiple access sources"), on ShopFixtures' ZIZI_DIGITAL (BOSS_COM_DIGITAL, its demo monthly
// membership offer) through a page's calls: a verified buyer, a member of the site, subscribes with the renewal consent and
// gets the paid access, the members' Forum category the demo binds it to (Commerce P15, impl-shop F107), which they can then
// read, and the site's subscription address (the Forum's "Manage your subscription") is Shop's Subscriptions page;
// the renewal charges once under a retried job; a declined renewal sends one notice, extends nothing and leaves no invoice
// for Dunning; cancelling keeps access to the paid term; refunding the first term leaves a manual grant.
// Run: ./moq accept mr-pass --spec ShopSubscriptionScenarios (with ShopFixtures, its dependsOn)
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'ZIZI_DIGITAL'
const STORE = 'BOSS_COM_DIGITAL'
const PRODUCT = 'BOSS_COM_PAID_MONTH'
const BUYER = 'PASS_ACC_SUBSCRIBER'
const SUB = 'mantle.product.subscription.'
const R = 'mantle.product.ShopSubscriptionServices.'
const one = (entity, fields) =>
    ec.entity.find(entity).condition(fields).disableAuthz().one()
const list = (entity, fields) =>
    Array.from(ec.entity.find(entity).condition(fields).disableAuthz().list())
const sys = (name, parameters) => lib().run(name, parameters)
const state = {}
function call(operation, input) {
    login(BUYER)
    try {
        return lib().facade(operation, { siteId: SITE, ...input })
    } finally {
        login('john.doe')
    }
}
const contract = () => one(SUB + 'StoreRecurringContract', { contractId: state.contractId })
const dueNow = () =>
    sys('update#' + SUB + 'StoreRecurringContract', {
        contractId: state.contractId,
        nextRenewalDate: new Date(Number(ec.user.nowTimestamp) - 60000),
    })
const grants = () =>
    list('mantle.public.PublicAccessGrant', { partyId: BUYER, siteId: SITE })
// the demo's members' category (mr-boss Demo.js), which the monthly membership opens
const members = () => one('mantle.forum.ForumCategory', { siteId: SITE, slug: 'members' })
// the category as the buyer reads it through the Forum: its projection, or the refusal
function readMembers() {
    login(BUYER)
    ec.message.pushErrors()
    try {
        const out = ec.service
            .sync()
            .name('mantle.forum.ForumServices.get#Category')
            .parameters({ input: { siteId: SITE, contactListId: members()?.contactListId } })
            .call()
        return ec.message.hasError() ? { error: ec.message.getErrorsString() } : { category: out.result.category }
    } catch (error) {
        return { error: String(error.message || error) }
    } finally {
        ec.message.clearErrors()
        ec.message.popErrors()
        login('john.doe')
    }
}
spec({
    stepwise: true,
    dependsOn: ['ShopFixtures'],
    setupSpec() {
        login('john.doe')
        const email = 'subscriber@zizi.example.test'
        if (!one('mantle.party.Party', { partyId: BUYER })) {
            sys('create#mantle.party.Party', { partyId: BUYER, partyTypeEnumId: 'PtyPerson' })
            sys('create#mantle.party.Person', { partyId: BUYER, firstName: 'Sasha', lastName: 'Subscriber' })
            sys('create#mantle.party.PartyRole', { partyId: BUYER, roleTypeId: 'Customer' })
            sys('create#moqui.security.UserAccount', {
                userId: BUYER,
                username: BUYER,
                partyId: BUYER,
                emailAddress: email,
                currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
                passwordHashType: 'SHA',
                timeZone: 'UTC',
            })
            sys('create#moqui.security.public.VerifiedAddress', {
                userId: BUYER,
                emailAddress: email,
                verifiedAt: ec.user.nowTimestamp,
            })
            // a member of the site, as signing up there makes them: the paid category opens to its members with a grant
            sys('create#mantle.public.PublicSiteParty', {
                siteId: SITE,
                partyId: BUYER,
                state: 'active',
                role: 'member',
                joinedAt: ec.user.nowTimestamp,
                fromDate: ec.user.nowTimestamp,
                revision: 1,
            })
        }
        // the renewals here come minutes after the purchase, not a month later
        sys('create#mantle.product.store.ProductStoreSetting', {
            productStoreId: STORE,
            settingTypeEnumId: 'PsstOrdApproveSimilar',
            fromDate: ec.user.nowTimestamp,
            settingValue: 'false',
        })
        if (!one('mantle.account.method.PaymentGatewayConfig', { paymentGatewayConfigId: 'PASS_ACC_DECLINE' }))
            sys('create#mantle.account.method.PaymentGatewayConfig', {
                paymentGatewayConfigId: 'PASS_ACC_DECLINE',
                paymentGatewayTypeEnumId: 'PgtTest',
                description: 'A card the provider now declines',
                authorizeServiceName: 'mantle.account.PaymentTestServices.alwaysDecline#PaymentAuthorization',
            })
    },
    cleanup() {
        login('john.doe')
    },
})
feature('a verified buyer subscribes with consent and gets the members\' category; the site manages it in Shop', {
    when() {
        const before = readMembers()
        const offers = call('getSubscriptions', {}).result.offers
        const offer = offers.find((row) => row.name === 'Monthly membership')
        call('beginSubscriptionPurchase', { offerId: offer.offerId })
        call('selectPayment', { paymentOptionId: 'PiCreditCard' })
        const view = call('getCheckout', {}).result
        const submitted = call('submitCheckout', {
            expectedRevision: view.checkout.revision,
            recurringConsent: 'true',
        }).result
        const row = one('mantle.order.StoreCheckout', { returnReference: submitted.checkout.reference })
        sys('update#mantle.account.payment.PortalPaymentAttempt', { paymentId: row.paymentId, lastCheckDate: null })
        call('getCheckoutPaymentResult', { reference: submitted.checkout.reference, key: submitted.returnKey })
        assert(ec.factory.waitWorkerPoolEmpty(50), 'Worker pool did not drain')
        const made = list(SUB + 'StoreRecurringContract', { customerPartyId: BUYER, productStoreId: STORE })
        state.contractId = made[0]?.contractId
        state.firstOrderId = row.orderId
        const site = one('mantle.public.PublicSite', { siteId: SITE })
        const page = lib().render(SITE, 'digital.zizi.localhost', '/shop/Subscriptions', 'Shop/Subscriptions/SubscriptionList')
        return { before, view, made, site, grants: grants(), page, after: readMembers(), category: members() }
    },
    then({ before, view, made, site, grants, page, after, category }) {
        view.checkout.recurring.consentRequired == true
        made.length == 1
        made[0].stateEnumId == 'ScsActive' && made[0].consentDate != null && made[0].baseOrderId != null
        grants.filter((g) => g.sourceType == 'subscription' && !g.revokedAt).length == 1
        // the grant is the members' category's, which the buyer now reads (and could not before)
        grants.find((g) => g.sourceType == 'subscription').targetType == 'category'
        grants.find((g) => g.sourceType == 'subscription').targetId == category.contactListId
        before.error != null
        after.category.contactListId == category.contactListId
        site.subscriptionUrl == 'https://digital.zizi.localhost/shop/Subscriptions'
        page.errors.length == 0
    },
})
feature('the renewal charges once under a retried job', {
    when() {
        dueNow()
        const base = contract().baseOrderId
        ec.service.async().name(R + 'dispatch#Renewal').parameters({ baseOrderId: base }).call()
        sys('mantle.order.OrderServices.create#RecurringOrders', {})
        assert(ec.factory.waitWorkerPoolEmpty(100), 'Worker pool did not drain')
        sys(R + 'dispatch#Renewal', { baseOrderId: base })
        const occurrences = list(SUB + 'StoreRenewalOccurrence', { contractId: state.contractId })
        return {
            occurrences,
            payments: list('mantle.account.payment.Payment', { orderId: occurrences[0]?.orderId }),
            grants: grants(),
        }
    },
    then({ occurrences, payments, grants }) {
        occurrences.length == 1
        occurrences[0].stateEnumId == 'SrsActivated'
        payments.length == 1
        grants.filter((g) => g.sourceType == 'subscription' && !g.revokedAt).length == 2
    },
})
feature('a declined renewal sends one notice, extends nothing and leaves nothing for Dunning', {
    when() {
        const before = contract()
        state.methodGateway = one('mantle.account.method.PaymentMethod', { paymentMethodId: before.paymentMethodId }).paymentGatewayConfigId
        sys('update#mantle.account.method.PaymentMethod', { paymentMethodId: before.paymentMethodId, paymentGatewayConfigId: 'PASS_ACC_DECLINE' })
        dueNow()
        sys(R + 'dispatch#Renewal', { baseOrderId: before.baseOrderId })
        sys(R + 'run#Renewals', {})
        const declined = list(SUB + 'StoreRenewalOccurrence', { contractId: state.contractId }).find((row) => row.stateEnumId !== 'SrsActivated')
        const payment = list('mantle.account.payment.Payment', { orderId: declined.orderId })[0]
        sys('update#mantle.account.method.PaymentMethod', { paymentMethodId: before.paymentMethodId, paymentGatewayConfigId: state.methodGateway })
        return {
            before,
            declined,
            after: contract(),
            notices: list('mantle.party.MessageDelivery', { eventKey: 'shopRenewal:retry:' + payment.paymentId }),
            invoices: list('mantle.order.OrderItemBilling', { orderId: declined.orderId }),
        }
    },
    then({ before, declined, after, notices, invoices }) {
        declined.stateEnumId == 'SrsRetry'
        notices.length == 1
        Number(after.paidThroughDate) == Number(before.paidThroughDate)
        invoices.length == 0
    },
})
feature('cancelling keeps access to the paid term; refunding the first term leaves a manual grant', {
    when() {
        const before = contract()
        const cancelled = call('cancelSubscription', { contractId: state.contractId, expectedRevision: before.revision })
        sys('create#mantle.public.PublicAccessGrant', {
            grantId: 'PASS_ACC_MANUAL_GRANT',
            partyId: BUYER,
            siteId: SITE,
            targetType: 'category',
            targetId: members().contactListId,
            sourceType: 'manual',
            sourceId: 'PASS_ACC_STAFF',
            fromDate: ec.user.nowTimestamp,
            createdAt: ec.user.nowTimestamp,
            revision: 1,
        })
        const line = list('mantle.order.OrderItem', { orderId: state.firstOrderId }).find((item) => item.productId === PRODUCT)
        sys('mantle.product.ShopFulfillmentServices.reconcile#RefundedItem', {
            orderId: state.firstOrderId,
            orderItemSeqId: line.orderItemSeqId,
            reasonEnumId: 'SdrRefunded',
        })
        const firstSub = list(SUB + 'Subscription', { orderId: state.firstOrderId })[0]
        return { cancelled, after: contract(), grants: grants(), firstSub }
    },
    then({ cancelled, after, grants, firstSub }) {
        cancelled.result.subscription.billingState == 'ScsCancelled'
        after.cancelAtDate != null
        grants.find((g) => g.grantId == 'PASS_ACC_MANUAL_GRANT').revokedAt == null
        grants.find((g) => g.sourceId == firstSub.subscriptionId).revokedAt != null
        grants.some((g) => g.sourceType == 'subscription' && !g.revokedAt)
    },
})
