/* PASS Marketing's open pixel (IronStone impl-marketing P15; design-marketing §8 "Capture on the authority"): GET /trk-o/{siteId}?token=,
   added to a send's message only for a recipient who allows tracking (PcpTracking) under a sending profile that tracks consenting
   recipients. It records the open on the authority (recordTrackingEvent with the token and no code; a known automated fetch apart) and
   always answers the same transparent image, whether or not anything was recorded. No cookie, no visitor key, no session. CC0 plus patent
   grant. */
const lib = ec.resource.script('component://mr-pass/script/TrackingLib.js')
const GIF = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x01, 0x44, 0x00, 0x3b,
])
function answer(request, response) {
    ec.web.declineSession()
    lib.privateHeaders(response)
    const parts = lib.pathParts(request)
    const token = lib.tokenOf(request)
    if (parts.length === 1 && lib.sitePattern.test(parts[0]) && token)
        lib.attempt('recordTrackingEvent', { siteId: parts[0], token, kind: lib.automated(request) ? 'fetch' : 'open' })
    response.setStatus(200)
    response.setContentType('image/gif')
    response.write(GIF)
}
;({
    doGet(request, response) {
        answer(request, response)
    },
    doHead(request, response) {
        answer(request, response)
    },
})
