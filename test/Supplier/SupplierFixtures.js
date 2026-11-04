/* Purchasing's Supplier pages' documents for the PASS specs (impl-purchasing P16): for a buying organization with a supplier
 * site and one of its suppliers, an RFQ with a requested quote of the supplier and a competitor's, and a sent purchase
 * order at revision 2, with their link tokens: the quote's, the order's of revision 2 and of revision 1 (superseded). The
 * SupplierPages spec (test/) and the acceptance walks' fixture (acceptance/SupplierPortalFixtures) load it. CC0 plus patent
 * grant. */
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
function order(orderId, org, supplierPartyId, statusId, revision, lines) {
    call('create#mantle.order.OrderHeader', {
        orderId,
        orderName:
            statusId === 'OrderRequested' ? 'RFQ quote' : 'Shelf brackets',
        statusId,
        currencyUomId: 'USD',
        grandTotal: lines.reduce(
            (sum, line) => sum + line.quantity * (line.price || 0),
            0,
        ),
        placedDate: statusId === 'OrderRequested' ? null : ec.user.nowTimestamp,
        entryDate: ec.user.nowTimestamp,
    })
    call('create#mantle.order.OrderPart', {
        orderId,
        orderPartSeqId: '01',
        vendorPartyId: supplierPartyId,
        customerPartyId: org,
        statusId,
    })
    lines.forEach((line, index) =>
        call('create#mantle.order.OrderItem', {
            orderId,
            orderItemSeqId: '0' + (index + 1),
            orderPartSeqId: '01',
            itemTypeEnumId: 'ItemExpense',
            itemDescription: line.description,
            quantity: line.quantity,
            unitAmount: line.price || 0,
            requiredByDate: '2026-12-01T00:00:00Z',
        }),
    )
    // the lines' creates counted revisions: the order is at the revision given
    call('update#mantle.order.OrderHeader', {
        orderId,
        orderRevision: revision,
    })
}
function capability(
    org,
    partyId,
    recordType,
    recordId,
    scopes,
    value,
    recordRevision = null,
) {
    call('create#mantle.party.ExternalAccessCapability', {
        organizationPartyId: org,
        partyId,
        recordType,
        recordId,
        scopes,
        recordRevision,
        tokenDigest: ec.user.singleUseCodeHash(value),
        fromDate: ec.user.nowTimestamp,
        thruDate: new Date(Date.now() + 30 * 86400000),
        createdByUserId: ec.user.userId,
    })
}
/* p: {prefix, org, supplierPartyId}. Answers the ids and tokens. */
function documents(p) {
    const { prefix, org, supplierPartyId } = p
    const competitor = prefix + '_COMPETITOR'
    party(competitor, 'Rival Brackets Ltd', 'Supplier', org)
    const requestId = prefix + '_RFQ'
    call('create#mantle.request.Request', {
        requestId,
        requestTypeEnumId: 'RqtPurchaseRfq',
        requestName: 'Brackets for the spring reset',
        description: 'Powder-coated steel, 40 mm.',
        statusId: 'ReqSubmitted',
        requestDate: ec.user.nowTimestamp,
        responseRequiredDate: new Date(Date.now() + 7 * 86400000),
        currencyUomId: 'USD',
    })
    call('create#mantle.request.RequestParty', {
        requestId,
        partyId: org,
        roleTypeId: 'OrgInternal',
        fromDate: ec.user.nowTimestamp,
    })
    call('create#mantle.request.RequestItem', {
        requestId,
        requestItemSeqId: '01',
        description: 'Shelf bracket',
        quantity: 40,
        statusId: 'ReqSubmitted',
    })
    const quoteId = prefix + '_QUOTE',
        rivalQuoteId = prefix + '_QUOTE_RIVAL',
        orderId = prefix + '_PO'
    for (const [id, supplier] of [
        [quoteId, supplierPartyId],
        [rivalQuoteId, competitor],
    ]) {
        order(id, org, supplier, 'OrderRequested', 1, [
            { description: 'Shelf bracket', quantity: 40 },
        ])
        call('create#mantle.request.RequestItemOrder', {
            requestId,
            requestItemSeqId: '01',
            orderId: id,
            orderItemSeqId: '01',
            quantity: 40,
        })
    }
    order(orderId, org, supplierPartyId, 'OrderSent', 2, [
        { description: 'Shelf bracket', quantity: 40, price: 2.5 },
        { description: 'Wall anchor', quantity: 80, price: 0.4 },
    ])
    const tokens = {
        quote: token(prefix, 'QuoteLink'),
        order: token(prefix, 'OrderLinkRev2'),
        superseded: token(prefix, 'OrderLinkRev1'),
    }
    capability(
        org,
        supplierPartyId,
        'Quote',
        quoteId,
        'QuoteResponse',
        tokens.quote,
    )
    capability(
        org,
        supplierPartyId,
        'Order',
        orderId,
        'OrderAcknowledgement,BillUpload',
        tokens.order,
        2,
    )
    capability(
        org,
        supplierPartyId,
        'Order',
        orderId,
        'OrderAcknowledgement,BillUpload',
        tokens.superseded,
        1,
    )
    return { requestId, quoteId, rivalQuoteId, orderId, competitor, tokens }
}
;({ documents, token })
