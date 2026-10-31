// The Billing and Supplier apps over HTTP, at phone width and on the desktop, on PortalFixtures' data: a customer starts
// paying through the pay link and comes back from the hosted test gateway, a supplier sends a bill through the order's link, a bad link says
// unavailable, and a signed-in contact sees its invoices.
const INVOICE_TOKEN = 'PassPortalInvoiceLinkToken0000000000000000000001'
const ORDER_TOKEN = 'PassPortalOrderLinkToken000000000000000000000001'
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
feature("a pay link at phone width starts a payment, and the provider's return never marks it paid", {
    when() {
        const page = browser.newPage({ viewport: { width: 390, height: 844 } })
        const opened = page.goto('/billing/InvoicePay?token=' + INVOICE_TOKEN)
        const invoice = { status: opened.status, text: page.text(), overflow: overflow(page) }
        page.getByRole('checkbox').click()
        page.getByRole('button', { name: 'Pay $125.00' }).click()
        page.waitFor(() => location.search.includes('attemptId='), { timeout: 15 })
        const pendingText = page.text()
        const provider = page.getByRole('link', { name: 'Continue to the payment page' }).attribute('href')
        // the provider sends the payer back to the app's return path with a claim of its own, which is not read: the
        // gateway (PortalFixtures' answers pending) decides
        page.goto(provider.replace(/^https:\/\/[^/]+/, ''))
        // the same return on another device: no session, no link token; the return's own reference reads the attempt
        const elsewhere = session().get(provider.replace(/^https:\/\/[^/]+/, ''), { follow: true })
        return {
            invoice,
            pendingText,
            provider,
            resultText: page.text(),
            resultOverflow: overflow(page),
            url: page.url(),
            elsewhere: { status: elsewhere.status, text: elsewhere.text },
        }
    },
    then({ invoice, pendingText, provider, resultText, resultOverflow, url, elsewhere }) {
        elsewhere.status === 200
        elsewhere.text.includes('not confirmed yet')
        !elsewhere.text.includes('Pay this invoice')
        invoice.status === 200
        invoice.text.includes('Due')
        invoice.text.includes('$125.00')
        invoice.text.includes('Pay this invoice')
        !invoice.text.includes('New topic')
        invoice.overflow === false
        pendingText.includes('not confirmed yet')
        provider.includes('/billing/InvoicePay/return?attemptId=')
        provider.includes('&key=')
        provider.includes('result=paid')
        resultText.includes('not confirmed yet')
        !resultText.includes('Payment received')
        resultText.includes('Check the payment again')
        !url.includes('result=paid')
        resultOverflow === false
    },
})
feature("a supplier's order link takes a bill at phone width, and a repeat answers the first submission", {
    when() {
        const page = browser.newPage({ viewport: { width: 390, height: 844 } })
        page.goto('/supplier/BillUpload?token=' + ORDER_TOKEN)
        const form = { text: page.text(), overflow: overflow(page) }
        const s = session()
        s.get('/supplier/BillUpload?token=' + ORDER_TOKEN)
        const send = (operationId) =>
            s.post('/supplier/BillUpload/submit', {
                multipart: {
                    token: ORDER_TOKEN,
                    operationId,
                    referenceNumber: 'HTTP-BILL-1',
                    amount: '99.00',
                    file: { fileName: 'bill.pdf', text: '%PDF-1.4 portal bill', contentType: 'application/pdf' },
                },
            })
        const first = send('portal-http-bill-01'),
            repeat = send('portal-http-bill-02')
        page.goto(first.location)
        return { form, first, repeat, receipt: page.text(), receiptOverflow: overflow(page) }
    },
    then({ form, first, repeat, receipt, receiptOverflow }) {
        form.text.includes('Bill for order PASS_PORTAL_PO')
        form.text.includes('Your bill number')
        form.overflow === false
        first.status === 302
        first.location.includes('submissionId=')
        repeat.location === first.location
        receipt.includes('Bill received')
        receipt.includes('HTTP-BILL-1')
        receipt.includes('Received for review')
        receiptOverflow === false
    },
})
feature('a bad link says unavailable, and a signed-in contact sees its invoices on the desktop', {
    when() {
        const bad = session().get('/billing/InvoicePay', { params: { token: 'x'.repeat(48) } })
        const page = browser.newPage({ viewport: { width: 1200, height: 900 } })
        page.goto('/account/Login')
        page.getByLabel('Email or username', { exact: true }).fill('pass.portal.payer')
        page.getByLabel('Password', { exact: true }).fill('moqui1!!')
        page.getByRole('button', { name: 'Sign in', exact: true }).click()
        page.waitFor(() => !location.pathname.startsWith('/account/Login'), { timeout: 15 })
        page.goto('/billing/Invoices')
        return { bad, text: page.text() }
    },
    then({ bad, text }) {
        bad.status === 200
        bad.text.includes('This page is not available')
        text.includes('Invoices')
        text.includes('Invoice ')
        text.includes('PASS_PORTAL customer')
    },
})
