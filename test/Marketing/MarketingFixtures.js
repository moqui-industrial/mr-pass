/* PASS Marketing's fixtures (IronStone impl-marketing P7), for MarketingAccess and the acceptance tests MarketingSubscribeHttp and
 * MarketingRemoteHttp: an internal organization with a published site whose marketing mount targets it (and Account's), a
 * second published site with no marketing mount, two lists offered on the site, one public by the legacy flag only, a relay, a
 * bounce account, a ready transactional sending profile and a published confirmation template. setup(prefix, siteId, host) makes
 * them once and answers their ids. CC0 plus patent grant. */
const lib = ec.resource.script("component://mr-mantle/test/marketing/MarketingSpecLib.js")
const {make, row, rows, system, organization} = lib
const dayMs = 86400000
function setup(prefix, siteId, host) {
    const ids = {
        org: prefix + "_ORG",
        siteId,
        siteNone: siteId + "_NONE",
        host,
        garden: prefix + "_GARDEN",
        kitchen: prefix + "_KITCHEN",
        hidden: prefix + "_HIDDEN",
        mailbox: prefix + "_MAILBOX"
    }
    if (row("mantle.party.Party", {partyId: ids.org})) return ids
    system(() => {
        const ago = days => new Date(Date.now() - days * dayMs)
        organization(ids.org, "Marketing pages")
        for (const [site, hostname, mounted] of [
            [siteId, host, true],
            [ids.siteNone, "none." + host, false]
        ]) {
            make("mantle.public.PublicSite", {
                siteId: site,
                name: "Marketing pages " + site,
                state: "published",
                registrationMode: "closed",
                locale: "en",
                timeZone: "UTC",
                policyRevision: 1,
                generation: 1
            })
            make("mantle.public.PublicSiteHost", {hostname, siteId: site, canonical: "Y"})
            make("mantle.public.PublicSiteApp", {
                siteId: site,
                appMountId: "account",
                app: "account",
                pathPrefix: "/account",
                enabled: "Y"
            })
            if (mounted)
                make("mantle.public.PublicSiteApp", {
                    siteId: site,
                    appMountId: "marketing",
                    app: "marketing",
                    pathPrefix: "/marketing",
                    enabled: "Y",
                    targetId: ids.org
                })
        }
        make("moqui.basic.email.EmailServer", {emailServerId: prefix + "_RELAY", smtpHost: "relay." + host, smtpPort: "9"})
        make("moqui.basic.email.EmailTemplate", {
            emailTemplateId: prefix + "_CONFIRM",
            emailServerId: prefix + "_RELAY",
            fromAddress: "hello@" + host,
            subject: ""
        })
        make("mantle.party.MessageTemplate", {
            messageTemplateId: prefix + "_CONFIRM",
            organizationPartyId: ids.org,
            templateName: "Subscription confirmation",
            channelEnumId: "MdcEmail",
            purposeEnumId: "MtpTransactional",
            localeId: "en",
            emailTemplateId: prefix + "_CONFIRM",
            fromDate: ago(30)
        })
        make("mantle.party.MessageTemplateContent", {
            messageTemplateId: prefix + "_CONFIRM",
            contentSeqId: "001",
            subject: "Please confirm your subscription",
            bodyLocation: "component://mr-mantle/test/marketing/SubscriptionConfirmation.html.fancy-locked",
            variablesJson: JSON.stringify([
                {name: "firstName", label: "First name", fallback: "there", required: false},
                {name: "listName", label: "List", fallback: "our news", required: false}
            ]),
            fromDate: ago(20)
        })
        make("moqui.basic.email.EmailAccount", {
            emailAccountId: prefix + "_BOUNCES",
            accountKindEnumId: "EakHosted",
            emailAddress: "bounces@bounce." + host,
            statusId: "EasActive"
        })
        make("mantle.party.MessageSendingProfile", {
            sendingProfileId: prefix + "_PROFILE",
            organizationPartyId: ids.org,
            profileName: "Notices",
            channelEnumId: "MdcEmail",
            emailServerId: prefix + "_RELAY",
            fromAddress: "hello@" + host,
            purposeEnumId: "MtpTransactional",
            trackingPolicyEnumId: "MtrNone",
            bounceDomain: "bounce." + host,
            fromDate: ago(30)
        })
        for (const [contactListId, contactListName, offer] of [
            [ids.garden, "Garden news", {publicOffer: "Y", publicSiteId: siteId}],
            [ids.kitchen, "Kitchen news", {publicOffer: "Y", publicSiteId: siteId}],
            [ids.hidden, "Hidden news", {publicOffer: "N"}]
        ]) {
            make("mantle.marketing.contact.ContactList", {
                contactListId,
                contactListName,
                contactListTypeEnumId: "NEWSLETTER",
                contactMechTypeEnumId: "CmtEmailAddress",
                ownerPartyId: ids.org,
                isPublic: "Y",
                description: contactListName + " twice a month"
            })
            make(
                "mantle.marketing.contact.ContactListPolicy",
                Object.assign(
                    {
                        contactListId,
                        fromDate: ago(10),
                        confirmationRequired: "Y",
                        purposeEnumId: "PcpMarketingEmail",
                        evidenceText: "Yes, send me " + contactListName,
                        confirmEmailTemplateId: prefix + "_CONFIRM"
                    },
                    offer
                )
            )
        }
        // a mailbox the visitor is a member of, which nothing here touches
        make("mantle.marketing.contact.ContactList", {
            contactListId: ids.mailbox,
            contactListName: "Members mailbox",
            contactListTypeEnumId: "MAILBOX",
            contactMechTypeEnumId: "CmtEmailAddress",
            ownerPartyId: ids.org
        })
    })
    return ids
}
/* The acceptance walks' data on an existing site (PASS_HTTP, whose runtime mounts /marketing): the fixture organization's
 * marketing mount there and its two lists offered there (setup's, on a site of its own first), and a known person with an address,
 * a mailbox membership and a list link token of a known value on the garden list (the email preferences page's link). */
