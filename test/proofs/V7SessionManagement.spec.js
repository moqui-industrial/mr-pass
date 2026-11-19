// OWASP ASVS 5.0.0 V7 Session Management: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V7). They sign in and out through the site's Account app, as its visitors do. A sign-out ends
// every session of the account (the framework's logoutUser, and on a remote frontend the revoked delegation), so this
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
