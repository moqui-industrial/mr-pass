/* PASS Sales' pages' helpers (IronStone impl-sales P13): one request parameter, the page's notice and error carried across a
 * post's redirect, a post's operation through the facade (Portal.js attempt) answered by a redirect, and the quote's PDF. What
 * identifies a quote in a page's links and posts is its link's token, else (a signed-in contact) its order. CC0 plus patent
 * grant. */
const portal = ec.resource.script("component://mr-pass/screen/Shared/Portal.js")
/* A parameter's one value (a repeated one's first), or null. */
function param(name) {
    const value = ec.web.parameters[name]
    if (value == null || value === "") return null
    if (Array.isArray(value)) return value.length ? String(value[0]) : null
    if (typeof value === "object" && value.length != null) return value.length ? String(value[0]) : null
    return String(value)
}
/* The page's notice and error from the last post, read once. */
function take() {
    const s = ec.web.sessionAttributes
    const out = {
        notice: s.passSalesNotice || null,
        error: s.passSalesError || null,
        reason: s.passSalesReason || null
    }
    for (const name of ["passSalesNotice", "passSalesError", "passSalesReason"]) if (s[name]) s.remove(name)
    return out
}
const query = values => {
    const text = Object.entries(values || {})
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => k + "=" + encodeURIComponent(v))
        .join("&")
    return text ? "?" + text : ""
}
/* The quote a request names: its link's token and, for a signed-in contact, its order; an order beside a token must be the
 * token's (the authority checks it). */
function quoteOf() {
    return {token: param("token"), orderId: param("orderId")}
}
/* Run a post's operation and redirect: to done (a path and its parameters) on success, or back with the refusal as the error. */
function post(operation, input, back, done) {
    const out = portal.attempt(operation, input)
    const s = ec.web.sessionAttributes
    if (out.error) {
        s.passSalesError = out.error.message
        if (out.error.reason) s.passSalesReason = out.error.reason
        ec.web.response.sendRedirect(back.path + query(back.params))
        return out
    }
    const message = out.result?.receipt?.message || null
    if (message) s.passSalesNotice = message
    ec.web.response.sendRedirect(done.path + query(done.params))
    return out
}
/* The quote's PDF, streamed by the facade; a refusal shows the page's error. */
function download(siteId, input, back) {
    try {
        ec.resource.script("component://mr-pass/service/pass/Facade.js").downloadFile(siteId, "getSalesQuoteDocument", input)
    } catch (error) {
        ec.message.clearErrors()
        ec.web.sessionAttributes.passSalesError = "This document is not available."
        ec.web.response.sendRedirect(back.path + query(back.params))
    }
}
/* The base of a transition's page (its path without the transition's name). */
const base = (path, name) => String(path).replace(new RegExp("/" + name + "$"), "")
;({portal, param, take, post, download, base, query, quoteOf})
