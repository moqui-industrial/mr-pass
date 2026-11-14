// PASS Sales' quote fixtures (IronStone impl-sales P13) for the acceptance tests SalesQuoteScenarios, SalesQuoteFixtures and the
// walk SalesQuoteHttp: Mantle's quote issue fixtures (mr-mantle test/order/SalesQuoteIssueFixtures.js: organization A counting
// commercial changes only, its rep, account a with a mailed and an unmailed contact, a priced product), a site's Sales mount for
// A, a public account invited for account a (a contact grant, as redeeming Invite to Sales makes it), an issued quote and a bearer
// link of a known token. Nothing here is a production configuration. CC0 plus patent grant.
const fx = () => ec.resource.script("component://mr-mantle/test/order/SalesQuoteIssueFixtures.js")
const c = (name, parameters) => {
    const out = ec.service.sync().name(name).parameters(parameters).disableAuthz().call() || {}
    if (ec.message.hasError()) throw new Error(ec.message.getErrorsString())
    return out
}
/* Mantle's fixtures under a prefix, and an inviter of A (a manager holding SALES_CUSTOMER_INVITE). */
function setup(prefix) {
    const f = fx().setup(prefix)
    fx().system(() => {
        f.users.inviter = fx().addUser(
            f,
            "inviter",
            [f.orgA],
            ["SALES_VIEW", "SALES_TEAM_VIEW", "SALES_ACCOUNT_EDIT", "SALES_CUSTOMER_INVITE"]
        )
    })
    return f
}
/* A site's Sales mount for the organization (a new published site with its canonical host when it has none). */
function mount(siteId, organizationPartyId, hostname) {
    fx().system(() => {
        if (!ec.entity.find("mantle.public.PublicSite").condition({siteId}).disableAuthz().one()) {
            c("create#mantle.public.PublicSite", {
                siteId,
                name: "Sales " + siteId,
                state: "published",
                registrationMode: "invitation",
                locale: "en",
                timeZone: "UTC",
                policyRevision: 1,
                generation: 1
            })
            c("create#mantle.public.PublicSiteHost", {hostname, siteId, canonical: "Y"})
            c("create#mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "account",
                app: "account",
                pathPrefix: "/account",
                enabled: "Y"
            })
        }
        c("create#mantle.public.PublicSiteApp", {
            siteId,
            appMountId: "sales",
            app: "sales",
            pathPrefix: "/sales",
            enabled: "Y",
            targetId: organizationPartyId
        })
    })
}
/* A public account (password moqui) with its email verified; grantFor: the account it is a contact of on the organization's
 * sales app. */
function account(username, emailAddress, grantFor, organizationPartyId) {
    const partyId = username.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
    fx().system(() => {
        c("create#mantle.party.Party", {partyId, partyTypeEnumId: "PtyPerson"})
        c("create#mantle.party.Person", {partyId, firstName: "Quote", lastName: username})
        c("create#moqui.security.UserAccount", {
            userId: partyId,
            username,
            partyId,
            emailAddress,
            currentPassword: "16ac58bbfa332c1c55bd98b53e60720bfa90d394",
            passwordHashType: "SHA"
        })
        c("create#moqui.security.public.VerifiedAddress", {userId: partyId, emailAddress, verifiedAt: ec.user.nowTimestamp})
        if (grantFor)
            c("create#mantle.party.ExternalAccessContact", {
                partyId,
                outsidePartyId: grantFor,
                organizationPartyId,
                app: "sales",
                fromDate: ec.user.nowTimestamp
            })
    })
    return partyId
}
/* A quote of A for a customer with quantity of the priced product, proposed and sent (send#Quote: its PDF and issue). */
function issued(f, customerPartyId, contactPartyId, quantity = 2) {
    const quoteService = fx().quoteService
    const orderId = fx().as(f.users.rep, quoteService + "create#Quote", {
        organizationPartyId: f.orgA,
        customerPartyId,
        contactPartyId
    }).orderId
    fx().as(f.users.rep, quoteService + "store#QuoteLine", {
        orderId,
        orderRevision: fx().revision(orderId),
        productId: f.product,
        quantity
    })
    fx().as(f.users.rep, quoteService + "propose#Quote", {orderId, orderRevision: fx().revision(orderId)})
    const sent = fx().as(f.users.rep, "send#Quote", {
        orderId,
        orderRevision: fx().revision(orderId),
        operationKey: fx().key("send")
    })
    fx().attempt(sent.issueId)
    return {orderId, issueId: sent.issueId, revision: fx().revision(orderId)}
}
/* A bearer link of a known token to a quote's issue, as send#Quote's mail makes one (QuoteView and QuoteRespond at its revision,
 * ending with its validity). */
function link(quote, token) {
    fx().system(() => {
        const issue = ec.entity
            .find("mantle.sales.quote.SalesQuoteIssue")
            .condition({issueId: quote.issueId})
            .disableAuthz()
            .one()
        c("create#mantle.party.ExternalAccessCapability", {
            organizationPartyId: issue.organizationPartyId,
            partyId: issue.customerPartyId,
            recordType: "SalesOrder",
            recordId: quote.orderId,
            scopes: "QuoteView,QuoteRespond",
            tokenDigest: ec.user.singleUseCodeHash(token),
            issuerKind: "organization",
            recordRevision: quote.revision,
            fromDate: ec.user.nowTimestamp,
            thruDate: issue.validThruDate
        })
    })
    return token
}
/* The acceptance threshold of A's Sales defaults in USD (above it a link alone cannot accept). */
function threshold(f, amount) {
    fx().system(() => {
        const policy = Array.from(
            ec.entity
                .find("mantle.sales.policy.SalesPolicy")
                .condition("organizationPartyId", f.orgA)
                .orderBy("-fromDate")
                .disableAuthz()
                .list()
        )[0]
        c("create#mantle.sales.policy.SalesPolicyThreshold", {
            salesPolicyId: policy.salesPolicyId,
            currencyUomId: "USD",
            thresholdAmount: String(amount)
        })
    })
}
/* Another customer of A. */
function customer(f, partyId, name) {
    fx().system(() => {
        c("create#mantle.party.Party", {partyId, partyTypeEnumId: "PtyOrganization", ownerPartyId: f.orgA})
        c("create#mantle.party.Organization", {partyId, organizationName: name})
        c("create#mantle.party.PartyRole", {partyId, roleTypeId: "Customer"})
    })
    return partyId
}
;({fx, setup, mount, account, issued, link, threshold, customer})
