// The Support app's Feedback page over HTTP (impl-customer-service P13, the usable-when items), on SupportFixtures' links: a
// mail scanner's GETs submit nothing; the customer opens the link at phone width, the comment shows once a rating is chosen
// and is required for a low one (moqui-form-when.js in the browser, the authority again), rates 2 with a comment and sees the
// receipt, and a repeat post answers the first; an expired, withdrawn or forged link shows only guidance.
const token = (name) => ('PASS_HTTP_FB' + name + '0'.repeat(48)).slice(0, 48)
const overflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
feature(
    'a scanner reads the link twice and nothing is answered; the customer rates 2 with a comment at phone width',
    {
        when() {
            const scanner = session()
            const scan = () => {
                const response = scanner.get('/support/Feedback', {
                    params: { token: token('FeedbackLink') },
                })
                return (
                    response.status === 200 &&
                    response.text.includes('Send my answer')
                )
            }
            const scans = { first: scan(), second: scan() }
            const page = browser.newPage({
                viewport: { width: 390, height: 844 },
            })
            page.goto('/support/Feedback?token=' + token('FeedbackLink'))
            const opened = {
                text: page.text(),
                overflow: overflow(page),
                commentHidden: page.evaluate(
                    () => document.getElementById('field_comment').hidden,
                ),
            }
            page.getByLabel('2 - Dissatisfied').click()
            const rated = page.evaluate(() => ({
                hidden: document.getElementById('field_comment').hidden,
                required: document.querySelector('textarea[name=comment]')
                    .required,
            }))
            page.getByLabel('What could we have done better?').fill(
                'It took a week to hear back',
            )
            page.getByRole('button', { name: 'Send my answer' }).click()
            page.waitFor(() => document.body.innerText.includes('Thank you'), {
                timeout: 15,
            })
            const received = { text: page.text(), overflow: overflow(page) }
            const s = session()
            s.get('/support/Feedback', {
                params: { token: token('FeedbackLink') },
            })
            const repeat = s.post('/support/Feedback/submit', {
                form: {
                    token: token('FeedbackLink'),
                    operationId: 'feedback-http-repeat-01',
                    fieldNames: 'rating',
                    rating: '5',
                },
            })
            const after = s.get('/support/Feedback', {
                params: { token: token('FeedbackLink') },
            })
            return { scans, opened, rated, received, repeat, after }
        },
        then({ scans, opened, rated, received, repeat, after }) {
            scans.first === true
            scans.second === true
            opened.text.includes('How did we do?')
            opened.text.includes('Feedback Customer Co')
            !opened.text.includes('Thermostat reads two degrees high')
            opened.overflow === false
            opened.commentHidden === true
            rated.hidden === false
            rated.required === true
            received.text.includes('Thank you')
            received.text.includes('2 of 5')
            received.overflow === false
            repeat.status === 302
            after.text.includes('2 of 5')
            !after.text.includes('Send my answer')
        },
    },
)
feature('an expired, withdrawn or forged link shows only guidance', {
    when() {
        const s = session()
        const read = (name) =>
            s.get('/support/Feedback', { params: { token: token(name) } }).text
        const texts = {
            expired: read('ExpiredLink'),
            withdrawn: read('WithdrawnLink'),
            forged: read('NoSuchLink'),
        }
        const guidance = Object.values(texts).filter((text) =>
            text.includes('This feedback link is not available'),
        ).length
        const named = Object.values(texts).filter((text) =>
            text.includes('Feedback Customer Co'),
        ).length
        return { guidance, named }
    },
    then({ guidance, named }) {
        guidance === 3
        named === 0
    },
})
