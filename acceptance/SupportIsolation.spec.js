// The Support app's isolation between customers (design-customer-service §10 "unauthorized actions", impl-customer-service
// P16), through the facade as the pages call it: a contact invited for one customer gets nothing of another customer of the
// same organization: not its case (read, reply, reopen, cancel, file), not its return (read, withdraw), not in MyCases or
// MyReturns, even when the other customer is named in the request, and the case page by the other case's id shows only
// "not available"; its own case and return stay readable (the control). On its own site (SupportFixtures' parties and
// contacts, prefix PASS_SUPPORT_ISO), as SupportAccess builds one; Mantle's SupportPortal spec covers the rules.
// Run: ./moq accept mr-pass --spec SupportIsolation
const fixtures = () =>
    ec.resource.script('component://mr-pass/test/Support/SupportFixtures.js')
const siteId = 'PASS_SUPPORT_ISO'
const prefix = 'PASS_SUPPORT_ISO'
let people, org, customer
const other = prefix + '_OTHER'
const otherReturnId = prefix + '_OTHER_RET'
const SECRET = /FOREIGN|Other Customer|other-secret/
const c = (name, parameters) =>
    ec.service.sync().name(name).parameters(parameters).disableAuthz().call() ||
    {}
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            path,
            {
                resolvedSiteId: siteId,
                publicHost: 'iso.example.test',
                publicPath: '/' + path.toLowerCase(),
                ...parameters,
            },
            null,
        )
    return {html: String(rendered.output || ''), errors: rendered.errorMessages}
}
const operation = (name, input) => {
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({operation: name, input: {siteId, ...input}})
            .call().result
    } catch (error) {
        ec.message.clearErrors()
        return {
            kind: error.moquiErrorKind || 'Error',
            message: String(error.message),
        }
    }
}
spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const parties = fixtures().parties(prefix)
        org = parties.org
        customer = parties.customer
        c('create#mantle.public.PublicSite', {
            siteId,
            name: 'Support isolation',
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
                    {app: 'account', pathPrefix: '/account'},
                    {app: 'support', pathPrefix: '/support', targetId: org},
                ],
                hosts: [{hostname: 'iso.example.test', canonical: true}],
            },
        })
        people = fixtures().contacts({prefix, org, customer})
        // the other customer's case carries a shared file, and it has a requested return of its own
        c('create#mantle.request.RequestContent', {
            requestId: people.foreign,
            contentTypeEnumId: 'RqCntCustomerShared',
            contentLocation: 'dbresource://pass-test/support/other-secret.pdf',
            contentDate: ec.user.nowTimestamp,
        })
        c('create#mantle.order.return.ReturnHeader', {
            returnId: otherReturnId,
            statusId: 'ReturnRequested',
            customerPartyId: other,
            vendorPartyId: org,
            entryDate: '2000-01-01T00:00:00Z',
            currencyUomId: 'USD',
            customerReference: 'other-secret',
        })
        c('create#mantle.order.return.ReturnItem', {
            returnId: otherReturnId,
            returnItemSeqId: '01',
            description: 'Other Customer filter',
            returnQuantity: 1,
            statusId: 'ReturnRequested',
            returnReasonEnumId: 'RrsnDefective',
            returnResponseEnumId: 'RrspCredit',
        })
        ec.artifactExecution.enableAuthz()
    },
    cleanupSpec() {
        login('john.doe')
        ec.artifactExecution.enableAuthz()
    },
})
feature(
    "a contact gets nothing of another customer's case or return, by id, by naming the customer, or by the page",
    {
        when() {
            const fileId = Array.from(
                ec.entity
                    .find('mantle.request.RequestContent')
                    .condition('requestId', people.foreign)
                    .disableAuthz()
                    .list(),
            )[0]?.requestContentId
            login(people.contact, 'moqui')
            const answers = {
                getCase: operation('getCustomerCase', {
                    requestId: people.foreign,
                }),
                reply: operation('replyCustomerCase', {
                    requestId: people.foreign,
                    body: 'other-secret reply',
                    operationId: ec.user.randomString(20),
                }),
                reopen: operation('requestCaseReopen', {
                    requestId: people.foreign,
                    reason: 'other-secret',
                    operationId: ec.user.randomString(20),
                }),
                cancel: operation('cancelCustomerCase', {
                    requestId: people.foreign,
                    expectedRevision: 1,
                    reason: 'other-secret',
                }),
                file: operation('getCaseFile', {
                    requestId: people.foreign,
                    fileId,
                }),
                getReturn: operation('getCustomerReturn', {
                    returnId: otherReturnId,
                }),
                withdraw: operation('withdrawCustomerReturn', {
                    returnId: otherReturnId,
                    expectedRevision: 1,
                }),
            }
            const lists = {
                cases: operation('findCustomerCases', {}),
                casesNamed: operation('findCustomerCases', {
                    customerPartyId: other,
                }),
                returns: operation('findCustomerReturns', {}),
                returnsNamed: operation('findCustomerReturns', {
                    customerPartyId: other,
                }),
            }
            const page = render('Support/CustomerCase', {
                requestId: people.foreign,
            })
            const myCases = render('Support/MyCases', {})
            // the control: its own case and return
            const own = operation('getCustomerCase', {requestId: people.own})
            const ownReturn = operation('getCustomerReturn', {
                returnId: people.returnId,
            })
            login('john.doe')
            const otherReturn = ec.entity
                .find('mantle.order.return.ReturnHeader')
                .condition('returnId', otherReturnId)
                .disableAuthz()
                .one()
            const replies = Array.from(
                ec.entity
                    .find('mantle.request.RequestCommEvent')
                    .condition('requestId', people.foreign)
                    .disableAuthz()
                    .list(),
            ).length
            // each answer refused as missing, and nothing of the other customer in any answer or list
            const answered = Object.entries(answers)
                .filter(
                    ([name, answer]) =>
                        !['NotFound', 'Unprocessable'].includes(answer.kind),
                )
                .map(([name]) => name)
            const leaked = Object.entries(Object.assign({}, answers, lists))
                .filter(([name, answer]) => SECRET.test(JSON.stringify(answer)))
                .map(([name]) => name)
            return {
                answered,
                leaked,
                lists,
                page,
                myCases,
                own,
                ownReturn,
                otherReturn,
                replies,
            }
        },
        then({
            answered,
            leaked,
            lists,
            page,
            myCases,
            own,
            ownReturn,
            otherReturn,
            replies,
        }) {
            answered.length === 0
            leaked.length === 0
            !Array.from(lists.cases.caseList || []).some(
                row => row.requestId === people.foreign,
            )
            !Array.from(lists.returns.returnList || []).some(
                row => row.returnId === otherReturnId,
            )
            page.html.includes('This case is not available')
            !SECRET.test(page.html)
            myCases.html.includes('Case OWN')
            !SECRET.test(myCases.html)
            own.case.requestId === people.own
            !ownReturn.kind
            otherReturn.statusId === 'ReturnRequested'
            replies === 0
        },
    },
)
