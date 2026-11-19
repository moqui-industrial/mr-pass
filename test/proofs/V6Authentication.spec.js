// OWASP ASVS 5.0.0 V6 Authentication: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V6). They go through the site's Account app, as its visitors do (Login, Settings and Register),
// and the authority's sign-in route on the same host (/rest/s1/pass/v1/sites/{site}/account/session). The password and
// registration proofs need accounts of test/ClientFixtures.spec.js that they change, so they skip in the deployment
// profile; the sign-in limits are the project's run for the limit PASS keeps itself, and opt-in for a deployment's.

// Where the site mounts the Account app: /account on the fixtures' PASS_HTTP site; a deployment that mounts it elsewhere
// passes --param accountPath=/path.
const ACCOUNT = (params.accountPath ?? "/account").replace(/\/+$/, "")
// The site's id, for the authority's routes: the fixtures' PASS_HTTP, or a deployment's --param site=ID.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
// A try of the site's sign-in form in a session of its own: a redirect away from it when it signs in, else 401.
const trySignIn = (username, password) => {
    const s = session()
    const page = s.get(`${ACCOUNT}/Login`)
    assert(page.status == 200, `GET ${ACCOUNT}/Login answered ${page.status}`)
    const res = s.post(`${ACCOUNT}/Login/save`, { form: { formAction: "startSession", username, password } })
    return { res, session: s }
}
const signedIn = ({ res }) => res.status == 302 && !(res.location ?? "").includes("/Login")

// ClientFixtures' pass.pw.proof: its password is set again on every run.
const PW_USER = "pass.pw.proof"
const PW = "PassPwProof1!!"
// ClientFixtures' registration waiting for its address check, with the two codes it wrote, as the mailbox holds them.
const REG_ADDRESS = "pass.reg.proof@example.test"
const REG_CODE = "PassRegProofLiveCode".padEnd(64, "0")
const REG_EXPIRED_CODE = "PassRegProofExpiredCode".padEnd(64, "0")
// The address check of the Register page, as the verification mail's link opens it.
const verify = (token, newPassword) => {
    const s = session()
    s.get(`${ACCOUNT}/Register`, { params: { token } })
    return s.post(`${ACCOUNT}/Register/save`, {
        form: Object.assign({ formAction: "verifyRegistration", token }, newPassword ? { newPassword } : {}),
        accept: "json",
    })
}

// Settings' Change password form (formAction manageAccount, action password), signed in through the site's form.
// Does not prove: the change on a remote frontend, which sends the same form to the authority's account route, nor a
// deployment's own accounts, whose passwords a proof does not change.
feature("v5.0.0-6.2.2: a PASS account changes its password on Settings; only the new one signs in", {
    given() { needsFixtures(`the user ${PW_USER}`) },
    when() {
        const fresh = `PassPw${Date.now() % 1000000}!a`
        const first = trySignIn(PW_USER, PW)
        assert(signedIn(first), `${PW_USER} did not sign in: HTTP ${first.res.status}; run ClientFixtures on the server's database`)
        const s = first.session
        const page = s.get(`${ACCOUNT}/Settings`)
        const res = s.post(`${ACCOUNT}/Settings/save`, {
            form: { formAction: "manageAccount", action: "password", oldPassword: PW, newPassword: fresh, newPasswordVerify: fresh },
            accept: "json",
        })
        return { page, res, withNew: trySignIn(PW_USER, fresh), withOld: trySignIn(PW_USER, PW) }
    },
    then({ page, res, withNew, withOld }) {
        // the control: the signed-in account is offered the form
        page.text.includes('id="PassSettingsManageAccount"')
        res.status == 200
        res.json().updateSuccessful == true
        signedIn(withNew)
        withOld.res.status == 401
    },
})

// The authority's sign-in route in a session of its own, which first reads the site for its session token (a browser's
// sign-in carries one); headers go on each request, as an X-Moqui-Test-Peer that the project's test server takes as the
// client's address.
const authoritySession = (headers) => {
    const s = session({ headers })
    s.get(`/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}/site`, { accept: "json" })
    return s
}
const authoritySignIn = (s, username) => s.post(`/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}/account/session`, {
    json: { username, password: "NotAPassword1!" },
    accept: "json",
})
// An address in 127.0.0.0/8 of this run alone: the project's test server counts PASS's sign-in limits by it.
const testPeer = () => `127.3.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}`

