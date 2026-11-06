/* The PASS shell's response headers per route (impl-shop P1, F3; design-shop §12.7): every route is `no-store` with the
 * shell's CSP unless a route here says otherwise. A route names its app and a path pattern within the app's mount, and
 * may change `cacheControl` (P3: public caching of the anonymous catalog routes, only for a request with no session or
 * signed-in user) or add a `formAction` source to the CSP (P5: the payment relay route, F37). The first route that
 * matches decides. Pass.xml applies this before any page renders; a page's own headers still win. CC0 plus patent grant.
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
/* {app, path: RegExp over the path within the mount, cacheControl?, formAction?: [sources]}; none before P3. */
const ROUTES = []
/* The policy of a request: its app (the mount it is in) and its path within that mount. */
function policyOf(app, path) {
    const route = ROUTES.find((r) => r.app === app && r.path.test(path || '/'))
    return { ...DEFAULT, ...(route || {}) }
}
const csp = (policy) =>
    Object.entries(CSP)
        .map(([name, sources]) =>
            [
                name,
                ...sources,
                ...(name === 'form-action' ? policy.formAction || [] : []),
            ].join(' '),
        )
        .join('; ')
/* Set the headers of a request's route on the response, and answer the policy. */
function apply(app, path) {
    const policy = policyOf(app, path)
    const response = ec.web?.response
    if (response) {
        response.setHeader('Cache-Control', policy.cacheControl)
        response.setHeader('Referrer-Policy', 'same-origin')
        response.setHeader('Content-Security-Policy', csp(policy))
    }
    return policy
}
;({ ROUTES, policyOf, csp, apply })
