// Commerce P12's "usable when" (mr-boss impl-commerce P12; design-commerce §12.2 scenarios 11 and 14), on ShopFixtures'
// ZIZI_DIGITAL (BOSS_COM_DIGITAL, its demo monthly membership offer) through a page's calls and Commerce's staff services:
// a verified buyer subscribes and a subscription operator of Ziziwork Services finds the contract in Subscriptions; a
// declined renewal is retried by the operator, which resumes the failed occurrence and makes one charge (a double submit
// answers the first result); the operator cancels the renewal, the paid term staying; and a refund of one paid-access
// item revokes that term's source grant only. Subscriptions, SubscriptionDetail and Customer360 open for the operator. It
// lives here beside ShopSubscriptionScenarios (whose offer and decline gateway it reuses), after it by name; it needs mr-boss
// (Commerce's screens and groups), and without it every feature is ignored, so PASS stands alone. The rules are Mantle's
// ShopSubscriptions and mr-boss CommerceSubscriptions'.
// Run: ./moq accept mr-pass --spec ShopFixtures,ShopSubscriptionsInCommerce
const boss = ec.resource
    .getLocationReference('component://mr-boss/screen/Commerce.xml')
    .getExists()
const ignore = boss ? undefined : 'needs mr-boss (Commerce)'
const lib = boss
    ? ec.resource.script('component://mr-boss/test/Commerce/CommerceSpecLib.js')
    : {}
const shop = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'ZIZI_DIGITAL'
const STORE = 'BOSS_COM_DIGITAL'
const PRODUCT = 'BOSS_COM_PAID_MONTH'
const BUYER = 'PASS_ACC_SUBSCRIBER2'
const OPERATOR = 'PASS_ACC_SUBOP'
const SUB = 'mantle.product.subscription.'
const R = 'mantle.product.ShopSubscriptionServices.'
const one = (entity, fields) =>
    ec.entity.find(entity).condition(fields).useCache(false).disableAuthz().one()
const list = (entity, fields) =>
    Array.from(
        ec.entity.find(entity).condition(fields).useCache(false).disableAuthz().list(),
    )
const sys = (name, parameters) => shop().run(name, parameters)
const state = {}
// a page's call as the buyer
function call(operation, input) {
    login(BUYER)
    try {
        return shop().facade(operation, { siteId: SITE, ...input })
    } finally {
        login('john.doe')
    }
}
// a staff call as the operator: its result, or {error}
function staff(service, parameters) {
    return lib.asUser(
        OPERATOR,
        () => {
            ec.message.pushErrors()
            try {
                const out =
                    ec.service
                        .sync()
                        .name(R + service)
                        .parameters(parameters)
                        .requireNewTransaction(true)
                        .call() || {}
                return ec.message.hasError()
                    ? { error: ec.message.getErrorsString() }
                    : out
            } catch (error) {
                return { error: String(error.message) }
            } finally {
                ec.message.clearErrors()
                ec.message.popErrors()
            }
        },
        false,
    )
}
const opened = (rendered) =>
    rendered.status === 200 && rendered.errors.length === 0
const contract = () =>
    one(SUB + 'StoreRecurringContract', { contractId: state.contractId })
const grants = () =>
    list('mantle.public.PublicAccessGrant', { partyId: BUYER, siteId: SITE })
const liveGrants = () =>
    grants().filter((g) => g.sourceType == 'subscription' && !g.revokedAt)
