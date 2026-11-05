/* Customer Service's Feedback page records for the PASS specs (impl-customer-service P13): for a service organization and its
 * customer, a resolved case and a published feedback form (a dated DbForm: a required rating 1 to 5, a comment shown once a
 * rating is chosen and required for a rating of 1 or 2), and feedback invitations of the case with their link tokens: one to
 * answer, one expired and one withdrawn. The SupportAccess spec (test/) and the acceptance walks' fixture
 * (acceptance/SupportFixtures) load it; nothing here calls BOSS. CC0 plus patent grant. */
const call = (name, parameters) => {
    const out =
        ec.service
            .sync()
            .name(name)
            .parameters(parameters)
            .disableAuthz()
            .call() || {}
    if (ec.message.hasError()) throw new Error(ec.message.getErrorsString())
    return out
}
const token = (prefix, name) => (prefix + name + '0'.repeat(48)).slice(0, 48)
const day = 86400000
function party(partyId, name, roleTypeId, ownerPartyId) {
    call('create#mantle.party.Party', {
        partyId,
        partyTypeEnumId: 'PtyOrganization',
        ownerPartyId,
    })
    call('create#mantle.party.Organization', {
        partyId,
        organizationName: name,
    })
    call('create#mantle.party.PartyRole', { partyId, roleTypeId })
}
/* The feedback form, published a day ago. */
function feedbackForm(formId, org) {
    const since = new Date(Date.now() - day)
    call('create#moqui.screen.form.DbForm', {
        formId,
        purposeEnumId: 'DbfpCaseFeedback',
        isDated: 'Y',
        ownerPartyId: org,
        description: 'Case feedback',
    })
    const field = (
        fieldName,
        title,
        fieldTypeEnumId,
        isRequired,
        layoutSequenceNum,
    ) =>
        call('create#moqui.screen.form.DbFormField', {
            formId,
            fieldName,
            title,
            fieldTypeEnumId,
            isRequired,
            layoutSequenceNum,
            audienceEnumId: 'CfaCustomer',
            fromDate: since,
        })
    field(
        'rating',
        'How satisfied are you with how we handled your request?',
        'DBFFT_radio',
        'Y',
        10,
    )
    field(
        'comment',
        'What could we have done better?',
        'DBFFT_text-area',
        'N',
        20,
    )
    ;[
        'Very dissatisfied',
        'Dissatisfied',
        'Neither',
        'Satisfied',
        'Very satisfied',
    ].forEach((text, index) =>
        call('create#moqui.screen.form.DbFormFieldOption', {
            formId,
            fieldName: 'rating',
            sequenceNum: index + 1,
            keyValue: String(index + 1),
            text: index + 1 + ' - ' + text,
            fromDate: since,
        }),
    )
    const rule = (dependencySeqId, operator, value, effect) =>
        call('create#moqui.screen.form.DbFormFieldDependency', {
            formId,
            dependencySeqId,
            sourceFieldName: 'rating',
            operator,
            value,
            targetFieldName: 'comment',
            effect,
            fromDate: since,
        })
    rule('01', 'not-empty', null, 'show')
    rule('02', 'equals', '1,2', 'require')
}
/* p: {prefix, org, customer}: the case, the form and the invitations with their tokens; the ids and tokens. */
function feedback(p) {
    const { prefix, org, customer } = p
    const requestId = prefix + '_CASE',
        formId = prefix + '_FORM'
    call('create#mantle.request.Request', {
        requestId,
        requestTypeEnumId: 'RqtSupport',
        requestName: 'Thermostat reads two degrees high',
        statusId: 'ReqCompleted',
        requestDate: ec.user.nowTimestamp,
    })
    call('create#mantle.request.support.CaseProfile', {
        requestId,
        intakeDate: ec.user.nowTimestamp,
    })
    for (const [partyId, roleTypeId] of [
        [org, 'OrgInternal'],
        [customer, 'Customer'],
    ])
        call('create#mantle.request.RequestParty', {
            requestId,
            partyId,
            roleTypeId,
            fromDate: ec.user.nowTimestamp,
        })
    feedbackForm(formId, org)
    const publicationId = call('create#mantle.party.FormPublication', {
        formId,
        purposeEnumId: 'FppCaseFeedback',
        organizationPartyId: org,
        accessEnumId: 'FpaInvited',
        repeatEnumId: 'FprOnce',
        fromDate: ec.user.nowTimestamp,
    }).publicationId
    const invitation = (name, statusEnumId, expireMs) => {
        const invitationId = prefix + '_INV_' + name
        call('create#mantle.party.FormInvitation', {
            invitationId,
            publicationId,
            formId,
            organizationPartyId: org,
            partyId: customer,
            contactPartyId: customer,
            emailAddress: 'buyer@support-customer.example.test',
            contextEntityName: 'mantle.request.Request',
            contextId: requestId,
            recordEntityName: 'mantle.request.Request',
            recordId: requestId,
            invitationKey: 'case:' + requestId + ':' + name,
            statusEnumId,
            scheduledDate: ec.user.nowTimestamp,
            expireDate: new Date(Date.now() + expireMs),
            sentDate: ec.user.nowTimestamp,
            reminderCount: 0,
            createdDate: ec.user.nowTimestamp,
        })
        return invitationId
    }
    const capability = (invitationId, value, thruMs, revoked = false) =>
        call('create#mantle.party.ExternalAccessCapability', {
            organizationPartyId: org,
            partyId: customer,
            recordType: 'FormInvitation',
            recordId: invitationId,
            scopes: 'CaseFeedback',
            tokenDigest: ec.user.singleUseCodeHash(value),
            fromDate: new Date(Date.now() - day),
            thruDate: new Date(Date.now() + thruMs),
            revokedDate: revoked ? ec.user.nowTimestamp : null,
            createdByUserId: ec.user.userId,
        })
    const tokens = {
        open: token(prefix, 'FeedbackLink'),
        expired: token(prefix, 'ExpiredLink'),
        withdrawn: token(prefix, 'WithdrawnLink'),
    }
    const open = invitation('OPEN', 'FinSent', 14 * day)
    capability(open, tokens.open, 14 * day)
    capability(invitation('EXPIRED', 'FinExpired', -day), tokens.expired, -1000)
    capability(
        invitation('WITHDRAWN', 'FinSent', 14 * day),
        tokens.withdrawn,
        14 * day,
        true,
    )
    return { requestId, formId, invitationId: open, tokens }
}
/* The service organization and its customer, once. */
function parties(prefix) {
    const org = prefix + '_ORG',
        customer = prefix + '_CUST'
    party(org, 'Support Pages Service Co', 'OrgInternal')
    party(customer, 'Support Pages Customer', 'Customer', org)
    return { org, customer }
}
/* P15: p: {prefix, org, customer}: the customer's contact (a public account invited for it: its contact grant), an account of
 * the same customer never invited, another customer, a case the contact filed, a colleague's case and the other customer's
 * case, with a CaseView link of the contact's case; the ids and accounts. A service policy for the organization. */