// PASS's own limit (framework service/org/moqui/public/Account.js throttle('session'), which every PASS sign-in goes
// through, the site's form and the authority's route): ten tries of one account name in ten minutes, from any client, and
// twenty tries from one client; it exempts no address. The name here is one no account has, tried ten times from one
// client and the eleventh time from another.
// Does not prove: the twenty tries a client, nor the framework's lock of an account after its failed passwords (the
// framework's proofs); in a deployment every request of a run comes from one address, which its per-client limit (the
// next proof) may answer first, so this one is the project's run.
feature("v5.0.0-6.3.1: PASS's sign-in refuses an account name after ten tries, from any client", {
    given() {
        if (profile != "fixtures") skip("a deployment takes every request of this run from one address, so its per-client limit could answer first: the project's run (--serve) proves the name limit")
    },
    when() {
        const name = `proof.unknown.${Date.now()}`
        const one = authoritySession({ "X-Moqui-Test-Peer": testPeer() })
        const first = []
        for (let i = 0; i < 10; i++) first.push(authoritySignIn(one, name).status)
        const fromAnother = authoritySignIn(authoritySession({ "X-Moqui-Test-Peer": testPeer() }), name)
        return { first, fromAnother, otherName: authoritySignIn(one, `${name}.other`) }
    },
    then({ first, fromAnother, otherName }) {
        // the control: each try is answered as a failed sign-in until the name has had ten
        first.length == 10 && first.every((status) => status == 401)
        fromAnother.status == 429
        fromAnother.json().code == "Tarpit"
        // and the first client is not limited for another name: the limit is the name's
        otherName.status == 401
    },
})

// The framework's per-client limit (webapp-list/webapp[webroot]/web-protection, rate-limit "login", ten a minute), whose
// paths name PASS's account/session and account/challenge routes; on only with web-protection@enabled or trusted-proxies,
// so Configuration. Loopback is exempt, so this is a deployment's proof, and opt-in: it gets this client's sign-ins limited
// for a minute, and its tries of unknown names count toward the auth-failure ban, so run it alone, once:
// --spec V6Authentication --feature v5.0.0-6.3.1 --param bruteForce=yes --param site=ID.
// Does not prove: the site's own sign-in form (Account/Login/save under the Account app's mount), which the rate limit's
// paths do not name and PASS's own limit covers (the proof above).
feature("v5.0.0-6.3.1: one client's sign-ins at PASS's route are limited after ten a minute", {
    given() {
        if (profile == "fixtures") skip("the project's test server takes its clients as loopback, which the per-client limits exempt: a deployment's proof")
        if (params.bruteForce != "yes") skip("opt-in, as it limits this client's sign-ins: --param bruteForce=yes, alone (--spec V6Authentication --feature v5.0.0-6.3.1)")
        if (!SITE) skip("the site's id is not known: pass --param site=ID to reach its authority's sign-in route")
    },
    when() {
        const s = authoritySession({})
        const statuses = []
        for (let i = 0; i < 11; i++) statuses.push(authoritySignIn(s, `proof.unknown.${Date.now()}.${i}`).status)
        return { statuses }
    },
    then({ statuses }) {
        // the control: the first tries are answered, as an unknown name
        statuses[0] == 401
        statuses.includes(429)
    },
})

// The Register page's address check (verify#Registration): an expired code is refused, a code with no password leaves
// the account as it is, the code with the owner's own password opens it, and the code is spent.
// Does not prove: that the code the system mails is random, 64 characters and good for an hour (begin#Registration
// makes it in-process: ClientFixtures writes two codes' digests instead, as a mailbox would hold them), nor recovery.
feature("v5.0.0-6.4.1: a registration code works once, not after expiry, and never as a password", {
    given() { needsFixtures(`the registration of ${REG_ADDRESS} waiting for its address check`) },
    when() {
        const chosen = `PassReg${Date.now() % 1000000}!a`
        const expired = verify(REG_EXPIRED_CODE, chosen)
        const noPassword = verify(REG_CODE, null)
        const first = verify(REG_CODE, chosen)
        const again = verify(REG_CODE, `${chosen}b`)
        return { expired, noPassword, first, again, withChosen: trySignIn(REG_ADDRESS, chosen), withCode: trySignIn(REG_ADDRESS, REG_CODE) }
    },
    then({ expired, noPassword, first, again, withChosen, withCode }) {
        expired.status == 404
        expired.text.includes("Verification link expired or not found")
        noPassword.status == 200
        noPassword.json().passwordRequired == true
        // the control: the live code with the owner's password opens the account, which signs in with that password
        first.status == 200
        first.json().verified == true
        signedIn(withChosen)
        again.status == 404
        withCode.res.status == 401
    },
})
