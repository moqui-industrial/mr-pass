/* The Shop specs' shared records and helpers (impl-shop P1): an internal organization with a store, an outside
 * organization's store, a site to mount Shop on, and calls the way a page makes them: through the facade (local), and as a
 * remote frontend's (Mantle's PassAuthority, the authority side of both transports, answered by Transport.js as a remote
 * call is). Nothing here calls BOSS; the records are the spec's own. CC0 plus patent grant. */
const ids = {
    org: 'PASS_SHOP_ORG',
    store: 'PASS_SHOP_STORE',
    outsideOrg: 'PASS_SHOP_OUTSIDE',
    outsideStore: 'PASS_SHOP_OUTSIDE_STORE',
    client: 'passhopspec',
}
const run = (name, parameters) => {
    const out =
        ec.service
            .sync()
            .name(name)
            .parameters(parameters)
            .disableAuthz()
            .call() || {}
    if (ec.message.hasError()) throw new Error(ec.message.getErrorsString())
    return out
}
function organization(partyId, name, internal) {
    if (
        ec.entity
            .find('mantle.party.Party')
            .condition({ partyId })
            .disableAuthz()
            .one()
    )
        return
    run('create#mantle.party.Party', {
        partyId,
        partyTypeEnumId: 'PtyOrganization',
    })
    run('create#mantle.party.Organization', { partyId, organizationName: name })
    if (internal)
        run('create#mantle.party.PartyRole', {
            partyId,
            roleTypeId: 'OrgInternal',
        })
}
function store(productStoreId, storeName, organizationPartyId) {
    if (
        ec.entity
            .find('mantle.product.store.ProductStore')
            .condition({ productStoreId })
            .disableAuthz()
            .one()
    )
        return
    run('create#mantle.product.store.ProductStore', {
        productStoreId,
        storeName,
        organizationPartyId,
        defaultCurrencyUomId: 'USD',
        defaultLocale: 'en_US',
    })
}
/* The organizations and stores, made once. */
function records() {
    organization(ids.org, 'Shop Spec Retail', true)
    organization(ids.outsideOrg, 'Shop Spec Outside', false)
    store(ids.store, 'Shop Spec Store', ids.org)
    store(ids.outsideStore, 'Outside Store', ids.outsideOrg)
}
/* A site with its canonical host, its state and theme as given, and no mounts. */
function site(siteId, hostname, fields) {
    run('create#mantle.public.PublicSite', {
        siteId,
        name: 'Shop spec ' + siteId,
        state: 'disabled',
        registrationMode: 'closed',
        locale: 'en',
        timeZone: 'UTC',
        policyRevision: 1,
        generation: 1,
        ...(fields || {}),
    })
    run('create#mantle.public.PublicSiteHost', {
        hostname,
        siteId,
        canonical: 'Y',
    })
}
const siteRow = (siteId) =>
    ec.entity
        .find('mantle.public.PublicSite')
        .condition({ siteId })
        .disableAuthz()
        .one()
function setState(siteId, state) {
    run('update#mantle.public.PublicSite', { siteId, state })
}
/* Enable or disable a site's Shop mount. */
function setShopEnabled(siteId, enabled) {
    const mount = ec.entity
        .find('mantle.public.PublicSiteApp')
        .condition({ siteId, app: 'shop' })
        .disableAuthz()
        .one()
    run('update#mantle.public.PublicSiteApp', {
        siteId,
        appMountId: mount.appMountId,
        enabled: enabled ? 'Y' : 'N',
    })
}
/* What a page's call answers: {result} or {kind, reason, message, fieldErrors} (Shared/Portal.js attempt). */
function facade(operation, input) {
    const out = ec.resource
        .script('component://mr-pass/screen/Shared/Portal.js')
        .attempt(operation, input)
    return out.error ? out.error : { result: out.result }
}
/* The operator's mount save (store#Mounts), as the Sites page makes it: {result} or the refusal. */
function mounts(siteId, list, hosts) {
    return facade('storeMounts', {
        siteId,
        expectedRevision: Number(siteRow(siteId).policyRevision),
        mounts: list,
        ...(hosts ? { hosts } : {}),
    })
}
/* A remote frontend's call (the spec registers ids.client for its sites): the authority's answer to a registered, verified client (PassAuthority.handle, which the REST
 * servlet and the gRPC service both run), taken by Transport.js as a remote call's, then shown as a page shows a refusal. */
function remote(operation, input, extra) {
    const answer = ec.resource
        .script('component://mr-mantle/script/PassAuthority.js')
        .handle({
            operation,
            siteId: input.siteId,
            input: Object.fromEntries(
                Object.entries(input).filter(([k]) => k !== 'siteId'),
            ),
            clientId: ids.client,
            clientVerified: true,
            ...(extra || {}),
        })
    try {
        return {
            result: ec.resource
                .script('component://mr-pass/service/pass/Transport.js')
                .answered(answer, 'x'),
        }
    } catch (error) {
        const portal = ec.resource.script(
            'component://mr-pass/screen/Shared/Portal.js',
        )
        const { reason, field, text } = portal.refusal(error.message)
        const kind = error.moquiErrorKind
        const own = ['Unprocessable', 'Conflict'].includes(kind) && text
        return {
            kind,
            reason,
            envelope: answer.error,
            message: (reason && portal.reasons[reason]) || (own ? text : null),
            fieldErrors: field && own ? [{ field, reason, message: text }] : [],
        }
    }
}
/* One render of a page under Pass.xml for a site's host and request path: {html, errors}. */
function render(siteId, host, path, screenPath) {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            screenPath,
            { resolvedSiteId: siteId, publicHost: host, publicPath: path },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
/* The screen a request path resolves to on a site (pass.RouteServices.resolve#Route), or the refusal's kind. */
function route(siteId, hostname, path) {
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name('pass.RouteServices.resolve#Route')
            .parameters({ siteId, hostname, path })
            .call().screenPath
    } catch (error) {
        ec.message.clearErrors()
        return 'refused:' + (error.moquiErrorKind || 'Error')
    }
}
;({
    ids,
    run,
    records,
    site,
    siteRow,
    setState,
    setShopEnabled,
    facade,
    mounts,
    remote,
    render,
    route,
})
