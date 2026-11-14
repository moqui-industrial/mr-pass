/* The PASS shell's response headers per route (impl-shop P1, F3; design-shop §12.7): every route is `no-store` with the
 * shell's CSP unless a route here says otherwise. A route names its app and a path pattern within the app's mount, and
 * may change `cacheControl` (P3: public caching of the anonymous catalog routes, only for a request with no session or
 * signed-in user) or add a `formAction` source to the CSP (P5: the payment relay route, F37). The first route that
 * matches decides. A publicly cached answer varies by Cookie. Pass.xml applies this before any page renders; a page's own
 * headers still win. CC0 plus patent grant.
 */
const CSP = {
    'script-src': ["'self'", "'unsafe-eval'"],
    'img-src': ["'self'", 'data:'],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
}
const DEFAULT = { cacheControl: 'no-store', formAction: [] }
/* {app, path: RegExp over the path within the mount, cacheControl?, anonymousOnly?, formAction?: [sources]}. */
const ROUTES = [
    // P3 (design-shop §12.7, F42): Shop's anonymous catalog and content routes, Home, Categories, a category, Search, a
    // product, a page, the sitemap and robots, are public for a minute, and only for a request with no session cookie and
    // no signed-in user (anonymousOnly; anything else is no-store). The page itself sends no-store for any answer but 200
    // and an ETag of its content. A cart (P4) makes a session, so a shopper with one is no-store.
    {
        app: 'shop',
        path: /^\/(?:Home|Categories(?:\/List)?|Search|products\/[A-Za-z0-9_-]{1,40}(?:\/[A-Za-z0-9_-]{0,200})?|categories\/[A-Za-z0-9_-]{1,40}(?:\/[A-Za-z0-9_-]{0,200})?|pages(?:\/[A-Za-z0-9_-]{1,40}){1,5}|sitemap\.xml|robots\.txt)?\/?$/,
        cacheControl: 'public, max-age=60',
        anonymousOnly: true,
    },
    // P5 (F37; the user's call, impl-shop §4): the payment relay posts a fresh Accept Hosted form token to Authorize.Net's
    // page (production and sandbox); only this route's form-action allows them, and it stays no-store
    {
        app: 'shop',
        // Shop P6 (F40): the hosted profile page's relay for a card kept outside a checkout
        path: /^\/(?:PaymentRelay|MethodRelay)\/?$/,
        formAction: [
            'https://accept.authorize.net',
            'https://test.authorize.net',
        ],
    },
    // Smithy DG1 (plan/design-smithy.md §1): its read pages are public for a minute, and only for a request with no session
    // cookie and no signed-in user (anonymousOnly), which sees public groups and repositories alone; a signed-in or
    // session request, so every members-only and private page, is no-store, as are the app's own paths under /-/ and the
    // create and import pages. A page answers no-store itself for a refusal and a redirect (Smithy/Smithy.js).
    {
        app: 'smithy',
        path: /^\/(?!-(?:\/|$)|new(?:\/|$)|import(?:\/|$))/,
        cacheControl: 'public, max-age=60',
        anonymousOnly: true,
    },
]
/* The cookies of a session (the framework's, and a servlet container's): a request with one is not anonymous. */
const SESSION_COOKIES = /^(?:moqui\.session|moquiSession|JSESSIONID)$/
/* Whether this request is anonymous and session-less: no signed-in user and no session cookie. */
function anonymous() {
    const request = ec.web?.request
    if (ec.user.userId || !request) return false
    return !request
        .getCookies()
        .some((cookie) => SESSION_COOKIES.test(cookie.name))
}
/* The policy of a request: its app (the mount it is in) and its path within that mount; a route for anonymous requests
 * only (anonymousOnly) is the default unless anonymous is true. */
function policyOf(app, path, isAnonymous) {
    const route = ROUTES.find((r) => r.app === app && r.path.test(path || '/'))
    if (route && route.anonymousOnly && !isAnonymous) return { ...DEFAULT }
    return { ...DEFAULT, ...(route || {}) }
}
const csp = (policy) =>
    Object.entries(CSP)
        .map(([name, sources]) =>
            [
                name,
                ...sources,
                ...(name === 'form-action' ? policy.formAction || [] : []),
                ...(name === 'img-src' ? policy.imgSrc || [] : []),
            ].join(' '),
        )
        .join('; ')
/* The https origin of a site's brand logo (getSiteInfo's brand.logoUrl), which the shell's img-src allows; a local logo is
 * 'self' already. Only a plain host and port, so nothing else reaches the policy. */
const logoOrigin = (logoUrl) =>
    /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?=[/?#]|$)/.exec(
        String(logoUrl || ''),
    )?.[0]
/* Set the headers of a request's route on the response, and answer the policy; logoUrl the site's brand logo. */
function apply(app, path, logoUrl) {
    const origin = logoOrigin(logoUrl)
    const policy = {
        ...policyOf(app, path, app ? anonymous() : false),
        ...(origin ? { imgSrc: [origin.toLowerCase()] } : {}),
    }
    const response = ec.web?.response
    if (response) {
        response.setHeader('Cache-Control', policy.cacheControl)
        // a page a cache may keep is the answer to a request with no cookie only: once a visitor has a session (signing
        // in), neither the browser's cache nor a shared one answers with the anonymous page
        if (String(policy.cacheControl).startsWith('public'))
            response.setHeader('Vary', 'Cookie')
        response.setHeader('Referrer-Policy', 'same-origin')
        response.setHeader('Content-Security-Policy', csp(policy))
    }
    return policy
}
;({ ROUTES, policyOf, anonymous, csp, logoOrigin, apply })