spec({
    stepwise: true,
    setupSpec() {
        if (!boss) return
        login('john.doe')
        const email = 'subscriber2@zizi.example.test'
        if (!one('mantle.party.Party', { partyId: BUYER })) {
            sys('create#mantle.party.Party', { partyId: BUYER, partyTypeEnumId: 'PtyPerson' })
            sys('create#mantle.party.Person', { partyId: BUYER, firstName: 'Robin', lastName: 'Renewer' })
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
        }
        // Ziziwork Services' subscription operator (the demo one works Ziziwork Retail)
        if (!one('mantle.party.Party', { partyId: OPERATOR })) {
            sys('create#mantle.party.Party', { partyId: OPERATOR, partyTypeEnumId: 'PtyPerson' })
            sys('create#mantle.party.Person', { partyId: OPERATOR, firstName: 'Sam', lastName: 'Subscriptions' })
            sys('create#mantle.party.PartyRelationship', {
                partyRelationshipId: OPERATOR,
                relationshipTypeEnumId: 'PrtAgent',
                fromPartyId: OPERATOR,
                toPartyId: 'ORG_ZIZI_SERVICES',
                toRoleTypeId: 'OrgInternal',
                fromDate: 0,
            })
            sys('create#moqui.security.UserAccount', {
                userId: OPERATOR,
                username: OPERATOR,
                partyId: OPERATOR,
                currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
                passwordHashType: 'SHA',
                timeZone: 'UTC',
            })
            for (const userGroupId of ['BOSS_USERS', 'BOSS_COMMERCE', 'BOSS_COMMERCE_SUBSCRIPTION_OPERATOR'])
                sys('create#moqui.security.UserGroupMember', { userId: OPERATOR, userGroupId, fromDate: 0 })
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
    cleanupSpec() {
        login('john.doe')
    },
})
feature('a verified buyer subscribes; the subscription operator finds the contract and its screens open', {
    ignore,
    when() {
        const offer = call('getSubscriptions', {}).result.offers.find((row) => row.name === 'Monthly membership')
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
        state.contractId = list(SUB + 'StoreRecurringContract', { customerPartyId: BUYER, productStoreId: STORE })[0]?.contractId
        state.firstOrderId = row.orderId
        const listed = staff('find#StoreSubscriptions', { productStoreId: STORE }).subscriptions || []
        const pages = lib.asUser(OPERATOR, () => ({
            list: lib.page('Customers/Subscriptions', { productStoreId: STORE }),
            detail: lib.page('Customers/SubscriptionDetail', { contractId: state.contractId }),
            customer: lib.page('Customers/Customer360', { customerPartyId: BUYER }),
        }))
        return { listed, pages }
    },
    then({ listed, pages }) {
        listed.some((row) => row.contractId == state.contractId && row.hasAccess && row.billingState == 'ScsActive')
        opened(pages.list) && pages.list.output.includes(state.contractId)
        opened(pages.detail) && pages.detail.output.includes('Monthly membership')
        opened(pages.customer) && pages.customer.output.includes('Subscriptions')
    },
})
feature("a declined renewal retried by the operator resumes the failed occurrence with one charge", {
    ignore,
    when() {
        const before = contract()
        const gateway = one('mantle.account.method.PaymentMethod', { paymentMethodId: before.paymentMethodId }).paymentGatewayConfigId
        sys('update#mantle.account.method.PaymentMethod', { paymentMethodId: before.paymentMethodId, paymentGatewayConfigId: 'PASS_ACC_DECLINE' })
        sys('update#' + SUB + 'StoreRecurringContract', {
            contractId: state.contractId,
            nextRenewalDate: new Date(Number(ec.user.nowTimestamp) - 60000),
        })
        // the hourly job starts the renewal; the card declines
        sys(R + 'run#Renewals', {})
        const failed = list(SUB + 'StoreRenewalOccurrence', { contractId: state.contractId })[0]
        sys('update#mantle.account.method.PaymentMethod', { paymentMethodId: before.paymentMethodId, paymentGatewayConfigId: gateway })
        const key = 'accept-retry-' + state.contractId
        const retried = staff('retry#Renewal', { contractId: state.contractId, operationKey: key, reason: 'Customer fixed the card' })
        assert(ec.factory.waitWorkerPoolEmpty(50), 'Worker pool did not drain')
        const again = staff('retry#Renewal', { contractId: state.contractId, operationKey: key, reason: 'Customer fixed the card' })
        state.renewalOrderId = failed.orderId
        return {
            failed,
            retried,
            again,
            occurrences: list(SUB + 'StoreRenewalOccurrence', { contractId: state.contractId }),
            payments: list('mantle.account.payment.Payment', { orderId: failed.orderId }),
            live: liveGrants(),
        }
    },
    then({ failed, retried, again, occurrences, payments, live }) {
        failed.stateEnumId == 'SrsRetry'
        retried.error == null && retried.occurrenceId == failed.occurrenceId
        again.alreadyApplied == true
        occurrences.length == 1 && occurrences[0].stateEnumId == 'SrsActivated'
        payments.length == 2
        payments.filter((p) => ['PmntAuthorized', 'PmntDelivered'].includes(p.statusId)).length == 1
        live.length == 2
    },
})
feature("the operator cancels the contract's renewal and the paid term stays", {
    ignore,
    when() {
        const before = contract()
        const cancelled = staff('cancel#RecurringContract', {
            contractId: state.contractId,
            expectedRevision: String(before.revision),
            reason: 'Asked by email',
        })
        return { before, cancelled, after: contract(), live: liveGrants() }
    },
    then({ before, cancelled, after, live }) {
        cancelled.subscription.billingState == 'ScsCancelled'
        cancelled.subscription.hasAccess == true
        Number(after.cancelAtDate) == Number(before.paidThroughDate)
        after.nextRenewalDate == null
        live.length == 2
    },
})
feature('a refund of one paid-access item revokes that source grant only', {
    ignore,
    when() {
        const before = contract()
        const line = list('mantle.order.OrderItem', { orderId: state.firstOrderId }).find((item) => item.productId === PRODUCT)
        sys('mantle.product.ShopFulfillmentServices.reconcile#RefundedItem', {
            orderId: state.firstOrderId,
            orderItemSeqId: line.orderItemSeqId,
            reasonEnumId: 'SdrRefunded',
        })
        const firstSub = list(SUB + 'Subscription', { orderId: state.firstOrderId })[0]
        const renewalSub = list(SUB + 'Subscription', { orderId: state.renewalOrderId })[0]
        return {
            before,
            after: contract(),
            first: grants().find((g) => g.sourceId == firstSub.subscriptionId),
            renewal: grants().find((g) => g.sourceId == renewalSub.subscriptionId),
            detail: staff('get#StoreSubscription', { contractId: state.contractId }),
        }
    },
    then({ before, after, first, renewal, detail }) {
        first.revokedAt != null
        renewal.revokedAt == null
        // an earlier term refunded: the paid-through stands, the renewed term still to come
        Number(after.paidThroughDate) == Number(before.paidThroughDate)
        after.stateEnumId == 'ScsCancelled'
        detail.access.some((row) => row.stateText.startsWith('Revoked'))
        detail.access.some((row) => row.stateText == 'Starts later')
    },
})