function onSite(prefix, siteId, host, person) {
    const ids = setup(prefix, prefix + "_OWN", host)
    system(() => {
        if (!row("mantle.public.PublicSiteApp", {siteId, appMountId: "marketing"}))
            make("mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "marketing",
                app: "marketing",
                pathPrefix: "/marketing",
                enabled: "Y",
                targetId: ids.org
            })
        for (const contactListId of [ids.garden, ids.kitchen]) {
            const policy = rows("mantle.marketing.contact.ContactListPolicy", {contactListId}).find(r => r.thruDate == null)
            lib.run("update#mantle.marketing.contact.ContactListPolicy", {
                contactListId,
                fromDate: policy.fromDate,
                publicSiteId: siteId
            })
        }
        if (!row("mantle.party.Party", {partyId: person.partyId})) {
            make("mantle.party.Party", {partyId: person.partyId, partyTypeEnumId: "PtyPerson"})
            make("mantle.party.Person", {partyId: person.partyId, firstName: "Walk", lastName: "Subscriber"})
            make("mantle.party.contact.ContactMech", {
                contactMechId: person.partyId + "_EM",
                contactMechTypeEnumId: "CmtEmailAddress",
                infoString: person.address
            })
            make("mantle.party.contact.PartyContactMech", {
                partyId: person.partyId,
                contactMechId: person.partyId + "_EM",
                contactMechPurposeId: "EmailPrimary",
                fromDate: new Date(Date.now() - 30 * dayMs)
            })
            make("mantle.marketing.contact.ContactListParty", {
                contactListId: ids.mailbox,
                partyId: person.partyId,
                fromDate: new Date(Date.now() - 30 * dayMs),
                statusId: "CLPT_ACCEPTED",
                preferredContactMechId: person.partyId + "_EM"
            })
            make("mantle.marketing.contact.ContactListToken", {
                tokenHash: ec.user.singleUseCodeHash(person.token),
                contactListId: ids.garden,
                partyId: person.partyId,
                contactMechId: person.partyId + "_EM",
                purposeEnumId: "PcpMarketingEmail",
                createdDate: ec.user.nowTimestamp
            })
        }
    })
    return Object.assign({}, ids, {siteId})
}
/* IronStone Marketing P12: a published survey of the fixture organization (a scored choice and a comment) with three publications
 * on the site: open to anyone, a draft never opened and one closed; setup's ids first. Answers their publication ids. */
