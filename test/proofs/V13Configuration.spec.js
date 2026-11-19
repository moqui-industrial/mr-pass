// OWASP ASVS 5.0.0 V13 Configuration: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V13).

// Where the site mounts the Account app: /account on the fixtures' PASS_HTTP site, else --param accountPath=/path.
const ACCOUNT = (params.accountPath ?? "/account").replace(/\/+$/, "")

// Configuration in the matrix: the framework refuses a method web protection's request rule does not list (TRACE among
// them) with 405, when webapp-list/webapp[webroot]/web-protection@enabled is true (runtime/conf/pass/MoquiPassConf.xml
// sets it) or @trusted-proxies is set. The project's test server runs without web protection, where a TRACE reaches the
// pages as a GET does (it echoes nothing), so this is a deployment's proof. The request carries a header of its own,
// which a TRACE that is answered would echo.
// Does not prove: what a proxy in front does with TRACE (it may answer before the server), nor the other listeners.
feature("v5.0.0-13.4.4: a TRACE request is refused and its request is never echoed", {
    given() {
        if (profile == "fixtures") skip("the project's test server runs without web protection, which refuses TRACE: a deployment's proof")
    },
    when() {
        const probe = `trace-proof-${Date.now()}`
        const s = session()
        return {
            probe,
            page: s.get(`${ACCOUNT}/Login`),
            trace: s.request("TRACE", `${ACCOUNT}/Login`, { headers: { "X-Trace-Proof": probe } }),
        }
    },
    then({ probe, page, trace }) {
        // the control: the page answers a GET
        page.status == 200
        trace.status == 405 || trace.status == 501
        !trace.text.includes(probe)
        !(trace.contentType ?? "").startsWith("message/http")
    },
})
