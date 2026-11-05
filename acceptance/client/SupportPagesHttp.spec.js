// The Support app's customer pages over HTTP (impl-customer-service P15, the usable-when items), on SupportFixtures' Support
// pages data: the invited contact signs in at phone width, sees only its own case in My cases, opens it, replies and sees its
// message, and files a new request that lands on its case page; a colleague's case by its address shows nothing of it; the
// case's link reads it signed out on the desktop; the RMA link shows the return and the customer withdraws it before receipt;
// a visitor sees the help home and is asked to sign in to contact support; a forged link shows only guidance.
const token = (name) => ('PASS_HTTP_SP' + name + '0'.repeat(48)).slice(0, 48)
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
function signIn(page, username) {
    page.goto('/account/Login')
    page.getByLabel('Email or username', { exact: true }).fill(username)
    page.getByLabel('Password', { exact: true }).fill('moqui')
    page.getByRole('button', { name: 'Sign in', exact: true }).click()
    page.waitFor(() => !location.pathname.startsWith('/account/Login'), {
        timeout: 15,
    })
}
feature(
    'the contact signs in at phone width, follows its own case, replies and files a new request',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            signIn(page, 'pass_http_sp_contact')
            page.goto('/support/MyCases')
            const list = { text: page.text(), overflow: overflow(page) }
            page.goto('/support/CustomerCase?requestId=PASS_HTTP_SP_OWN')
            const opened = { text: page.text(), overflow: overflow(page) }
            page.getByLabel('Your message').fill('Still waiting for the filter')
            page.getByRole('button', { name: 'Send', exact: true }).click()
            page.waitFor(
                () => document.body.innerText.includes('Your message is sent'),
                { timeout: 15 },
            )
            const replied = page.text()
            page.goto('/support/CustomerCase?requestId=PASS_HTTP_SP_COLLEAGUE')
            const colleague = page.text()
            page.goto('/support/NewCustomerCase')
            const form = { text: page.text(), overflow: overflow(page) }
            page.getByLabel('Subject *').fill('Wrong filter size sent')
            page.getByLabel('What do you need? *').fill(
                'We received 16x20 instead of 16x25',
            )
            page.getByRole('button', { name: 'Send request' }).click()
            page.waitFor(
                () => location.pathname.endsWith('/CustomerCase'),
                { timeout: 15 },
            )
            const filed = { text: page.text(), path: page.evaluate(() => location.search) }
            return { list, opened, replied, colleague, form, filed }
        },
        then({ list, opened, replied, colleague, form, filed }) {
            list.text.includes('Case OWN')
            !list.text.includes('Case COLLEAGUE')
            list.overflow === false
            opened.text.includes('About OWN')
            opened.text.includes('Received')
            opened.overflow === false
            replied.includes('Still waiting for the filter')
            colleague.includes('This case is not available')
            !colleague.includes('About COLLEAGUE')
            form.text.includes('Your request')
            form.overflow === false
            filed.text.includes('Wrong filter size sent')
            filed.path.includes('requestId=')
        },
    },
)
feature(
    "a case's link reads it signed out; the RMA link shows the return, which the customer withdraws; a visitor and a forged link",
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 1200, height: 900 },
            })
            page.goto('/support/CustomerCase?token=' + token('CaseLink'))
            const byLink = page.text()
            page.goto('/support/CustomerReturn?token=' + token('RmaLink'))
            const rma = { text: page.text(), overflow: overflow(page) }
            page.getByRole('button', { name: 'Withdraw this return' }).click()
            page.waitFor(
                () => document.body.innerText.includes('is withdrawn'),
                { timeout: 15 },
            )
            const withdrawn = page.text()
            const s = session()
            const home = s.get('/support/SupportHome').text
            const contact = s.get('/support/NewCustomerCase').text
            const forged = s.get('/support/CustomerCase', {
                params: { token: 'x'.repeat(48) },
            }).text
            return { byLink, rma, withdrawn, home, contact, forged }
        },
        then({ byLink, rma, withdrawn, home, contact, forged }) {
            byLink.includes('About OWN')
            rma.text.includes('Return PASS_HTTP_SP_RET')
            rma.text.includes('Requested')
            rma.text.includes('Furnace filter 16x25')
            withdrawn.includes('Your return request is withdrawn')
            !withdrawn.includes('Withdraw this return')
            !withdrawn.includes('Furnace filter 16x25')
            home.includes('Help from')
            home.includes('Sign in')
            contact.includes('Sign in to send us a request')
            forged.includes('This case is not available')
            !forged.includes('PASS_HTTP_SP')
        },
    },
)