function forms(prefix, ids) {
    const found = rows("mantle.party.FormPublication", {organizationPartyId: ids.org})
    if (found.length) {
        const by = description => found.find(r => r.description === description)?.publicationId
        return {open: by("Open survey"), draft: by("Draft survey"), closed: by("Closed survey"), formId: found[0].formId}
    }
    return system(() => {
        const formId = prefix + "_SURVEY"
        make("moqui.screen.form.DbForm", {
            formId,
            purposeEnumId: "DbfpSurvey",
            isDated: "Y",
            ownerPartyId: ids.org,
            description: "Visit survey"
        })
        const from = new Date(Date.now() - 10 * dayMs)
        make("moqui.screen.form.DbFormField", {
            formId,
            fieldName: "rating",
            title: "How was it?",
            fieldTypeEnumId: "DBFFT_radio",
            isRequired: "Y",
            audienceEnumId: "CfaCustomer",
            layoutSequenceNum: 10,
            fromDate: from
        })
        for (const [sequenceNum, keyValue, text, scoreValue] of [
            [1, "good", "Good", 2],
            [2, "poor", "Poor", 0]
        ])
            make("moqui.screen.form.DbFormFieldOption", {
                formId,
                fieldName: "rating",
                sequenceNum,
                keyValue,
                text,
                scoreValue,
                fromDate: from
            })
        make("moqui.screen.form.DbFormField", {
            formId,
            fieldName: "comment",
            title: "Anything else?",
            fieldTypeEnumId: "DBFFT_text-area",
            isRequired: "N",
            audienceEnumId: "CfaCustomer",
            layoutSequenceNum: 20,
            fromDate: from
        })
        const publication = (description, fromDate, thruDate) =>
            make("mantle.party.FormPublication", {
                formId,
                purposeEnumId: "FppSurvey",
                organizationPartyId: ids.org,
                siteId: ids.siteId,
                accessEnumId: "FpaAnonymous",
                repeatEnumId: "FprMany",
                description,
                titleText: "How was your visit?",
                completionMessage: "Thank you for telling us.",
                subscriptionListId: ids.garden,
                fromDate,
                thruDate,
                createdDate: from
            }).publicationId
        return {
            open: publication("Open survey", from, null),
            draft: publication("Draft survey", null, null),
            closed: publication("Closed survey", from, new Date(Date.now() - dayMs)),
            formId
        }
    })
}
/* IronStone Marketing P14: two landing pages of the site's marketing mount (setup's ids first), their text in a page space of their
 * own: "spring" (Spring sale) published with the text given, "summer" a draft never published. Answers their sitePageIds. */
function pages(ids, springText) {
    const found = rows("mantle.public.PublicSitePage", {siteId: ids.siteId, appMountId: "marketing"})
    if (found.length)
        return {
            spring: found.find(r => r.routePath === "spring")?.sitePageId,
            summer: found.find(r => r.routePath === "summer")?.sitePageId
        }
    return system(() => {
        const wiki = "org.moqui.resource.WikiServices."
        const wikiSpaceId = (ids.org.split("_")[0] + "PG").slice(0, 8)
        lib.run(wiki + "create#WikiSpace", {
            wikiSpaceId,
            description: "Landing pages",
            restrictView: "N",
            restrictUpdate: "Y",
            addCreator: false
        })
        const page = (routePath, title, pageText, publish) => {
            const written = lib.run(wiki + "update#WikiPage", {
                wikiSpaceId,
                pageName: "page-" + routePath,
                wikiType: "md",
                pageText
            })
            if (publish)
                lib.run(wiki + "set#PublishedVersion", {
                    wikiPageId: written.wikiPageId,
                    publishedVersionName: written.versionName
                })
            return make("mantle.public.PublicSitePage", {
                siteId: ids.siteId,
                appMountId: "marketing",
                routePath,
                title,
                wikiPageId: written.wikiPageId,
                versionName: publish ? written.versionName : null,
                fromDate: publish ? new Date(Date.now() - dayMs) : null,
                publicationRevision: publish ? 1 : 0
            }).sitePageId
        }
        return {
            spring: page("spring", "Spring sale", springText, true),
            summer: page("summer", "Summer sale", "# Summer\n", false)
        }
    })
}
/* IronStone Marketing P16: registration offers of the fixture organization's events: one published on the site (its event online, a
 * paid ticket of a ticket product priced in the organization's currency and a free ticket whose two places are confirmed), a draft, a
 * closed one, one published on the site without the mount, and one published whose occurrence is over; setup's ids first. Rows as the
 * system (Mantle's EventRegistrationSetup spec covers the services). Answers the offers' ids. */