function contacts(p) {
    const { prefix, org, customer } = p
    const since = new Date(Date.now() - day)
    if (
        !ec.entity
            .find('mantle.request.support.ServicePolicy')
            .condition({ organizationPartyId: org })
            .disableAuthz()
            .count()
    ) {
        // the organization's support queue, its default
        const queueId = prefix + '_Q'
        call('create#mantle.request.RequestCategory', {
            requestCategoryId: queueId,
            ownerPartyId: org,
            description: 'Support pages queue',
        })
        call('create#mantle.request.support.ServiceQueue', {
            requestCategoryId: queueId,
            visibilityEnumId: 'SqvOrganization',
            fromDate: since,
        })
        call('create#mantle.request.support.ServicePolicy', {
            organizationPartyId: org,
            caseWorkflowId: 'CwfDefault',
            defaultCategoryId: queueId,
            reopenWindowDays: 14,
            fromDate: since,
        })
    }
    const other = prefix + '_OTHER'
    party(other, 'Support Pages Other Customer', 'Customer', org)
    const person = (partyId, name) => {
        call('create#mantle.party.Party', {
            partyId,
            partyTypeEnumId: 'PtyPerson',
        })
        call('create#mantle.party.Person', {
            partyId,
            firstName: name,
            lastName: 'Pages',
        })
        call('create#moqui.security.UserAccount', {
            userId: partyId,
            username: partyId.toLowerCase(),
            partyId,
            emailAddress:
                partyId.toLowerCase() + '@support-customer.example.test',
            currentPassword: '16ac58bbfa332c1c55bd98b53e60720bfa90d394',
            passwordHashType: 'SHA',
        })
        return partyId.toLowerCase()
    }
    const contact = person(prefix + '_CONTACT', 'Ana')
    const outsider = person(prefix + '_OUTSIDER', 'Cy')
    call('create#mantle.party.ExternalAccessContact', {
        partyId: prefix + '_CONTACT',
        outsidePartyId: customer,
        organizationPartyId: org,
        app: 'support',
        fromDate: since,
    })
    const supportCase = (name, customerPartyId, reporter) => {
        const requestId = prefix + '_' + name
        call('create#mantle.request.Request', {
            requestId,
            requestTypeEnumId: 'RqtSupport',
            requestName: 'Case ' + name,
            description: 'About ' + name,
            statusId: 'ReqSubmitted',
            requestDate: since,
            filedByPartyId: reporter || null,
        })
        call('create#mantle.request.support.CaseProfile', {
            requestId,
            intakeDate: since,
            caseWorkflowId: 'CwfDefault',
        })
        for (const [partyId, roleTypeId] of [
            [org, 'OrgInternal'],
            [customerPartyId, 'Customer'],
        ].concat(reporter ? [[reporter, 'Reporter']] : []))
            call('create#mantle.request.RequestParty', {
                requestId,
                partyId,
                roleTypeId,
                fromDate: since,
            })
        return requestId
    }
    const own = supportCase('OWN', customer, prefix + '_CONTACT')
    const colleague = supportCase('COLLEAGUE', customer, null)
    const foreign = supportCase('FOREIGN', other, null)
    const link = token(prefix, 'CaseLink')
    call('create#mantle.party.ExternalAccessCapability', {
        organizationPartyId: org,
        partyId: customer,
        recordType: 'Request',
        recordId: own,
        scopes: 'CaseView',
        tokenDigest: ec.user.singleUseCodeHash(link),
        fromDate: since,
        thruDate: new Date(Date.now() + 14 * day),
        createdByUserId: ec.user.userId,
    })
    // a requested return of the customer with its RMA link
    const returnId = prefix + '_RET'
    call('create#mantle.order.return.ReturnHeader', {
        returnId,
        statusId: 'ReturnRequested',
        customerPartyId: customer,
        vendorPartyId: org,
        entryDate: since,
        currencyUomId: 'USD',
        customerReference: 'PO-' + prefix,
    })
    call('create#mantle.order.return.ReturnItem', {
        returnId,
        returnItemSeqId: '01',
        description: 'Furnace filter 16x25',
        returnQuantity: 1,
        statusId: 'ReturnRequested',
        returnReasonEnumId: 'RrsnDefective',
        returnResponseEnumId: 'RrspCredit',
    })
    const rma = token(prefix, 'RmaLink')
    call('create#mantle.party.ExternalAccessCapability', {
        organizationPartyId: org,
        partyId: customer,
        recordType: 'ReturnHeader',
        recordId: returnId,
        scopes: 'ReturnRma',
        tokenDigest: ec.user.singleUseCodeHash(rma),
        fromDate: since,
        thruDate: new Date(Date.now() + 14 * day),
        createdByUserId: ec.user.userId,
    })
    return { contact, outsider, own, colleague, foreign, link, returnId, rma }
}
;({ feedback, parties, token, contacts })
