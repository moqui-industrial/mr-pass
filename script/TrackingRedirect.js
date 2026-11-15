/* PASS Marketing's tracking redirect (IronStone impl-marketing P15; design-marketing §8 TrackingLinkDetail, "Capture on the authority",
   §18 the tracking URL and QR): GET /trk/{siteId}/{publicCode}, a send's personalized link with ?token=. The authority says where the
   link goes (resolveTrackingLink: its registered destination with its UTM values, its safe destination when disabled or ended, or none)
   and records the click (recordTrackingEvent: a known automated fetch apart, the visitor key where it may be kept, the recipient only
   where they allow tracking); the visitor is redirected even when recording fails or is over its limit. No other parameter is read:
   a destination, a fallback or a return address in the request is never followed. Declines the session; sets only the visitor key.
   CC0 plus patent grant. */
const lib = ec.resource.script('component://mr-pass/script/TrackingLib.js')
function answer(request, response) {
    ec.web.declineSession()
    lib.privateHeaders(response)
    const parts = lib.pathParts(request)
    if (parts.length !== 2 || !lib.sitePattern.test(parts[0]) || !lib.codePattern.test(parts[1])) return lib.neutral(response)
    const [siteId, code] = parts
    const token = lib.tokenOf(request)
    const resolved = lib.attempt('resolveTrackingLink', { siteId, code, token })
    if (!resolved) return lib.neutral(response)
    const robot = lib.automated(request)
    const visitorKey = lib.visitorKey(request, response, resolved.visitorKeys === true)
    lib.attempt('recordTrackingEvent', { siteId, code, token, visitorKey, kind: robot ? 'fetch' : 'click' })
    const destination = typeof resolved.destination === 'string' ? resolved.destination : ''
    if (/^https:\/\/[^\s]+$/.test(destination)) response.sendRedirect(destination)
    else lib.neutral(response)
}
;({
    doGet(request, response) {
        answer(request, response)
    },
    doHead(request, response) {
        answer(request, response)
    },
})
