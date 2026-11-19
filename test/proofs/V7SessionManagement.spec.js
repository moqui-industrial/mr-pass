// OWASP ASVS 5.0.0 V7 Session Management: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V7). They sign in and out through the site's Account app, as its visitors do, and 7.4.3 also at
// the authority's account route, as a registered frontend does. A sign-out ends every session of the account (the
// framework's logoutUser, and on a remote frontend the revoked delegation) and a password change ends them too, so this
// file runs last in the suite.

// Where the site mounts the Account app: /account on the fixtures' PASS_HTTP site; a deployment that mounts it elsewhere
// passes --param accountPath=/path.
const ACCOUNT = (params.accountPath ?? "/account").replace(/\/+$/, "")

// The account a proof signs in with: the run's (--param user=NAME, its password in MOQUI_TEST_PASSWORD), else in the
// fixtures profile ClientFixtures' member pass.http.reader.
const account = () => {
    if (params.user) return { username: params.user, password: params.password ?? "" }
    needsFixtures("an account to sign in with (or --param user=NAME and MOQUI_TEST_PASSWORD)")
    return { username: "pass.http.reader", password: "moqui1!!" }
}
// A session signed in through the site's sign-in form, which answers a redirect away from it.
const signIn = (username, password) => {
    const s = session()
    const page = s.get(`${ACCOUNT}/Login`)
    assert(page.status == 200, `GET ${ACCOUNT}/Login answered ${page.status}`)
    const res = s.post(`${ACCOUNT}/Login/save`, { form: { formAction: "startSession", username, password } })
    assert(res.status == 302 && !(res.location ?? "").includes("/Login"),
        `the sign-in of ${username} did not succeed: HTTP ${res.status} ${res.text.slice(0, 200)}`)
    return s
}
// Settings as a signed-in visitor sees it: with its Change password form, which a visitor not signed in is not offered.
const signedIn = (res) => res.status == 200 && res.text.includes('id="PassSettingsManageAccount"')

// Settings' Sign out form (formAction endSession), then the signed-out session's cookies sent again from elsewhere.
// Does not prove: that a session ends when it idles (V7.3), nor what the authority does with a remote frontend's
// revoked delegation, which the frontend drops at sign-out and so never sends again.
feature("v5.0.0-7.4.1: a session signed out on Settings does not sign in again", {
    when() {
        const { username, password } = account()
        const s = signIn(username, password)
        const cookie = s.cookies().map((c) => `${c.name}=${c.value}`).join("; ")
        const replay = () => session({ headers: { Cookie: cookie } }).get(`${ACCOUNT}/Settings`)
        const before = replay()
        const out = s.post(`${ACCOUNT}/Settings/save`, { form: { formAction: "endSession" } })
        const replayed = replay()
        return { before, out, replayed, after: s.get(`${ACCOUNT}/Settings`) }
    },
    then({ before, out, replayed, after }) {
        // the control: before the sign-out the same cookies, sent the same way, were signed in
        signedIn(before)
        out.status == 302
        replayed.status == 200
        !signedIn(replayed)
        replayed.text.includes("Sign in to continue")
        !signedIn(after)
    },
})

// Level 2 (P5). ClientFixtures' pass.session.proof: its password is set again on every run, and the 7.4.3 proof changes it.
const SESSION_USER = "pass.session.proof"
const SESSION_PASSWORD = "PassSessionProof1!!"
// In the fixtures profile a session names an address of its own in 127.0.0.0/8 (X-Moqui-Test-Peer, which only the
// project's test server reads), so PASS's sign-in limit per client counts these proofs apart from the rest of the run.
const peerHeaders = () =>
    profile == "fixtures"
        ? { "X-Moqui-Test-Peer": `127.10.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}` }
        : {}
