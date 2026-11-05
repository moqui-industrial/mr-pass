feature(
    'remote frontend reads the authority without a local business catalog',
    {
        when() {
            const response = session().get('/forum')
            return { status: response.status, text: response.text }
        },
        then({ status, text }) {
            status === 200
            text.includes('Welcome to the community')
            text.includes('/t/')
        },
    },
)
feature(
    'remote password authentication keeps credentials server-side and can save a private draft',
    {
        when() {
            const page = browser.newPage()
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
            page.goto('/forum/Compose')
            page.waitFor(
                () => !!document.querySelector('[contenteditable="true"]'),
                { timeout: 30 },
            )
            const category = page.evaluate(
                () =>
                    document.querySelector('select option:nth-child(2)').value,
            )
            page.locator('select').evaluate((element, value) => {
                element.value = value
                element.dispatchEvent(new Event('change', { bubbles: true }))
            }, category)
            page.getByLabel('Title', { exact: true }).fill(
                'Remote authority draft',
            )
            page.locator('[contenteditable="true"]').fill(
                'Saved through the server-side delegation.',
            )
            page.waitFor(
                () => document.body.innerText.includes('Draft saved.'),
                { timeout: 30 },
            )
            page.goto('/forum/Drafts')
            return {
                text: page.text(),
                html: page.evaluate(() => document.documentElement.outerHTML),
            }
        },
        then({ text, html }) {
            text.includes('Remote authority draft')
            !html.includes('passDelegation')
            !html.includes('test-deployment-secret')
        },
    },
)
feature(
    'remote multipart media is scanned, finalized, downloaded and concealed after revocation',
    {
        when() {
            const s = session()
            s.get('/account/Login')
            const login = s.post('/account/Login/save', {
                form: {
                    formAction: 'startSession',
                    username: 'john.doe',
                    password: 'moqui',
                },
            })
            const state = s.get('/forum/Compose/state').json(),
                contactListId = state.categories[0].contactListId
            const uploaded = s.post('/forum/Compose/upload', {
                multipart: {
                    contactListId,
                    file: {
                        fileName: 'remote.txt',
                        text: 'Remote streamed attachment',
                        contentType: 'text/plain',
                    },
                },
            })
            if (uploaded.status !== 200)
                return {
                    login: login.status,
                    upload: uploaded.status,
                    body: uploaded.text,
                }
            const attachment = uploaded.json().attachment
            const image = s
                .post('/forum/Compose/upload', {
                    multipart: {
                        contactListId,
                        file: {
                            fileName: 'pixel.png',
                            base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQMgn7DwAClAGcHVtGXwAAAABJRU5ErkJggg==',
                            contentType: 'image/png',
                        },
                    },
                })
                .json().attachment
            const published = s.post('/forum/Compose/publish', {
                json: {
                    contactListId,
                    title: 'Remote media',
                    body: 'A protected attachment',
                    operationId: 'remote-media-001',
                    attachmentIds: [
                        attachment.attachmentId,
                        image.attachmentId,
                    ],
                },
            })
            if (published.status !== 200)
                return {
                    login: login.status,
                    upload: uploaded.status,
                    publish: published.status,
                    body: published.text,
                }
            const root = published.json().rootCommEventId,
                path =
                    '/forum/t/' +
                    root +
                    '/remote-media/download?attachmentId=' +
                    attachment.attachmentId
            const thumbnail = s.get(
                '/forum/t/' +
                    root +
                    '/remote-media/download?attachmentId=' +
                    image.attachmentId +
                    '&variant=thumbnail',
            )
            // a build without image support answers the thumbnail 503; the feature needs it
            if (thumbnail.status === 503) skip('image derivatives are unavailable in this build (impl-accounting F377): run with an image-enabled build, ./moq build -- --features moqui-host/image')
            const downloaded = s.get(path),
                changed = s.post('/forum/Settings/Categories/save', {
                    form: {
                        formAction: 'setCategoryAccess',
                        contactListId,
                        visibility: 'members',
                        publicationState: 'published',
                        expectedRevision: 2,
                        confirm: 'true',
                    },
                }),
                hidden = session().get(path)
            return {
                login: login.status,
                upload: uploaded.status,
                publish: published.status,
                clean: attachment.scanState,
                download: downloaded.status,
                body: downloaded.text,
                changed: changed.status,
                hidden: hidden.status,
                thumbnail: thumbnail.status,
                imageType: thumbnail.header('content-type'),
            }
        },
        then({
            login,
            upload,
            publish,
            clean,
            download,
            body,
            changed,
            hidden,
            thumbnail,
            imageType,
        }) {
            login === 302
            upload === 200
            publish === 200
            clean === 'clean'
            download === 200
            body === 'Remote streamed attachment'
            changed === 302
            hidden === 404
            thumbnail === 200
            imageType === 'image/png'
        },
    },
)
feature(
    'remote profile images are scanned and obey current profile visibility',
    {
        when() {
            const s = session()
            s.get('/account/Login')
            s.post('/account/Login/save', {
                form: {
                    formAction: 'startSession',
                    username: 'john.doe',
                    password: 'moqui',
                },
            })
            const saved = s.post('/account/Settings/save', {
                form: {
                    formAction: 'storeProfile',
                    handle: 'remote-owner',
                    displayName: 'Remote owner',
                    discoverability: 'public',
                    expectedRevision: 0,
                },
            })
            const uploaded = s.post('/account/Settings/avatar', {
                multipart: {
                    file: {
                        fileName: 'avatar.png',
                        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQMgn7DwAClAGcHVtGXwAAAABJRU5ErkJggg==',
                        contentType: 'image/png',
                    },
                },
            })
            const profile = s.get('/members/MemberDetail?handle=remote-owner')
            const match = profile.text.match(
                /src="([^\"]*MemberDetail\/download[^\"]*)"/,
            )
            if (!match)
                return {
                    saved: saved.status,
                    uploaded: uploaded.status,
                    profile: profile.status,
                    html: profile.text,
                }
            const path = match[1].replace(/&amp;/g, '&'),
                image = session().get(path)
            if (image.status === 503) skip('image derivatives are unavailable in this build (impl-accounting F377): run with an image-enabled build, ./moq build -- --features moqui-host/image')
            const changed = s.post('/account/Settings/save', {
                form: {
                    formAction: 'storeProfile',
                    handle: 'remote-owner',
                    displayName: 'Remote owner',
                    discoverability: 'hidden',
                    expectedRevision: 2,
                },
            })
            return {
                saved: saved.status,
                uploaded: uploaded.status,
                profile: profile.status,
                image: image.status,
                type: image.header('content-type'),
                changed: changed.status,
                hidden: session().get(path).status,
            }
        },
        then({ saved, uploaded, profile, image, type, changed, hidden }) {
            saved === 302
            uploaded === 302
            profile === 200
            image === 200
            type === 'image/png'
            changed === 302
            hidden === 404
        },
    },
)
feature(
    'stage 2 reading and private messages work through the remote adapter',
    {
        when() {
            const page = browser.newPage()
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            const tags = page.goto('/forum/Tags').status
            const bookmarks = page.goto('/forum/Bookmarks').status
            page.goto('/forum/Messages')
            page.getByLabel('To (member handles, comma separated)', {
                exact: true,
            }).fill('reader')
            page.getByLabel('Subject', { exact: true }).fill('Remote hello')
            page.getByLabel('Message', { exact: true }).fill(
                'Sent through the remote frontend.',
            )
            // Earlier features posted as this member; wait out the posting interval.
            page.evaluate(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(true), 10500),
                    ),
            )
            page.getByRole('button', {
                name: 'New private message',
                exact: true,
            }).click()
            page.waitForURL(/saved=true/, { timeout: 20 })
            return { tags, bookmarks, text: page.text() }
        },
        then({ tags, bookmarks, text }) {
            tags === 200
            bookmarks === 200
            text.includes('Remote hello')
        },
    },
)
feature(
    "remote Billing and Supplier pages read a link's record, start its payment and take a supplier's bill",
    {
        when() {
            // PortalFixtures' links (its invoice for this spec; PortalHttp pays the other one first in the standard run),
            // served through this frontend: with no local Mantle in the remote pair, or by the suite's own server
            const invoiceToken = 'PassPortalRemoteInvoiceLinkToken0000000000000001',
                orderToken = 'PassPortalOrderLinkToken000000000000000000000001'
            const s = session()
            const invoice = s.get('/billing/InvoicePay', { params: { token: invoiceToken } })
            const paid = s.post('/billing/InvoicePay/pay', {
                form: { token: invoiceToken, operationId: 'remote-pay-000001', confirm: 'true' },
            })
            const result = s.get(paid.location)
            const bad = s.get('/billing/InvoicePay', { params: { token: 'x'.repeat(48) } })
            s.get('/supplier/BillUpload', { params: { token: orderToken } })
            const sent = s.post('/supplier/BillUpload/submit', {
                multipart: {
                    token: orderToken,
                    operationId: 'remote-bill-000001',
                    referenceNumber: 'REMOTE-BILL-1',
                    amount: '42.00',
                    file: { fileName: 'remote-bill.pdf', text: '%PDF-1.4 remote bill', contentType: 'application/pdf' },
                },
            })
            const receipt = s.get(sent.location)
            return { invoice, paid, result, bad, sent, receipt }
        },
        then({ invoice, paid, result, bad, sent, receipt }) {
            invoice.status === 200
            invoice.text.includes('Pay this invoice')
            paid.status === 302
            paid.location.includes('attemptId=')
            result.text.includes('not confirmed yet')
            bad.text.includes('This page is not available')
            sent.status === 302
            sent.location.includes('submissionId=')
            receipt.text.includes('Bill received')
            receipt.text.includes('REMOTE-BILL-1')
        },
    },
)
feature(
    "remote Supplier pages read a quote's and an order's link, take the supplier's quote and acknowledgement, and say an older revision's link is superseded",
    {
        when() {
            // SupplierPortalFixtures' remote documents, served through this frontend: with no local Mantle in the remote
            // pair, or by the suite's own server
            const token = (name) => ('PASS_HTTP_RSUP' + name + '0'.repeat(48)).slice(0, 48)
            const s = session()
            const quote = s.get('/supplier/QuoteResponse', { params: { token: token('QuoteLink') } })
            const sent = s.post('/supplier/QuoteResponse/respond', {
                multipart: {
                    token: token('QuoteLink'),
                    operationId: 'remote-quote-000001',
                    formAction: 'send',
                    confirm: 'true',
                    lineSeqs: '01',
                    price_01: '2.50',
                    otherPartyOrderId: 'REMOTE-Q-1',
                    file: { fileName: 'remote-quote.pdf', text: '%PDF-1.4 remote quote', contentType: 'application/pdf' },
                },
            })
            const received = s.get(sent.location)
            const order = s.get('/supplier/OrderAcknowledgement', { params: { token: token('OrderLinkRev2') } })
            const acknowledged = s.post('/supplier/OrderAcknowledgement/acknowledge', {
                form: { token: token('OrderLinkRev2'), operationId: 'remote-ack-000001', orderRevision: '2', outcome: 'accept', lineSeqs: '01,02' },
            })
            const after = s.get(acknowledged.location)
            const superseded = s.get('/supplier/OrderAcknowledgement', { params: { token: token('OrderLinkRev1') } })
            return { quote, sent, received, order, after, superseded }
        },
        then({ quote, sent, received, order, after, superseded }) {
            quote.status === 200
            quote.text.includes('Request for quotation PASS_HTTP_RSUP_RFQ')
            !quote.text.includes('Rival Brackets')
            sent.status === 302
            received.text.includes('Quote received')
            received.text.includes('REMOTE-Q-1')
            order.text.includes('Purchase order PASS_HTTP_RSUP_PO')
            after.text.includes('Acknowledged')
            after.text.includes('Accepted')
            superseded.text.includes('has since been revised')
        },
    },
)
feature(
    "a remote Support page reads a feedback link, takes the customer's rating once and shows only guidance for a bad link",
    {
        when() {
            // SupportFixtures' remote invitation, served through this frontend: with no local Mantle in the remote pair, or
            // by the suite's own server; the authority keeps the one response
            const token = (name) => ('PASS_HTTP_RFB' + name + '0'.repeat(48)).slice(0, 48)
            const s = session()
            const page = s.get('/support/Feedback', { params: { token: token('FeedbackLink') } })
            const sent = s.post('/support/Feedback/submit', {
                form: {
                    token: token('FeedbackLink'),
                    operationId: 'remote-feedback-000001',
                    fieldNames: 'rating,comment',
                    rating: '2',
                    comment: 'Remote: slow to answer',
                },
            })
            const receipt = s.get(sent.location)
            const repeat = s.post('/support/Feedback/submit', {
                form: { token: token('FeedbackLink'), operationId: 'remote-feedback-000002', fieldNames: 'rating', rating: '5' },
            })
            const after = s.get(repeat.location)
            const bad = s.get('/support/Feedback', { params: { token: token('ExpiredLink') } })
            return { page, sent, receipt, after, bad }
        },
        then({ page, sent, receipt, after, bad }) {
            page.status === 200
            page.text.includes('How did we do?')
            !page.text.includes('Thermostat reads two degrees high')
            sent.status === 302
            receipt.text.includes('Thank you')
            receipt.text.includes('2 of 5')
            after.text.includes('2 of 5')
            bad.text.includes('This feedback link is not available')
        },
    },
)
feature(
    "a remote Support page reads a case's link and takes the customer's reply, an RMA link reads the return, and its label downloads",
    {
        when() {
            // SupportFixtures' remote Support pages data (Customer Service P15), served through this frontend
            const token = (name) => ('PASS_HTTP_RSP' + name + '0'.repeat(48)).slice(0, 48)
            const s = session()
            const page = s.get('/support/CustomerCase', { params: { token: token('CaseLink') } })
            const sent = s.post('/support/CustomerCase/reply', {
                form: { token: token('CaseLink'), operationId: 'remote-case-reply-0001', body: 'Remote: any news?' },
            })
            const after = s.get(sent.location)
            const rma = s.get('/support/CustomerReturn', { params: { token: token('RmaLink') } })
            const bad = s.get('/support/CustomerCase', { params: { token: 'x'.repeat(48) } })
            // the return label streamed through this frontend from the authority (Transport.downloadOperation)
            const label = s.get('/support/CustomerReturn/label', { params: { token: token('LabelLink') } })
            return {
                page,
                sent,
                after,
                rma,
                bad,
                label: { status: label.status, type: label.header('content-type'), text: label.text },
            }
        },
        then({ page, sent, after, rma, bad, label }) {
            page.status === 200
            page.text.includes('About OWN')
            sent.status === 302
            after.text.includes('Remote: any news?')
            rma.text.includes('Return PASS_HTTP_RSP_RET')
            bad.text.includes('This case is not available')
            label.status === 200
            String(label.type).startsWith('application/pdf')
            label.text.startsWith('%PDF-1.4')
        },
    },
)
