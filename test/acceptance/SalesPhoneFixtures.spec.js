// PASS Sales' phone-width pages on the HTTP test community (PASS_HTTP; IronStone impl-sales P20), after SalesOrderFixtures: one
// more issued quote of SalesQuoteFixtures' account a with a link of a known token, declined by that link, for the receipt page of
// the walk SalesPhonePages (the open quote, the orders and the invited contact are SalesQuoteFixtures' and SalesOrderFixtures',
// which their own walks only read).
const sq = () => ec.resource.script("component://mr-pass/test/Sales/SalesQuoteFixtures.js")
const token = name => ("PASS_HTTP_SP" + name + "0".repeat(48)).slice(0, 48)
spec({
    dependsOn: ["SalesOrderFixtures"],
    setupSpec() {
        login("john.doe")
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature("provision a quote declined by its link", {
    when() {
        // the quote fixtures' ids (SalesQuoteIssueFixtures.setup("PASS_HTTP_SQ"), its rep user prefix_REP)
        const f = {
            prefix: "PASS_HTTP_SQ",
            orgA: "PASS_HTTP_SQ_ORG_A",
            product: "PASS_HTTP_SQ_PRICED",
            template: "PASS_HTTP_SQ_QUOTE_MAIL",
            users: {rep: "PASS_HTTP_SQ_REP"},
            accounts: {a: "PASS_HTTP_SQ_ACC_A"},
            contacts: {mailed: "PASS_HTTP_SQ_MAILED"}
        }
        const answered = sq().issued(f, f.accounts.a, f.contacts.mailed)
        sq().link(answered, token("Answered"))
        // the customer's decline by the link, as the page's form posts it (a visitor)
        logout()
        ec.message.pushErrors()
        let declined
        try {
            declined = ec.service
                .sync()
                .name("pass.Facade.call#Operation")
                .parameters({
                    operation: "respondSalesQuote",
                    input: {
                        siteId: "PASS_HTTP",
                        token: token("Answered"),
                        action: "decline",
                        expectedRevision: answered.revision,
                        reason: "We went with a smaller order",
                        operationId: "sp" + Date.now()
                    }
                })
                .call()?.result
        } finally {
            ec.message.clearErrors()
            ec.message.popErrors()
            login("john.doe")
        }
        return {answered, declined}
    },
    then({answered, declined}) {
        answered.orderId != null
        declined != null
    }
})