function events(prefix, ids) {
    const offer = name => prefix + "_OFFER_" + name
    const out = {
        published: offer("OPEN"),
        draft: offer("DRAFT"),
        closed: offer("CLOSED"),
        otherSite: offer("ELSEWHERE"),
        past: offer("PAST"),
        callUrl: "https://call.example.test/c/" + prefix
    }
    if (row("mantle.work.registration.EventRegistrationPolicy", {registrationPolicyId: out.published})) return out
    system(() => {
        if (!row("mantle.ledger.config.PartyAcctgPreference", {organizationPartyId: ids.org}))
            make("mantle.ledger.config.PartyAcctgPreference", {organizationPartyId: ids.org, baseCurrencyUomId: "USD"})
        make("mantle.product.Product", {
            productId: prefix + "_SEAT",
            productName: "Workshop seat",
            productTypeEnumId: "PtService",
            ownerPartyId: ids.org
        })
        make("mantle.product.ProductPrice", {
            productId: prefix + "_SEAT",
            pricePurposeEnumId: "PppPurchase",
            priceTypeEnumId: "PptCurrent",
            fromDate: 0,
            minQuantity: 1,
            price: "25.00",
            priceUomId: "USD"
        })
        const start = Date.now() + 5 * dayMs
        const workshop = (key, name, startMs, extra = {}) => {
            const workEffortId = prefix + "_EV_" + key
            make(
                "mantle.work.effort.WorkEffort",
                Object.assign(
                    {
                        workEffortId,
                        workEffortTypeEnumId: "WetEvent",
                        workEffortName: name,
                        statusId: "WeInPlanning",
                        estimatedStartDate: new Date(startMs),
                        estimatedCompletionDate: new Date(startMs + 2 * 3600000),
                        location: "Garden hall",
                        description: "Internal note: budget 900"
                    },
                    extra
                )
            )
            make("mantle.work.registration.RegistrationEvent", {
                workEffortId,
                organizationPartyId: ids.org,
                createdDate: new Date()
            })
            return workEffortId
        }
        const policy = (registrationPolicyId, workEffortId, startMs, statusId, siteId) =>
            make("mantle.work.registration.EventRegistrationPolicy", {
                registrationPolicyId,
                workEffortId,
                occurrenceStart: new Date(startMs),
                occurrenceEnd: new Date(startMs + 2 * 3600000),
                organizationPartyId: ids.org,
                statusId,
                publicTitle: "Pruning workshop",
                publicDescription: "Bring gloves.\n\nWe prune <b>roses</b>.",
                timeZone: "UTC",
                siteId,
                totalSeats: 12,
                holdMinutes: 15,
                waitlistEnabled: "Y",
                termsText: "Places are held for 15 minutes.",
                cancellationTerms: "Cancel up to a day before.",
                policyRevision: 1,
                termsRevision: 0,
                publishedDate: statusId === "ErpDraft" ? null : new Date()
            })
        const open = workshop("OPEN", "Pruning (internal name)", start, {infoUrl: out.callUrl})
        policy(out.published, open, start, "ErpPublished", ids.siteId)
        make("mantle.work.registration.EventTicketType", {
            ticketTypeId: out.published + "_STD",
            registrationPolicyId: out.published,
            ticketName: "Standard",
            priceSourceEnumId: "EtpProduct",
            productId: prefix + "_SEAT",
            perOrderLimit: 4,
            sequenceNum: 1,
            fromDate: new Date(Date.now() - dayMs)
        })
        make("mantle.work.registration.EventTicketType", {
            ticketTypeId: out.published + "_GUEST",
            registrationPolicyId: out.published,
            ticketName: "Guest",
            priceSourceEnumId: "EtpFree",
            capacity: 2,
            perOrderLimit: 1,
            sequenceNum: 2,
            fromDate: new Date(Date.now() - dayMs)
        })
        for (const n of [1, 2])
            make("mantle.work.registration.EventRegistration", {
                registrationId: out.published + "_R" + n,
                registrationPolicyId: out.published,
                ticketTypeId: out.published + "_GUEST",
                statusId: "EvrConfirmed",
                createdDate: new Date()
            })
        policy(out.draft, workshop("DRAFT", "Draft workshop", start), start, "ErpDraft", ids.siteId)
        policy(out.closed, workshop("CLOSED", "Closed workshop", start), start, "ErpClosed", ids.siteId)
        policy(out.otherSite, workshop("ELSEWHERE", "Elsewhere workshop", start), start, "ErpPublished", ids.siteNone)
        const over = Date.now() - 3 * dayMs
        policy(out.past, workshop("PAST", "Past workshop", over), over, "ErpPublished", ids.siteId)
    })
    return out
}
/* P17: a free published offer on the site for the registration pages (MarketingRegistration and the acceptance test
 * MarketingRegisterHttp): three seats of one free ticket (two a registration) with a waitlist of two, its terms, an occurrence five
 * days on. Answers its ids. */
