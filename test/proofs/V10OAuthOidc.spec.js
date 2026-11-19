// OWASP ASVS 5.0.0 V10 OAuth and OIDC: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V10). PASS's authority is the identity provider of its remote frontends: a frontend signs a visitor
// in at the authority's account route with its client id and secret and keeps the delegation it gets in its own server
// session (service/pass/Account.js), never in the browser. These go to the authority's REST API
// (/rest/s1/pass/v1/sites/{site}) as a frontend does, on the server's host or a deployment's --param authorityUrl=URL.

// The site's id: the fixtures' PASS_HTTP, or a deployment's --param site=ID.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
const authority = () => `${(params.authorityUrl ?? "").replace(/\/+$/, "")}/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}`
// A registered PASS frontend of the site: the fixtures' client test (test/MoquiConf.xml), or a deployment's
// --param clientId=ID with its secret in MOQUI_TEST_CLIENT_SECRET.
const CLIENT = params.clientId
    ? { id: params.clientId, secret: params.clientSecret ?? "" }
    : profile == "fixtures"
      ? { id: "test", secret: "test-deployment-secret" }
      : null
// The account a proof signs in with: the run's (--param user=NAME, its password in MOQUI_TEST_PASSWORD), else in the
// fixtures profile ClientFixtures' member pass.http.reader.
const account = () => {
    if (params.user) return { username: params.user, password: params.password ?? "" }
    needsFixtures("an account to sign in with (or --param user=NAME and MOQUI_TEST_PASSWORD)")
    return { username: "pass.http.reader", password: "moqui1!!" }
}
// In the fixtures profile a session names an address of its own in 127.0.0.0/8 (X-Moqui-Test-Peer, which only the
// project's test server reads).
const peerHeaders = () =>
    profile == "fixtures"
        ? { "X-Moqui-Test-Peer": `127.11.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}` }
        : {}

// A delegation is good only beside the client secret of the frontend it was issued to (mr-mantle script/PassApi.js: a
// bearer from a caller that is not a registered client is refused, and PassAuthority.js checks it for that client and
// site): one a browser held without the secret, or another site's call, gets nothing. The control: the frontend's own call
// with it reads the account's drafts.
// Does not prove: that the frontend keeps it out of its pages (it is a server session attribute, passDelegation; the
// acceptance walk RemoteHttp looks for it in a remote frontend's page), nor Mantle's PayTrace token, kept in the
// process's cache and sent only to the gateway, which a client cannot see.
feature("v5.0.0-10.1.1: a delegation is taken only from the PASS frontend it was issued to", {
    given() {
        if (!SITE) skip("the site's id is not known: pass --param site=ID")
        if (!CLIENT) skip("needs the frontend's client: --param clientId=ID, its secret in MOQUI_TEST_CLIENT_SECRET")
    },
    when() {
        const { username, password } = account()
        const api = authority()
        const frontend = { "x-pass-client": CLIENT.id, "x-pass-client-secret": CLIENT.secret, "x-pass-client-ip": "198.51.100.10" }
        const issued = session({ headers: Object.assign(peerHeaders(), frontend) })
            .post(`${api}/account/session`, { json: { username, password }, accept: "json" })
        assert(issued.status == 200 && issued.json().credential,
            `the frontend's sign-in issued no delegation: HTTP ${issued.status} ${issued.text.slice(0, 200)}`)
        const bearer = { Authorization: `Bearer ${issued.json().credential}` }
        const read = (headers, path) => session({ headers: Object.assign(peerHeaders(), headers) }).get(path ?? `${api}/me/drafts`, { accept: "json" })
        return {
            issued,
            own: read(Object.assign({}, frontend, bearer)),
            bare: read(bearer),
            otherClient: read(Object.assign({ "x-pass-client": `${CLIENT.id}-other` }, bearer)),
            otherSite: read(Object.assign({}, frontend, bearer), `${api}_OTHER/me/drafts`),
        }
    },
    then({ issued, own, bare, otherClient, otherSite }) {
        issued.json().credential.length == 64
        // the control: the frontend's call with its secret reads the account's drafts
        own.status == 200
        Array.isArray(own.json().draftList)
        bare.status == 401
        bare.json().code == "AuthenticationRequired"
        otherClient.status == 401
        otherSite.status >= 400
        !otherSite.text.includes("draftList")
    },
})
