// OWASP ASVS 5.0.0 V4 API and Web Service: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V4). They go to the authority's account route (/rest/s1/pass/v1/sites/{site}) as a client or a
// PASS frontend does, on the server's host or a deployment's --param authorityUrl=URL.

// The site's id: the fixtures' PASS_HTTP, or a deployment's --param site=ID.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
const authority = () => `${(params.authorityUrl ?? "").replace(/\/+$/, "")}/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}`
// A registered PASS frontend of the site: the fixtures' client test (test/MoquiConf.xml), or a deployment's
// --param clientId=ID with its secret in MOQUI_TEST_CLIENT_SECRET; else none.
const CLIENT = params.clientId
    ? { id: params.clientId, secret: params.clientSecret ?? "" }
    : profile == "fixtures"
      ? { id: "test", secret: "test-deployment-secret" }
      : null
// In the fixtures profile the session names an address of its own in 127.0.0.0/8 (X-Moqui-Test-Peer, which only the
// project's test server reads, as the client's TCP address).
const peerHeaders = () =>
    profile == "fixtures"
        ? { "X-Moqui-Test-Peer": `127.7.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}` }
        : {}
const recover = (s, emailAddress, headers) =>
    s.post(`${authority()}/account/recovery`, { json: { emailAddress }, accept: "json", headers })

// Configuration in the matrix. A remote PASS frontend tells the authority its visitor's address in x-pass-client-ip,
// with its client id and secret; PASS's limits key a request by that address only when the secret is the registered
// client's (framework service/org/moqui/public/Account.js requesterKey), else by the request's own address. Here a client
// sends the frontend's headers without the secret, a new x-pass-client-ip on each try of account recovery at the
// authority's account route (ten a client in ten minutes): the eleventh is still refused. The project's test server takes
// X-Moqui-Test-Peer from loopback as the TCP address; a deployment's run is opt-in, as it limits this client's recovery
// requests for ten minutes.
// Does not prove: the framework's own proxy header (webapp-list/webapp[webroot]@client-ip-header, believed only from
// @trusted-proxies: V15, 15.3.4), nor the gRPC transport, whose address field only a verified client sets.
feature("v5.0.0-4.1.3: a visitor address header counts only from the registered PASS frontend", {
    given() {
        if (!SITE) skip("the site's id is not known: pass --param site=ID to reach its authority's account route")
        if (profile != "fixtures" && params.bruteForce != "yes")
            skip("opt-in in a deployment, as it limits this client's recovery requests for ten minutes: --param bruteForce=yes, alone (--spec V4ApiWebService)")
    },
    when() {
        const stamp = Date.now()
        const s = session({ headers: peerHeaders() })
        s.get(`${authority()}/site`, { accept: "json" })
        const statuses = []
        for (let i = 0; i < 11; i++)
            statuses.push(recover(s, `proof.forwarded.${stamp}.${i}@example.test`, {
                "x-pass-client": CLIENT?.id ?? "frontend",
                "x-pass-client-ip": `198.51.100.${i + 1}`,
            }).status)
        // the registered frontend's secret makes the same header the requester
        const registered = CLIENT
            ? recover(s, `proof.forwarded.${stamp}.registered@example.test`, {
                  "x-pass-client": CLIENT.id,
                  "x-pass-client-secret": CLIENT.secret,
                  "x-pass-client-ip": "198.51.100.200",
              }).status
            : null
        return { statuses, registered }
    },
    then({ statuses, registered }) {
        // the control: the first ten are answered
        statuses.slice(0, 10).every((status) => status == 200)
        statuses[10] == 429
        registered == null || registered == 200
    },
})
