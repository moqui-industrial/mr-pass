// OWASP ASVS 5.0.0 V2 Validation and Business Logic: PASS's proofs, each feature filed under the requirement its name
// starts with (docs/ASVS-Matrix.md, V2). They go to the authority's account route (/rest/s1/pass/v1/sites/{site}), which
// a PASS site's own form reaches in process, on the server's host or a deployment's --param authorityUrl=URL.

// The site's id: the fixtures' PASS_HTTP, or a deployment's --param site=ID.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
const authority = () => `${(params.authorityUrl ?? "").replace(/\/+$/, "")}/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}`
// In the fixtures profile a request names an address of its own in 127.0.0.0/8 (X-Moqui-Test-Peer, which only the
// project's test server reads, as the client's TCP address): PASS's limits per client count it apart from the run.
const peerHeaders = () =>
    profile == "fixtures"
        ? { "X-Moqui-Test-Peer": `127.6.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}` }
        : {}
// A session of its own that has read the site (its session token), and a recovery request at the account route.
const recoverySession = () => {
    const s = session()
    const site = s.get(`${authority()}/site`, { accept: "json" })
    assert(site.status == 200, `GET ${authority()}/site answered ${site.status}`)
    return s
}
const recover = (s, emailAddress, headers) =>
    s.post(`${authority()}/account/recovery`, { json: { emailAddress }, accept: "json", headers })

// The maps document each operation's limits per requester, per address and per site (mr-moqui
// docs/security/Attack-Surface-Apps-PASS.md "Limits", and the -Commerce and -Forum-Smithy maps for each app); this proof
// shows one documented per-user limit holds at its number: account recovery, three requests for a mailbox address in an
// hour, from any client (framework service/org/moqui/public/Account.js throttle('recovery')). The address is an unknown
// one, answered as a known one is, so nothing is mailed. In the fixtures profile each request comes from another address;
// in a deployment it is opt-in, as it uses four of this client's ten recovery requests in ten minutes.
// Does not prove: that every operation's limit is documented or holds (each app's specs test its own), nor a limit over
// the whole site; the limit per client (ten in ten minutes) is the V4 and V15 proofs'.
feature("v5.0.0-2.1.3: account recovery holds its documented limit of three requests an address", {
    given() {
        if (!SITE) skip("the site's id is not known: pass --param site=ID to reach its authority's account route")
        if (profile != "fixtures" && params.bruteForce != "yes")
            skip("opt-in in a deployment, as it uses this client's recovery requests: --param bruteForce=yes, alone (--spec V2Validation)")
    },
    when() {
        const stamp = Date.now()
        const address = `proof.recover.${stamp}@example.test`
        const s = recoverySession()
        const answers = []
        let last = {}
        for (let i = 0; i < 4; i++) {
            last = peerHeaders()
            answers.push(recover(s, address, last))
        }
        // the refusal is the address's: the same client's next request, for another address, is answered
        return {
            statuses: answers.map((res) => res.status),
            fourth: answers[3],
            other: recover(s, `proof.recover.${stamp}.other@example.test`, last),
        }
    },
    then({ statuses, fourth, other }) {
        // the control: the first three for the address are answered
        statuses.slice(0, 3).every((status) => status == 200)
        statuses[3] == 429
        fourth.json().code == "Tarpit"
        other.status == 200
    },
})
