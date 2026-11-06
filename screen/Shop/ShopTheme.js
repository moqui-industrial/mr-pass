/* Shop's live render path (impl-shop P2; design-shop §12.4, §12.7): the page view and active release from the
 * authority (getShopPage), the release's package verified file by file against its manifest's digests and kept by
 * release, then the composition adapter (ec.resource.theme.render) with PASS's trusted components. The same code runs
 * with a local Mantle and on a remote frontend, whose manifest and files come over its authority connection
 * (getShopThemeRelease and getShopThemeFiles, which the authority answers only to a registered frontend). A release
 * this frontend cannot verify, an engine or view API it does not have, or a page the adapter cannot render is the
 * built-in safe unavailable page, never a mix of files of two releases. Diagnostics go to the log, not to the page.
 * CC0 plus patent grant. */
const CACHE = 'pass.shop.themeReleases'
const VIEW_API_VERSIONS = [1]
const FILES_PER_CALL = 50
/* The content type of each asset type a release serves (by extension); anything else under assets/ is Not Found. */
const ASSET_TYPES = {
    css: 'text/css',
    svg: 'image/svg+xml',
    json: 'application/json',
}
/* The trusted components of the page kinds that place them (the authority's Themes.js requiredComponents): installed
 * PASS code, never theme source, each made from the page's view (escaped). P4: the purchase selection (a form posted to
 * the cart, its Show price the selection's quote) and the cart (the shopper's lines, codes and totals, given by the cart
 * page as context.cartComponent), each with its trusted Vue island (Shop/ShopCart.js); P5 replaces the checkout
 * placeholder. */
const cart = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const COMPONENTS = {
    'shop.productPurchase': {
        kinds: ['product'],
        html: (context, view) => cart().purchaseHtml(context, view),
    },
    'shop.cart': {
        kinds: ['cart'],
        html: (context) =>
            context.cartComponent
                ? context.cartComponent()
                : '<p class="shop-cart">Your cart is empty.</p>',
    },
    'shop.checkout': {
        kinds: ['checkout'],
        html: () => '<p class="shop-checkout">Checkout opens soon.</p>',
    },
    // P3: the search form, which a theme cannot make (no <form> in theme source)
    'shop.search': {
        kinds: ['search'],
        html: (context, view) => searchForm(view),
    },
}
const fail = (kind, message) => {
    const error = new Error(message)
    error.moquiErrorKind = kind
    throw error
}
/* An authority operation through the facade (local, or the configured remote authority). */
const facade = (operation, input) =>
    ec.service
        .sync()
        .throwOnError(true)
        .name('pass.Facade.call#Operation')
        .parameters({ operation, input })
        .call().result
const digestOf = (text) => ec.resource.digestText(String(text), 'sha256')
/* A release's package, verified: {manifest, files}. The manifest's text must have the digest the page named, and each
 * file the digest the manifest pins; the engine and view API must be this frontend's. Kept per site with its release and
 * digest, so a release is fetched once and a site's earlier releases do not stay in memory. `call` is the authority
 * call (the facade by default). */
function packageOf(siteId, release, call) {
    const ask = call || facade
    const key = release.releaseId + ':' + release.manifestDigest
    const cache = ec.cache.getCache(CACHE)
    const kept = cache.get(siteId)
    if (kept && kept.key === key) return kept.verified
    const found = ask('getShopThemeRelease', {
        siteId,
        releaseId: release.releaseId,
    })
    if (
        found.manifestDigest !== release.manifestDigest ||
        digestOf(found.manifestText) !== release.manifestDigest
    )
        fail(
            'Unavailable',
            'Release ' + release.releaseId + ' manifest does not match',
        )
    const manifest = JSON.parse(found.manifestText)
    if (!ec.resource.theme.engines().includes(manifest.engine))
        fail('Unavailable', 'Engine ' + manifest.engine + ' is not installed')
    if (!VIEW_API_VERSIONS.includes(Number(manifest.viewApiVersion)))
        fail(
            'Unavailable',
            'View API ' + manifest.viewApiVersion + ' is not supported',
        )
    const pinned = Object.fromEntries(
        (manifest.files || []).map((file) => [file.path, file.digest]),
    )
    const paths = Object.keys(pinned)
    const files = {}
    for (let start = 0; start < paths.length; start += FILES_PER_CALL) {
        const batch = paths.slice(start, start + FILES_PER_CALL)
        const answer = ask('getShopThemeFiles', {
            siteId,
            releaseId: release.releaseId,
            paths: batch.join(','),
        })
        for (const file of answer.files || []) {
            if (
                !(file.path in pinned) ||
                digestOf(file.text) !== pinned[file.path]
            )
                fail(
                    'Unavailable',
                    'Release ' +
                        release.releaseId +
                        ' file ' +
                        file.path +
                        ' does not match its digest',
                )
            files[file.path] = file.text
        }
    }
    const missing = paths.filter((path) => files[path] == null)
    if (missing.length)
        fail(
            'Unavailable',
            'Release ' + release.releaseId + ' is missing ' + missing[0],
        )
    const verified = { manifest, files }
    cache.put(siteId, { key, verified })
    return verified
}
const escapeText = (text) =>
    String(text ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c],
    )