const signInAs = (username, password) => {
    const s = session({ headers: peerHeaders() })
    s.get(`${ACCOUNT}/Login`)
    const res = s.post(`${ACCOUNT}/Login/save`, { form: { formAction: "startSession", username, password } })
    assert(res.status == 302 && !(res.location ?? "").includes("/Login"),
        `the sign-in of ${username} did not succeed: HTTP ${res.status} ${res.text.slice(0, 200)}`)
    return s
}
// Settings as a signed-in visitor sees it: with its Change password form.
const settingsSignedIn = (s) => signedIn(s.get(`${ACCOUNT}/Settings`))
const changePassword = (s, oldPassword, newPassword) => s.post(`${ACCOUNT}/Settings/save`, {
    form: { formAction: "manageAccount", action: "password", oldPassword, newPassword, newPasswordVerify: newPassword },
    accept: "json",
})
// The site's id and the authority's REST API, for the delegation a registered PASS frontend holds: the fixtures' client
// test (test/MoquiConf.xml), or a deployment's --param clientId=ID with its secret in MOQUI_TEST_CLIENT_SECRET.
const SITE = params.site ?? (profile == "fixtures" ? "PASS_HTTP" : null)
const CLIENT = params.clientId
    ? { id: params.clientId, secret: params.clientSecret ?? "" }
    : profile == "fixtures"
      ? { id: "test", secret: "test-deployment-secret" }
      : null
const authority = () => `${(params.authorityUrl ?? "").replace(/\/+$/, "")}/rest/s1/pass/v1/sites/${encodeURIComponent(SITE)}`

// PASS changes no recovery or factor data but the password (Settings' Change password, manage#Account), and that only
// with the current password: a wrong one is refused and the password stays. The control: the right current password is
// taken, shown by the next rule's refusal (a new password too short), which changes nothing either. In a deployment the run's
// account takes one wrong current password, which counts as one failed sign-in (its next sign-in clears it).
// Does not prove: Smithy's git keys and access tokens, which need a sign-in in the last minutes (SmithyGit.js
// reauthenticate), a time this run does not wait out.
feature("v5.0.0-7.5.1: a password change on Settings needs the current password", {
    when() {
        const fixtures = profile == "fixtures"
        if (!fixtures && !params.user) skip("needs an account: --param user=NAME and MOQUI_TEST_PASSWORD")
        const username = fixtures ? SESSION_USER : params.user
        const password = fixtures ? SESSION_PASSWORD : params.password ?? ""
        const s = signInAs(username, password)
        const wrong = changePassword(s, `${password}x`, "PassReauthProof7!!")
        const short = changePassword(s, password, "a1!")
        return { wrong, short }
    },
    then({ wrong, short }) {
        wrong.status == 200
        wrong.json().updateSuccessful === false
        String(wrong.json().messages).includes("Password could not be updated with the information provided")
        // the control: the current password passes, and the new password's rule refuses the change
        short.status == 422
        short.text.includes("Found issues with password")
    },
})

// A new password on Settings ends the account's other sessions on the site (the framework's password change) and every
// delegation the authority issued to a remote PASS frontend for it (framework service/org/moqui/public/Account.js
// authenticateDelegation: the account's password stamp no longer matches). The delegation here is the one a registered
// frontend gets when it signs the account in at the authority's account route. PASS ends them all: no choice is offered.
// Does not prove: a remote frontend's own session, which drops its delegation when the authority refuses it.
feature("v5.0.0-7.4.3: a new password ends the account's other sessions and its delegations", {
    given() { needsFixtures(`the user ${SESSION_USER}, whose password this proof changes`) },
    when() {
        const changer = signInAs(SESSION_USER, SESSION_PASSWORD)
        const other = signInAs(SESSION_USER, SESSION_PASSWORD)
        const api = authority()
        const frontend = { "x-pass-client": CLIENT.id, "x-pass-client-secret": CLIENT.secret, "x-pass-client-ip": "198.51.100.74" }
        const issued = session({ headers: Object.assign(peerHeaders(), frontend) })
            .post(`${api}/account/session`, { json: { username: SESSION_USER, password: SESSION_PASSWORD }, accept: "json" })
        assert(issued.status == 200 && issued.json().credential, `no delegation was issued: HTTP ${issued.status} ${issued.text.slice(0, 200)}`)
        const delegated = () => session({ headers: Object.assign(peerHeaders(), frontend, { Authorization: `Bearer ${issued.json().credential}` }) })
            .get(`${api}/me/drafts`, { accept: "json" })
        const before = { other: settingsSignedIn(other), delegation: delegated() }
        const changed = changePassword(changer, SESSION_PASSWORD, `PassSession${Date.now() % 1000000}!a`)
        return { before, changed, after: { other: settingsSignedIn(other), delegation: delegated() } }
    },
    then({ before, changed, after }) {
        // the control: before the change the other session and the delegation were signed in
        before.other
        before.delegation.status == 200
        changed.json().updateSuccessful == true
        !after.other
        after.delegation.status == 401
    },
})