function registrations(prefix, ids) {
    const out = {offer: prefix + "_OFFER_FREE", ticket: prefix + "_OFFER_FREE_T", workEffortId: prefix + "_EV_FREE"}
    if (row("mantle.work.registration.EventRegistrationPolicy", {registrationPolicyId: out.offer})) return out
    system(() => {
        const start = Date.now() + 5 * dayMs
        make("mantle.work.effort.WorkEffort", {
            workEffortId: out.workEffortId,
            workEffortTypeEnumId: "WetEvent",
            workEffortName: "Free talk (internal)",
            statusId: "WeInPlanning",
            estimatedStartDate: new Date(start),
            estimatedCompletionDate: new Date(start + 3600000),
            location: "Garden hall"
        })
        make("mantle.work.registration.RegistrationEvent", {
            workEffortId: out.workEffortId,
            organizationPartyId: ids.org,
            createdDate: new Date()
        })
        make("mantle.work.registration.EventRegistrationPolicy", {
            registrationPolicyId: out.offer,
            workEffortId: out.workEffortId,
            occurrenceStart: new Date(start),
            occurrenceEnd: new Date(start + 3600000),
            organizationPartyId: ids.org,
            statusId: "ErpPublished",
            publicTitle: "Free garden talk",
            timeZone: "UTC",
            siteId: ids.siteId,
            totalSeats: 3,
            holdMinutes: 15,
            waitlistEnabled: "Y",
            waitlistLimit: 2,
            termsText: "Doors open ten minutes before.",
            cancellationTerms: "Cancel any time.",
            questionScopeEnumId: "ErqAttendee",
            policyRevision: 1,
            termsRevision: 0,
            publishedDate: new Date()
        })
        make("mantle.work.registration.EventTicketType", {
            ticketTypeId: out.ticket,
            registrationPolicyId: out.offer,
            ticketName: "Free place",
            priceSourceEnumId: "EtpFree",
            perOrderLimit: 2,
            sequenceNum: 1,
            fromDate: new Date(Date.now() - dayMs)
        })
    })
    return out
}
/* A PASS operation through the facade (local mode), as a page calls it: its result, or the error's kind and message. */
function call(operation, input) {
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name("pass.Facade.call#Operation")
            .parameters({operation, input})
            .requireNewTransaction(true)
            .call().result
    } catch (error) {
        ec.message.clearErrors()
        return {kind: error.moquiErrorKind || "Error", error: String(error.message).split("\n")[0]}
    }
}
/* The confirmation token of the newest captured message to an address (its attempt runs on a service worker once the request
   commits: waited for). */
function tokenTo(capture, address) {
    ec.factory.waitWorkerPoolEmpty(50)
    const message = Array.from(capture.getMessages())
        .reverse()
        .find(m => Array.from(m.toList || []).includes(address))
    return /VerifySubscription\?token=([A-Za-z0-9_-]+)/.exec(String(message?.body || ""))?.[1] || null
}
const membership = (contactListId, partyId) =>
    rows("mantle.marketing.contact.ContactListParty", {contactListId, partyId}).sort(
        (a, b) => Number(b.fromDate) - Number(a.fromDate)
    )[0]?.statusId ?? null
const partyOf = address =>
    rows("mantle.party.contact.PartyContactMechInfo", {contactMechTypeEnumId: "CmtEmailAddress"}).find(
        info => String(info.infoString).toLowerCase() === address
    )?.partyId || null
;({setup, onSite, forms, pages, events, registrations, call, tokenTo, membership, partyOf, lib})
