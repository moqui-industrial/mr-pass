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
;({setup, onSite, call, tokenTo, membership, partyOf, lib})