/* P3's search form: a GET to the store's Search page with the current query. */
function searchForm(view) {
    return (
        '<form class="shop-search" method="get" role="search" action="' +
        escapeText(view?.shop?.searchUrl || 'Search') +
        '"><label>Search the store <input type="search" name="q" maxlength="100" value="' +
        escapeText(view?.page?.query || '') +
        '"></label><button type="submit">Search</button></form>'
    )
}
/* The built-in safe page for a release or page that cannot be shown: no draft, source or diagnostic text. */
function unavailablePage(context) {
    const name = escapeText(context?.store?.name || 'This store')
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
        name +
        '</title></head><body><main id="ShopUnavailable"><h1>' +
        name +
        ' is not available right now</h1><p>Please try again in a few minutes.</p></main></body></html>'
    )
}
/* The asset prefix of a release under the site's Shop mount: immutable by the manifest's digest. */
const assetBase = (context, release) =>
    (context.mount.base || '') + '/theme/' + release.manifestDigest
/* Render a Shop page through the active theme: {status, html, ok, omitted, failedRequired, releaseId}, or null when
 * the site has no published theme (the page keeps the PASS shell). `call` is the authority call (the facade by
 * default). */
function renderPage(context, pageKind, call, input) {
    const ask = call || facade
    const page = ask('getShopPage', {
        ...(input || {}),
        siteId: context.site.siteId,
        pageKind,
    })
    return renderView(context, pageKind, page, ask)
}
/* Render a getShopPage answer through its release (the same result as renderPage), or null when it has none. The
 * components given are the page kind's that the release declares (a release published before a component was added
 * does not place it, and the adapter refuses one given and not placed). */
function renderView(context, pageKind, page, call) {
    const ask = call || facade
    const release = page.release
    if (!release) return null
    let verified
    try {
        verified = packageOf(context.site.siteId, release, ask)
    } catch (error) {
        ec.logger.error(
            'Shop site ' +
                context.site.siteId +
                ' release ' +
                release.releaseId +
                ' unavailable: ' +
                error.message,
        )
        return {
            status: 503,
            ok: false,
            html: unavailablePage(context),
            omitted: [],
            failedRequired: [],
            releaseId: release.releaseId,
        }
    }
    let declared = null
    try {
        declared = JSON.parse(
            verified.files['theme.json'] || '{}',
        ).requiredComponents
    } catch (error) {
        declared = null
    }
    const components = Object.fromEntries(
        Object.entries(COMPONENTS)
            .filter(
                ([name, component]) =>
                    component.kinds.includes(pageKind) &&
                    (!Array.isArray(declared) || declared.includes(name)),
            )
            .map(([name, component]) => [
                name,
                { html: component.html(context, page.view) },
            ]),
    )
    const rendered = ec.resource.theme.render(
        { files: verified.files },
        {
            pageKind,
            view: page.view,
            components,
            references: page.references || {},
            media: page.media || {},
            sources: page.sources || {},
            assetBase: assetBase(context, release),
            releaseId: release.releaseId,
        },
    )
    for (const diagnostic of rendered.diagnostics || [])
        if (diagnostic.severity === 'error')
            ec.logger.error(
                'Shop site ' +
                    context.site.siteId +
                    ' release ' +
                    release.releaseId +
                    ' ' +
                    pageKind +
                    ': ' +
                    diagnostic.file +
                    ':' +
                    diagnostic.line +
                    ' ' +
                    diagnostic.message,
            )
    if (!rendered.html)
        return {
            status: 503,
            ok: false,
            html: unavailablePage(context),
            omitted: rendered.omitted || [],
            failedRequired: rendered.failedRequired || [],
            releaseId: release.releaseId,
        }
    return {
        status: page.status || 200,
        ok: !!rendered.ok,
        html: rendered.html,
        omitted: rendered.omitted || [],
        failedRequired: rendered.failedRequired || [],
        releaseId: release.releaseId,
    }
}
/* Answer a release asset (the package's assets/, by the manifest's digest in the path) on the response: immutable,
 * nosniff, an SVG cleaned again and sandboxed. Anything else, or another release's digest, is Not Found. */
function sendAsset(context, manifestDigest, assetPath, call) {
    const release = context.release
    const path = 'assets/' + String(assetPath || '')
    if (
        !release ||
        release.manifestDigest !== manifestDigest ||
        !/^assets\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*\.[a-z0-9]+$/.test(path) ||
        path.includes('..')
    )
        fail('NotFound', 'Not found')
    let verified
    try {
        verified = packageOf(context.site.siteId, release, call)
    } catch (error) {
        fail('NotFound', 'Not found')
    }
    let text = verified.files[path]
    const extension = path.slice(path.lastIndexOf('.') + 1)
    const type = ASSET_TYPES[extension]
    // only the asset types a theme serves: never its template source (.html.fancy-locked) or another file under assets/
    if (text == null || !type) fail('NotFound', 'Not found')
    if (extension === 'svg') text = ec.resource.theme.sanitizeSvg(text)
    const response = ec.web?.response
    if (!response) return { contentType: type, text }
    response.setContentType(type + '; charset=utf-8')
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
    )
    response.write(text)
    return { contentType: type, text }
}
;({
    COMPONENTS,
    packageOf,
    renderPage,
    renderView,
    unavailablePage,
    sendAsset,
    escapeText,
})
