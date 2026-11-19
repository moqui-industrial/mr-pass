// OWASP ASVS 5.0.0 V6 Authentication: PASS's proofs, each feature filed under the requirement its name starts with
// (docs/ASVS-Matrix.md, V6). They go through the site's Account app, as its visitors do: Login, Settings and Register.
// Both need accounts of test/ClientFixtures.spec.js that a proof may change, so they skip in the deployment profile.

// Where the site mounts the Account app: /account on the fixtures' PASS_HTTP site; a deployment that mounts it elsewhere
// passes --param accountPath=/path.
const ACCOUNT = (params.accountPath ?? "/account").replace(/\/+$/, "")
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
