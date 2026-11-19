// OWASP ASVS 5.0.0 V15 Secure Coding and Architecture: PASS's proofs, each feature filed under the requirement its name
// starts with (docs/ASVS-Matrix.md, V15). They go to the authority's REST API (/rest/s1/pass/v1/sites/{site}), on the
// server's host or on a deployment's --param authorityUrl=https://business-host.

// The site's id, for the authority's API: the fixtures' PASS_HTTP, or a deployment's --param site=ID.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
const authority = () => `${(params.authorityUrl ?? "").replace(/\/+$/, "")}/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}`
// In the fixtures profile a session names an address of its own in 127.0.0.0/8 (X-Moqui-Test-Peer, which only the
// project's test server reads, as the client's TCP address).
const peer = () => `127.8.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}`
const peerHeaders = () => (profile == "fixtures" ? { "X-Moqui-Test-Peer": peer() } : {})
// The account a proof signs in with: the run's (--param user=NAME, its password in MOQUI_TEST_PASSWORD), else in the
// fixtures profile ClientFixtures' member pass.http.reader.
const account = () => {
    if (params.user) return { username: params.user, password: params.password ?? "" }
    needsFixtures("an account to sign in with (or --param user=NAME and MOQUI_TEST_PASSWORD)")
    return { username: "pass.http.reader", password: "moqui1!!" }
}
const recover = (s, emailAddress, headers) =>
    s.post(`${authority()}/account/recovery`, { json: { emailAddress }, accept: "json", headers })

// Configuration in the matrix: the framework believes a proxy's client address header
// (webapp-list/webapp[webroot]@client-ip-header) only from @trusted-proxies, and believes none by default. Here a client
// sends the usual proxy headers, a new address in each, on each try of account recovery at the authority's account route,
// which PASS limits to ten a client in ten minutes: the eleventh is refused, so the limit counted the client's own address. In the fixtures profile the
// project's test server takes X-Moqui-Test-Peer from loopback as the TCP address, and a second such address is answered;
// a deployment's run is opt-in, as it limits this client's recovery requests for ten minutes.
// Does not prove: that a proxy in front forwards the visitor's address correctly (that is its configuration and
// @trusted-proxies), nor the log lines' address, which is the same value.
feature("v5.0.0-15.3.4: a client's own proxy headers do not change the address PASS limits", {
    given() {
        if (!SITE) skip("the site's id is not known: pass --param site=ID to reach its authority's account route")
        if (profile != "fixtures" && params.bruteForce != "yes")
            skip("opt-in in a deployment, as it limits this client's recovery requests for ten minutes: --param bruteForce=yes, alone (--spec V15SecureCoding)")
    },
    when() {
        const stamp = Date.now()
        const s = session({ headers: peerHeaders() })
        s.get(`${authority()}/site`, { accept: "json" })
        const statuses = []
        for (let i = 0; i < 11; i++) {
            const forged = `203.0.113.${i + 1}`
            statuses.push(recover(s, `proof.proxy.${stamp}.${i}@example.test`, {
                "X-Forwarded-For": forged,
                "X-Real-IP": forged,
                Forwarded: `for=${forged}`,
                "True-Client-IP": forged,
            }).status)
        }
        let other = null
        if (profile == "fixtures") {
            other = recover(s, `proof.proxy.${stamp}.other@example.test`, peerHeaders()).status
        }
        return { statuses, other }
    },
    then({ statuses, other }) {
        // the control: the first ten are answered
        statuses.slice(0, 10).every((status) => status == 200)
        statuses[10] == 429
        // and another client's address is not limited by them
        other == null || other == 200
    },
})

// The authority's REST API takes an operation's input from the query, the form and the JSON body merged (mr-mantle
// script/PassApi.js); the site is the path's alone: a siteId in the input unlike the path's is refused 422, and a field the
// operation's schema does not list is refused too. A draft stands for the writes: the one the control stores is
// discarded after. The session signs in at the authority's own account route, with its session token.
// Does not prove: the site's pages, which copy only the operation's schema fields into its input and set siteId to the
// site the conf binds to the host (screen/Shared/View.js inputFor), nor the gRPC transport, whose site is the message's.
feature("v5.0.0-15.3.7: a siteId or an unknown field added to a request is refused, not merged", {
    when() {
        if (!SITE) skip("the site's id is not known: pass --param site=ID to reach its authority API")
        const { username, password } = account()
        const api = authority()
        const s = session({ headers: peerHeaders() })
        s.get(`${api}/site`, { accept: "json" })
        const signedIn = s.post(`${api}/account/session`, { json: { username, password }, accept: "json" })
        assert(signedIn.status == 200 && signedIn.json().authenticated === true,
            `${username} did not sign in at the authority: HTTP ${signedIn.status} ${signedIn.text.slice(0, 200)}`)
        const category = (s.get(`${api}/categories`, { accept: "json" }).json().categoryList ?? [])[0]
        if (!category) skip(`the site ${SITE} has no category ${username} can see`)
        const stamp = Date.now()
        const draft = (title, extra, query) => s.post(`${api}/me/drafts`, {
            json: Object.assign({ mode: "topic", contactListId: category.contactListId, title, body: "<p>pollution proof</p>" }, extra),
            params: query,
            accept: "json",
        })
        const otherSite = draft(`other site ${stamp}`, { siteId: `${SITE}_OTHER` })
        const querySite = draft(`query site ${stamp}`, {}, { siteId: `${SITE}_OTHER` })
        const unknown = draft(`unknown ${stamp}`, { partyId: "_NA_" })
        const allowed = draft(`allowed ${stamp}`, {})
        const repeated = s.get(`${api}/categories`, { params: { siteId: [SITE, `${SITE}_OTHER`] }, accept: "json" })
        const titles = (s.get(`${api}/me/drafts`, { accept: "json" }).json().draftList ?? []).map((d) => d.title)
        if (allowed.status == 200)
            s.delete(`${api}/me/drafts/${allowed.json().draftId}`, { params: { expectedRevision: allowed.json().revision } })
        return { stamp, otherSite, querySite, unknown, allowed, repeated, titles }
    },
    then({ stamp, otherSite, querySite, unknown, allowed, repeated, titles }) {
        otherSite.status == 422
        otherSite.text.includes("Unsupported request field: siteId")
        querySite.status == 422
        unknown.status == 422
        repeated.status == 422
        !titles.some((title) => /^(other site|query site|unknown) /.test(title) && title.endsWith(String(stamp)))
        // the control: the same post without them stores the draft
        allowed.status == 200
        titles.includes(`allowed ${stamp}`)
    },
})
