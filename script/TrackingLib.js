/* PASS Marketing's tracking web scripts' helpers (IronStone impl-marketing P15; design-marketing §8 "Capture on the authority",
   §13.1): the request's site and code from the path, a personalized token from its token parameter (redacted from the request log),
   the visitor's opaque first-party key, a known automated fetch, the browser's do-not-track, and the authority's two operations through
   PASS's facade (Facade.js: in process, or Transport.js over REST or gRPC). Nothing here reads a destination from the request. CC0
   plus patent grant. */
const COOKIE = 'mkt_vk'
const sitePattern = /^[A-Za-z0-9_-]{1,40}$/
const codePattern = /^[A-Za-z0-9]{8,24}$/
const tokenPattern = /^[A-Za-z0-9_-]{24,64}$/
const keyPattern = /^[A-Za-z0-9_-]{16,64}$/
// link scanners, crawlers, previews and command-line fetchers: an observation of a fetch, never a click
const AUTOMATED =
    /bot\b|bot\/|crawler|spider|slurp|preview|scanner|proofpoint|mimecast|barracuda|safelinks|urldefense|facebookexternalhit|whatsapp|skypeuripreview|python-requests|python-urllib|curl\/|wget\/|go-http-client|okhttp|headlesschrome|phantomjs/i
const facade = () => ec.resource.script('component://mr-pass/service/pass/Facade.js')
/* The path's parts after the servlet's prefix. */
const pathParts = (request) =>
    String(request.pathInfo || '')
        .split('/')
        .filter((part) => part !== '')
/* A personalized token of the request (its token parameter), or null. */
function tokenOf(request) {
    const value = request.getParameter('token')
    return value != null && tokenPattern.test(String(value)) ? String(value) : null
}
/* Whether the request is a known automated fetch: a HEAD, a prefetch, or a scanner's or crawler's user agent. */
function automated(request) {
    if (String(request.method).toUpperCase() === 'HEAD') return true
    const purpose = String(request.getHeader('sec-purpose') || request.getHeader('purpose') || request.getHeader('x-moz') || '')
    if (/prefetch|prerender/i.test(purpose)) return true
    const agent = String(request.getHeader('user-agent') || '')
    return !agent || AUTOMATED.test(agent)
}
/* Whether the browser asks not to be tracked (Global Privacy Control or Do Not Track). */
const doNotTrack = (request) => request.getHeader('sec-gpc') === '1' || request.getHeader('dnt') === '1'
/* The visitor key the browser holds, or null. */
function heldKey(request) {
    for (const cookie of request.getCookies() || [])
        if (cookie.name === COOKIE && keyPattern.test(String(cookie.value))) return String(cookie.value)
    return null
}
/* The visitor key to send with an event: the one held, or a new one set by a Set-Cookie header, when the authority says a key may be
   kept and the browser does not ask not to be tracked and the request is not automated; else null and no cookie. */
function visitorKey(request, response, allowed) {
    if (!allowed || doNotTrack(request) || automated(request)) return null
    const held = heldKey(request)
    if (held) return held
    const key = ec.user.randomString(40).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
    if (!keyPattern.test(key)) return null
    response.addHeader(
        'Set-Cookie',
        COOKIE + '=' + key + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax' + (request.secure ? '; Secure' : ''),
    )
    return key
}
/* The headers of every answer: nothing kept by a cache, no referrer, not indexed. */
function privateHeaders(response) {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Robots-Tag', 'noindex, nofollow')
    response.setHeader('X-Content-Type-Options', 'nosniff')
}
/* An operation's result, or null when the authority refuses it or cannot be reached (logged without the request's values). */
function attempt(operation, input) {
    const given = {}
    for (const [name, value] of Object.entries(input)) if (value != null && value !== '') given[name] = value
    try {
        return facade().call(operation, given)
    } catch (error) {
        ec.message.clearErrors()
        if (error?.moquiErrorKind !== 'NotFound')
            ec.logger.warn('PASS tracking ' + operation + ' was not answered: ' + String(error?.moquiErrorKind || 'error'))
        return null
    }
}
/* The neutral page: the link is not available, with nothing of the request or the link in it. */
function neutral(response) {
    response.setStatus(404)
    response.setContentType('text/html; charset=UTF-8')
    response.write(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<meta name="robots" content="noindex"><title>Link not available</title></head><body style="font-family:sans-serif;' +
            'max-width:36rem;margin:3rem auto;padding:0 1rem"><h1 style="font-size:1.4rem">This link is not available</h1>' +
            '<p>It may have ended, or the address may be mistyped.</p></body></html>',
    )
}
;({ COOKIE, sitePattern, codePattern, pathParts, tokenOf, automated, doNotTrack, visitorKey, privateHeaders, attempt, neutral, heldKey })
