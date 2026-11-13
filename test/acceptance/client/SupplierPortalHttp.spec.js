// Purchasing's Supplier pages over HTTP (impl-purchasing P16, the usable-when items), on SupplierPortalFixtures' data: an
// invited supplier opens the RFQ link at phone width, saves a draft and sends its quote, and a repeated send answers the
// first receipt; it acknowledges revision 2 of a purchase order on the desktop with a later date, which goes to the buyer
// for review and changes no quantity, revision 1's link answers SupersededRevision, and the same link opens BillUpload; a
// bad link shows nothing; a signed-in supplier contact sees only its own documents.
const token = (name) => ('PASS_HTTP_SUP' + name + '0'.repeat(48)).slice(0, 48)
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
feature(
    'an invited supplier answers the RFQ link at phone width: a draft, then the quote, and a repeat answers the first receipt',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            const opened = page.goto(
                '/supplier/QuoteResponse?token=' + token('QuoteLink'),
            )
            const request = {
                status: opened.status,
                text: page.text(),
                overflow: overflow(page),
            }
            page.getByLabel('Unit price (USD)').fill('2.15')
            page.getByLabel('Your quote reference').fill('RB-2207')
            page.getByRole('button', { name: 'Save draft' }).click()
            page.waitFor(
                () => document.body.innerText.includes('Draft saved'),
                { timeout: 15 },
            )
            const drafted = {
                text: page.text(),
                price: page.getByLabel('Unit price (USD)').value(),
            }
            page.getByRole('checkbox').click()
            page.getByRole('button', { name: 'Send quote' }).click()
            page.waitFor(
                () => document.body.innerText.includes('Quote received'),
                { timeout: 15 },
            )
            const received = { text: page.text(), overflow: overflow(page) }
            // the same send again (a second tab, a double submit): the first receipt, nothing changed
            const s = session()
            s.get('/supplier/QuoteResponse?token=' + token('QuoteLink'))
            const repeat = s.post('/supplier/QuoteResponse/respond', {
                multipart: {
                    token: token('QuoteLink'),
                    operationId: 'supplier-http-repeat-01',
                    formAction: 'send',
                    confirm: 'true',
                    lineSeqs: '01',
                    price_01: '1.00',
                },
            })
            const after = s.get('/supplier/QuoteResponse', {
                params: { token: token('QuoteLink') },
            })
            return { request, drafted, received, repeat, after }
        },
        then({ request, drafted, received, repeat, after }) {
            request.status === 200
            request.text.includes('Request for quotation PASS_HTTP_SUP_RFQ')
            request.text.includes('Powder-coated steel')
            !request.text.includes('Rival Brackets')
            request.overflow === false
            drafted.text.includes('Draft saved')
            drafted.price === '2.15'
            received.text.includes('Quote received')
            received.text.includes('RB-2207')
            received.text.includes('$86.00')
            !received.text.includes('Send quote')
            received.overflow === false
            repeat.status === 302
            after.text.includes('Quote received')
            after.text.includes('$86.00')
        },
    },
)
feature(
    'the order link on the desktop: a later promise goes to the buyer, revision 1 is superseded, the same link sends a bill',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 1200, height: 900 },
            })
            page.goto(
                '/supplier/OrderAcknowledgement?token=' +
                    token('OrderLinkRev2'),
            )
            const order = page.text()
            page.getByRole('radio', {
                name: 'Accept with changes (give the reason)',
            }).click()
            // a date input takes its value as the browser's picker sets it
            page.locator('input[name="promised_01"]').evaluate(
                (el, value) => (el.value = value),
                '2026-12-22',
            )
            page.getByLabel('Your order reference').fill('SO-88')
            page.getByLabel('Reason or note').fill(
                'Brackets ship three weeks later',
            )
            page.getByRole('button', { name: 'Send acknowledgement' }).click()
            page.waitFor(
                () => document.body.innerText.includes('Acknowledged'),
                { timeout: 15 },
            )
            const acknowledged = page.text()
            const s = session()
            const superseded = s.get('/supplier/OrderAcknowledgement', {
                params: { token: token('OrderLinkRev1') },
            })
            const bill = s.get('/supplier/BillUpload', {
                params: { token: token('OrderLinkRev2') },
            })
            return { order, acknowledged, superseded, bill }
        },
        then({ order, acknowledged, superseded, bill }) {
            order.includes('Purchase order PASS_HTTP_SUP_PO')
            order.includes('Revision 2')
            order.includes('Wall anchor')
            acknowledged.includes('Accepted with changes')
            acknowledged.includes('SO-88')
            acknowledged.includes('2026-12-22')
            acknowledged.includes('40')
            !acknowledged.includes('Send acknowledgement')
            superseded.status === 200
            superseded.text.includes('has since been revised')
            !superseded.text.includes('Wall anchor')
            bill.text.includes('Bill for order PASS_HTTP_SUP_PO')
            bill.text.includes('Your bill number')
        },
    },
)
feature(
    'a bad link shows nothing, and a signed-in supplier contact sees only its own documents',
    {
        when() {
            const bad = session().get('/supplier/QuoteResponse', {
                params: { token: 'x'.repeat(48) },
            })
            const page = browser.newPage({
                viewport: { width: 1200, height: 900 },
            })
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'pass.portal.supplier',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui1!!')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitFor(
                () => !location.pathname.startsWith('/account/Login'),
                { timeout: 15 },
            )
            page.goto('/supplier/SupplierHome')
            const home = page.text()
            page.goto(
                '/supplier/QuoteResponse?orderId=PASS_HTTP_SUP_QUOTE_RIVAL',
            )
            return { bad, home, rival: page.text() }
        },
        then({ bad, home, rival }) {
            bad.status === 200
            bad.text.includes('This page is not available')
            !bad.text.includes('PASS_HTTP_SUP')
            home.includes('Supplier documents')
            home.includes('Purchase order PASS_HTTP_SUP_PO')
            home.includes('Request for quotation PASS_HTTP_SUP_RFQ')
            !home.includes('Rival Brackets')
            !home.includes('PASS_HTTP_SUP_QUOTE_RIVAL')
            rival.includes('This page is not available')
        },
    },
)
