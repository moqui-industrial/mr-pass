/* PASS Marketing's pages' helpers (IronStone impl-marketing P7): one request parameter, the page's notice, error and field carried
 * across a post's redirect, and a post's operation through the facade (Portal.js attempt) answered by a redirect. CC0 plus
 * patent grant. */
const portal = ec.resource.script("component://mr-pass/screen/Shared/Portal.js")
/* A parameter's one value (a repeated one's first), or null. */
function param(name) {
    const value = ec.web.parameters[name]
    if (value == null || value === "") return null
    if (Array.isArray(value)) return value.length ? String(value[0]) : null
    if (typeof value === "object" && value.length != null) return value.length ? String(value[0]) : null
    return String(value)
}
/* A parameter's values (a checkbox group), each once. */
function params(name) {
    const value = ec.web.parameters[name]
    if (value == null || value === "") return []
    const all = Array.isArray(value) || (typeof value === "object" && value.length != null) ? Array.from(value) : [value]
    return [...new Set(all.map(String).filter(v => v))]
}
const NAMES = ["passMarketingNotice", "passMarketingError", "passMarketingField", "passMarketingReceipt"]
/* The page's notice, error, error field and receipt from the last post, read once. */
function take() {
    const s = ec.web.sessionAttributes
    const out = {
        notice: s.passMarketingNotice || null,
        error: s.passMarketingError || null,
        field: s.passMarketingField || null,
        receipt: s.passMarketingReceipt || null
    }
    for (const name of NAMES) if (s[name]) s.remove(name)
    return out
}
const query = values => {
    const text = Object.entries(values || {})
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => k + "=" + encodeURIComponent(v))
        .join("&")
    return text ? "?" + text : ""
}
/* Run a post's operation and redirect: to done (a path and its parameters) with the result's receipt, or back with the refusal. */
function post(operation, input, back, done) {
    const out = portal.attempt(operation, input)
    const s = ec.web.sessionAttributes
    if (out.error) {
        s.passMarketingError = out.error.message
        const field = out.error.fieldErrors?.[0]?.field
        if (field) s.passMarketingField = field
        ec.web.response.sendRedirect(back.path + query(back.params))
        return out
    }
    const message = out.result?.receipt?.message || null
    if (message) s.passMarketingReceipt = message
    ec.web.response.sendRedirect(done.path + query(done.params))
    return out
}
/* The base of a transition's page (its path without the transition's name). */
const base = (path, name) => String(path).replace(new RegExp("/" + name + "$"), "")
;({portal, param, params, take, post, base, query})
