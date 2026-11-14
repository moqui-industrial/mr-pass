// PASS Sales' order fixtures (IronStone impl-sales P17) for the acceptance tests SalesOrderScenarios, SalesOrderFixtures and the
// walk SalesOrderHttp, beside SalesQuoteFixtures.js: a seller of the organization's direct orders, its confirmations through the
// quote fixtures' mail template, a direct order placed for a customer, a shipment of it with a tracked package and an unpaid invoice
// of it (rows as Warehouse and Accounting leave them), an order link of a known token, and a Billing mount and contact grant.
// Nothing here is a production configuration. CC0 plus patent grant.
const fx = () => ec.resource.script("component://mr-mantle/test/order/SalesQuoteIssueFixtures.js")
const orders = "mantle.order.SalesOrderServices."
const c = (name, parameters) => {
    const out = ec.service.sync().name(name).parameters(parameters).disableAuthz().call() || {}
    if (ec.message.hasError()) throw new Error(ec.message.getErrorsString())
    return out
}
/* A seller of the organization (direct orders, approval), and the organization's confirmations through the fixtures' template. */
function seller(f, organizationPartyId = f.orgA) {
    return fx().system(() => {
        const id = fx().addUser(
            f,
            "seller",
            [organizationPartyId],
            ["SALES_VIEW", "SALES_TEAM_VIEW", "SALES_ORDER_EDIT", "ORDER_APPROVE"]
        )
        const policy = ec.entity
            .find("mantle.sales.policy.SalesPolicy")
            .condition("organizationPartyId", organizationPartyId)
            .one()
        c("update#mantle.sales.policy.SalesPolicy", {
            salesPolicyId: policy.salesPolicyId,
            confirmationEmailTemplateId: f.template
        })
        return id
    })
}
/* A direct order of the organization for a customer, quantity of the priced product, placed by the seller. */
function placed(f, sellerId, customerPartyId, more = {}, quantity = 2) {
    const orderId = fx().as(
        sellerId,
        orders + "create#SalesOrder",
        Object.assign({organizationPartyId: f.orgA, customerPartyId}, more)
    ).orderId
    fx().as(sellerId, orders + "store#SalesOrderLine", {
        orderId,
        orderRevision: fx().revision(orderId),
        productId: f.product,
        quantity
    })
    const out = fx().as(sellerId, orders + "place#SalesOrder", {orderId, orderRevision: fx().revision(orderId)})
    if (out.refused) throw new Error(out.refused)
    ec.factory.waitWorkerPoolEmpty(50)
    return orderId
}
/* A shipped shipment of the order's first line with one package tracked at the carrier's https page, and a finalized, unpaid
 * invoice of that line. {shipmentId, invoiceId}. */
function shipAndInvoice(f, orderId, trackingCode) {
    return fx().system(() => {
        const item = Array.from(
            ec.entity.find("mantle.order.OrderItem").condition("orderId", orderId).orderBy("orderItemSeqId").list()
        )[0]
        const part = ec.entity.find("mantle.order.OrderPart").condition({orderId, orderPartSeqId: item.orderPartSeqId}).one()
        const shipmentId = c("create#mantle.shipment.Shipment", {
            shipmentTypeEnumId: "ShpTpSales",
            statusId: "ShipShipped",
            fromPartyId: part.vendorPartyId,
            toPartyId: part.customerPartyId,
            shipDate: ec.user.nowTimestamp
        }).shipmentId
        c("create#mantle.shipment.ShipmentItem", {shipmentId, productId: item.productId, quantity: item.quantity})
        c("create#mantle.shipment.ShipmentItemSource", {
            shipmentId,
            productId: item.productId,
            orderId,
            orderItemSeqId: item.orderItemSeqId,
            quantity: item.quantity
        })
        c("create#mantle.shipment.ShipmentRouteSegment", {shipmentId, shipmentRouteSegmentSeqId: "01"})
        c("create#mantle.shipment.ShipmentPackage", {shipmentId, shipmentPackageSeqId: "01"})
        c("create#mantle.shipment.ShipmentPackageRouteSeg", {
            shipmentId,
            shipmentPackageSeqId: "01",
            shipmentRouteSegmentSeqId: "01",
            trackingCode,
            trackingUrl: "https://carrier.example.test/track/" + encodeURIComponent(trackingCode)
        })
        const invoiceId = c("create#mantle.account.invoice.Invoice", {
            invoiceTypeEnumId: "InvoiceSales",
            fromPartyId: part.vendorPartyId,
            toPartyId: part.customerPartyId,
            statusId: "InvoiceFinalized",
            invoiceDate: ec.user.nowTimestamp,
            currencyUomId: "USD"
        }).invoiceId
        c("create#mantle.account.invoice.InvoiceItem", {
            invoiceId,
            invoiceItemSeqId: "01",
            itemTypeEnumId: "ItemProduct",
            productId: item.productId,
            quantity: item.quantity,
            amount: item.unitAmount
        })
        c("create#mantle.order.OrderItemBilling", {
            orderId,
            orderItemSeqId: item.orderItemSeqId,
            invoiceId,
            invoiceItemSeqId: "01",
            quantity: item.quantity,
            amount: item.unitAmount
        })
        return {shipmentId, invoiceId}
    })
}
/* An order link of a known token (the SalesOrder kind's OrderView, as the storeless confirmation's mail makes one). */
function link(f, orderId, customerPartyId, token) {
    fx().system(() =>
        c("create#mantle.party.ExternalAccessCapability", {
            organizationPartyId: f.orgA,
            partyId: customerPartyId,
            recordType: "SalesOrder",
            recordId: orderId,
            scopes: "OrderView",
            tokenDigest: ec.user.singleUseCodeHash(token),
            issuerKind: "organization",
            fromDate: ec.user.nowTimestamp,
            thruDate: new Date(Date.now() + 30 * 86400000)
        })
    )
    return token
}
/* A site's Billing mount for the organization, and a public account's contact grant of it for a customer. */
function billing(siteId, organizationPartyId, partyId, outsidePartyId) {
    fx().system(() => {
        if (!ec.entity.find("mantle.public.PublicSiteApp").condition({siteId, app: "billing"}).one())
            c("create#mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "billing",
                app: "billing",
                pathPrefix: "/billing",
                enabled: "Y",
                targetId: organizationPartyId
            })
        if (partyId)
            c("create#mantle.party.ExternalAccessContact", {
                partyId,
                outsidePartyId,
                organizationPartyId,
                app: "billing",
                fromDate: ec.user.nowTimestamp
            })
    })
}
;({fx, seller, placed, shipAndInvoice, link, billing})
