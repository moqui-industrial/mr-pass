// The Support app's Feedback page (impl-customer-service P13; design-customer-service §8 Feedback): the invitation's link shows
// the feedback form, the organization's name and the customer's label, never the case, and a GET submits nothing; a forged,
// expired or withdrawn link shows only guidance; an answer through the facade is checked by the authority (the rule that
// requires a comment for a low rating), kept once, a repeat answering the first, and the page then shows its receipt.
// Mantle's CaseFeedback spec covers the rules; the acceptance walks (SupportFeedbackHttp, RemoteHttp) post through the page.
const fixtures = () =>
    ec.resource.script('component://mr-pass/test/Support/SupportFixtures.js')
const siteId = 'PASS_SUPPORT_PAGES'
let docs
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            path,
            {
                resolvedSiteId: siteId,
                publicHost: 'support.example.test',
                publicPath: '/' + path.toLowerCase(),
                ...parameters,
            },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
function submit(values) {
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({
                operation: 'submitCaseFeedback',
                input: {
                    siteId,
                    token: docs.tokens.open,
                    values: JSON.stringify(values),
                    operationId: ec.user.randomString(20),
                },
            })
            .call().result
    } catch (error) {
        ec.message.clearErrors()
        return {
            kind: error.moquiErrorKind || 'Error',
            message: String(error.message),
        }
    }
}
const invitation = () =>
    ec.entity
        .find('mantle.party.FormInvitation')
        .condition('invitationId', docs.invitationId)
        .disableAuthz()
        .one()
spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const c = (name, parameters) =>
            ec.service
                .sync()
                .name(name)
                .parameters(parameters)
                .disableAuthz()
                .call()
        const { org, customer } = fixtures().parties('PASS_SUPPORT_PAGES')
        c('create#mantle.public.PublicSite', {
            siteId,
            name: 'Support pages',
            state: 'published',
            registrationMode: 'invitation',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        c('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId: ec.user.userAccount.partyId,
            state: 'active',
            role: 'owner',
            revision: 1,
        })
        c('mantle.public.SiteServices.store#Mounts', {
            input: {
                siteId,
                expectedRevision: 1,
                mounts: [
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'support', pathPrefix: '/support', targetId: org },
                ],
                hosts: [{ hostname: 'support.example.test', canonical: true }],
            },
        })
        docs = fixtures().feedback({
            prefix: 'PASS_SUPPORT_PAGES',
            org,
            customer,
        })
        ec.artifactExecution.enableAuthz()
    },
})
feature(
    "the link shows the form and the customer's label, never the case, and a GET submits nothing; a bad link shows guidance",
    {
        when() {
            const page = render('Support/Feedback', { token: docs.tokens.open })
            const answeredAfterGet = invitation().formResponseId || null
            const bad = [
                'x'.repeat(48),
                docs.tokens.expired,
                docs.tokens.withdrawn,
            ].map((token) => render('Support/Feedback', { token }).html)
            return { page, answeredAfterGet, bad }
        },
        then({ page, answeredAfterGet, bad }) {
            page.errors.length === 0
            page.html.includes('How did we do?')
            page.html.includes(
                'Support Pages Service Co asks Support Pages Customer',
            )
            page.html.includes(
                'How satisfied are you with how we handled your request?',
            )
            page.html.includes('name="rating" value="5"')
            page.html.includes('data-visible-when=')
            page.html.includes('data-require-when=')
            page.html.includes('<script src="/js/moqui-form-when.js">')
            page.html.includes('action="/support/feedback/submit"')
            !page.html.includes(docs.requestId)
            !page.html.includes('Thermostat reads two degrees high')
            answeredAfterGet === null
            bad.every((html) =>
                html.includes('This feedback link is not available'),
            )
            bad.every((html) => !html.includes('Support Pages Customer'))
        },
    },
)
feature(
    'an answer is checked by the authority, kept once, and the page shows its receipt',
    {
        when() {
            const noComment = submit({ rating: '2' })
            const answered = submit({
                rating: '2',
                comment: 'It took a week to hear back',
            })
            const repeat = submit({ rating: '5' })
            const kept = invitation()
            const page = render('Support/Feedback', { token: docs.tokens.open })
            return { noComment, answered, repeat, kept, page }
        },
        then({ noComment, answered, repeat, kept, page }) {
            noComment.kind === 'Unprocessable'
            noComment.message.includes(
                'What could we have done better? is required',
            )
            answered.alreadyApplied === false
            answered.receipt.scoreText === '2 of 5'
            repeat.alreadyApplied === true
            kept.score === 2
            page.html.includes('Thank you')
            page.html.includes('2 of 5')
            !page.html.includes('name="rating"')
        },
    },
)
