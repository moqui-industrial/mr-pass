/** Versioned PASS facade DTOs. No Mantle entity or account catalog is needed by a remote frontend. */
export type Cursor = string & { readonly __passCursor: unique symbol }
export interface Capabilities {
    canDiscover: boolean
    canRead: boolean
    canStartTopic: boolean
    canReply: boolean
    canEdit: boolean
    canUpload: boolean
    canFlag: boolean
    canModerate: boolean
    canInvite: boolean
}
export interface PublicProfile { handle: string | null; displayName: string | null; avatarId?: string | null }
export interface Attachment { attachmentId: string; filename: string; mimeType: string; byteSize: number; altText?: string; scanState?: 'pending' | 'clean' | 'quarantined' }
export interface ReadMarker { consumedOrdinal: number; highestSeenOrdinal: number; markerRevision: number; unreadBoundary: number | null }
export interface Post {
    postId: string
    rootCommEventId: string
    ordinal: number
    revision: number
    author: PublicProfile
    entryDate: string | number
    body: string
    visibility: 'approved' | 'pending' | 'rejected' | 'deleted'
    parentCommEventId: string | null
    capabilities: Capabilities
    attachments: Attachment[]
}
export interface PostWindow { postList: Post[]; nextCursor: Cursor | null; revision: number; generation: number }
export interface PublishedPost { postId: string; rootCommEventId: string; ordinal: number; revision: number; state: 'published' | 'pending' }
/** A refusal: its kind (code), an allow-listed camelCase reason (design-shop §7.3; impl-shop P1, F4), the request's own text for Unprocessable and Conflict, else a fixed one. */
export interface SafeError { code: string; reason: string | null; message: string; fieldErrors: { field: string; reason?: string | null; message?: string }[]; correlationId: string }
export interface HostInput { hostname: string; canonical?: boolean }
export interface MountInput { app: 'forum' | 'account' | 'members' | 'sites' | 'billing' | 'supplier' | 'support' | 'shop'; pathPrefix: string; enabled?: boolean; appMountId?: string; targetId?: string }
/** A site's active Shop theme release (impl-shop P2): the manifest digest pins every file. */
export interface ShopRelease { releaseId: string; manifestDigest: string; engine: string; viewApiVersion: number }
/** getShopContext (impl-shop P1): the trusted Shop context of the routed site; release is P2's active theme release. */
export interface ShopContext {
    site: { siteId: string; name: string; locale: string; timeZone: string; generation: number }
    mount: { pathPrefix: string; base: string }
    store: { productStoreId: string; name: string }
    locale: string
    currency: string | null
    release: ShopRelease | null
    capabilities: { canBrowse: boolean; canUseCart: boolean; canPurchase: boolean; signedIn: boolean }
}
/** Shop P4: a cart line (design-shop §6 Cart): the purchasable product (a variant's options), its link, quantity, the unit
 * price set when it was added or changed, its adjustments and total, and whether it can still be bought (a changed price
 * named with the current one). */
export interface CartLine {
    orderItemSeqId: string
    productId: string
    name: string
    options: string | null
    url: string | null
    sku: string | null
    quantity: string
    unitPrice: ShopPrice
    adjustments: { label: string; amount: ShopPrice }[]
    total: ShopPrice
    available: boolean
    availability: { code: string; label: string } | null
    priceChanged: boolean
    currentPrice: ShopPrice | null
}
/** Shop P4: getCart and every cart write's answer; token only when a capability is issued (the first add, sign-in). */
export interface CartView {
    cart: {
        revision: string | null
        currencyUomId: string
        items: CartLine[]
        promoCodes: { code: string; label: string | null }[]
        totals: { items: ShopPrice; discounts: ShopPrice; shipping: ShopPrice | null; tax: ShopPrice | null; total: ShopPrice }
        itemCount: number
        notices: { code: string; text: string }[]
        empty: boolean
        checkoutPending?: boolean
    }
    /** the mini-cart projection */
    summary: { itemCount: number; subtotal: ShopPrice }
    token?: string
    alreadyApplied?: boolean
    attached?: boolean
    merged?: boolean
    unavailableItems?: string[]
}
/** The view contract v1 (design-shop §12.3): plain approved data only, never ec, an entity, a session or a secret. */
export interface ShopView {
    site: { displayName: string; locale: string }
    shop: { name: string; baseUrl: string; currencyUomId: string | null }
    locale: string
    page: { kind: string; canonicalUrl?: string; title?: string }
    navigation: { label: string; url: string }[]
    product?: Record<string, unknown>
    category?: Record<string, unknown>
    productList?: Record<string, unknown>[]
    cart?: Record<string, unknown>
    checkout?: Record<string, unknown>
    account?: Record<string, unknown>
}
/** Shop P3: the registered sort keys of the catalog lists. */
export type ShopSort = 'featured' | 'name' | 'newest'
/** Shop P3: what every catalog answer carries, which a frontend keys its caches by (F43). */
export interface ShopPublication { generation: number; releaseId: string | null }
/** Shop P3: a price as decimal text with its display; available false is a price that is not set (never a zero one). */
export interface ShopPrice { amount: string | null; currencyUomId: string; display: string; available: boolean }
/** Shop P3: a product card; availability is a band (inStock, lowStock, backorder, outOfStock, available, unknown). */
export interface ShopProductCard {
    id: string
    name: string
    url: string
    sku: string
    price: ShopPrice
    compareAtPrice: ShopPrice | null
    availability: { code: string; label: string; purchasable: boolean }
    badge: string | null
}
/** Shop P3: a page of products; nextCursor null on the last page. */
export interface ShopProductPage extends ShopPublication { products: ShopProductCard[]; nextCursor: string | null; sort: ShopSort }
/** getShopPage (impl-shop P2): a Shop page's view and active release (null: no theme is published). */
export interface ShopPage {
    status: number
    generation: number
    release: ShopRelease | null
    view: ShopView
    /** Commerce P5 (F77): the page's alternate template when the active release has it, else absent (the kind's default). */
    template?: string | null
    references: Record<string, { url: string; label?: string }>
    media: Record<string, { url: string; alt?: string }>
    sources: Record<string, unknown[]>
}
/** Server-owned uploaded file handle. It is never a browser-supplied resource location. */
export interface UploadedFile { readonly name: string; readonly size: number; readonly contentType: string }
export interface PollInput {
    question: string
    options: string[]
    maxChoices?: number
    closesAt?: number | string | null
    resultsPolicy?: 'always' | 'voted' | 'closed'
    revealVoters?: boolean
    allowChange?: boolean
}
export interface OperationInputs {
    findSites: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    createSite: {
        name?: string
        ownerPartyId?: string
        locale?: string
        timeZone?: string
    }
    updateSite: {
        siteId: string
        expectedRevision?: number
        name?: string
        locale?: string
        timeZone?: string
        state?: string
        subscriptionUrl?: string
        publishingWikiSpaceId?: string
    }
    getMembership: {
        siteId: string
    }
    joinSite: {
        siteId: string
    }
    leaveSite: {
        siteId: string
        expectedRevision?: number
    }
    setMembership: {
        siteId: string
        targetPartyId?: string
        state?: string
        expectedRevision?: number
        reason?: string
    }
    setSiteRole: {
        siteId: string
        targetPartyId?: string
        role?: string
        expectedRevision?: number
        password?: string
        code?: string
        reason?: string
    }
    findMembers: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    storeProfile: {
        siteId: string
        handle?: string
        displayName?: string
        avatarId?: string
        bio?: string
        discoverability?: string
        locale?: string
        timeZone?: string
        expectedRevision?: number
    }
    getProfile: {
        siteId: string
        handle?: string
    }
    getSitePage: {
        siteId: string
        pageRole?: string
    }
    checkReadiness: {
        siteId: string
    }
    storeMounts: {
        siteId: string
        mounts?: MountInput[]
        hosts?: HostInput[]
        expectedRevision?: number
    }
    updateMembershipPolicy: {
        siteId: string
        registrationMode?: string
        approvalRequired?: boolean
        expectedRevision?: number
    }
    createInvitation: {
        siteId: string
        emailAddress?: string
        expiresAt?: string | number
        operationId: string
    }
    inspectInvitation: {
        siteId: string
        token?: string
        emailAddress?: string
    }
    redeemInvitation: {
        siteId: string
        token?: string
    }
    revokeInvitation: {
        siteId: string
        invitationId?: string
    }
    findCategories: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    getCategory: {
        siteId: string
        contactListId?: string
    }
    storeCategory: {
        siteId: string
        contactListId?: string
        parentContactListId?: string
        name?: string
        slug?: string
        sequenceNum?: number
        rules?: string
        expectedRevision?: number
        confirmAudience?: boolean
        operationId?: string
        mode?: string
    }
    previewCategoryAccess: {
        siteId: string
        contactListId?: string
        visibility?: string
        qualifyingSources?: Array<'manual' | 'subscription'>
    }
    setCategoryAccess: {
        siteId: string
        contactListId?: string
        visibility?: string
        publicationState?: string
        expectedRevision?: number
        confirm?: boolean
        qualifyingSources?: Array<'manual' | 'subscription'>
    }
    findTopics: {
        siteId: string
        contactListId?: string
        query?: string
        limit?: number
        cursor?: Cursor
        view?: string
        authorHandle?: string
        tag?: string
        solved?: string
        period?: string
    }
    getTopic: {
        siteId: string
        rootCommEventId?: string
    }
    getPosts: {
        siteId: string
        rootCommEventId?: string
        limit?: number
        cursor?: Cursor
        before?: number
        after?: number
        around?: string
    }
    searchForum: {
        siteId: string
        contactListId?: string
        query?: string
        limit?: number
        cursor?: Cursor
        scope?: string
    }
    storeDraft: {
        siteId: string
        draftId?: string
        mode?: string
        contactListId?: string
        rootCommEventId?: string
        parentCommEventId?: string
        title?: string
        body?: string
        expectedRevision?: number
        postId?: string
        postRevision?: number
        tags?: string[]
        poll?: PollInput
    }
    findDrafts: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    discardDraft: {
        siteId: string
        draftId?: string
        expectedRevision?: number
    }
    previewPost: {
        siteId: string
        body?: string
    }
    publishPost: {
        siteId: string
        contactListId?: string
        rootCommEventId?: string
        parentCommEventId?: string
        title?: string
        body?: string
        operationId: string
        attachmentIds?: string[]
        draftId?: string
        tags?: string[]
        poll?: PollInput
    }
    updatePost: {
        siteId: string
        postId?: string
        body?: string
        expectedRevision?: number
        reason?: string
        draftId?: string
        attachmentIds?: string[]
    }
    markRead: {
        siteId: string
        rootCommEventId?: string
        ordinal?: number
        expectedRevision?: number
        markUnread?: boolean
        renderedPostIds?: string[]
        jump?: boolean
    }
    flagPost: {
        siteId: string
        postId?: string
        reason?: string
        operationId: string
    }
    findReviews: {
        siteId: string
        contactListId?: string
        limit?: number
        cursor?: Cursor
    }
    getReview: {
        siteId: string
        reviewId?: string
    }
    claimReview: {
        siteId: string
        reviewId?: string
        expectedRevision?: number
    }
    decideReview: {
        siteId: string
        reviewId?: string
        expectedRevision?: number
        decision?: string
        reason?: string
    }
    applyTopicAction: {
        siteId: string
        rootCommEventId?: string
        action?: string
        title?: string
        expectedRevision?: number
        reason?: string
        targetContactListId?: string
        confirmAudience?: boolean
        expectedGeneration?: number
        postId?: string
        active?: boolean
        postIds?: string[]
        targetRootCommEventId?: string
        slowIntervalSeconds?: number
        timerAction?: string
        dueAt?: number | string
    }
    findActions: {
        siteId: string
        contactListId?: string
        limit?: number
        cursor?: Cursor
    }
    setSanction: {
        siteId: string
        contactListId?: string
        targetPartyId?: string
        kind?: string
        thruDate?: string | number
        reason?: string
        operationId: string
    }
    getMember: {
        siteId: string
        contactListId?: string
        targetPartyId?: string
    }
    getPreferences: {
        siteId: string
        scopeType?: string
        scopeId?: string
    }
    setPreferences: {
        siteId: string
        scopeType?: string
        scopeId?: string
        watchLevel?: string
        emailMode?: string
        expectedRevision?: number
        digestPeriod?: string
        includeOwn?: boolean
    }
    findDeliveries: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    storeMailSettings: {
        siteId: string
        senderAddress?: string
        senderName?: string
        templateId?: string
        expectedRevision?: number
    }
    inspectOptOut: {
        siteId: string
        token?: string
    }
    applyOptOut: {
        siteId: string
        token?: string
        scopeType?: string
    }
    getHealth: {
        siteId: string
        cursor?: Cursor
        limit?: number
    }
    stageAttachment: {
        siteId: string
        contactListId?: string
        draftId?: string
        file?: UploadedFile
        altText?: string
        purpose?: string
        rootCommEventId?: string
    }
    removeStagedAttachment: {
        siteId: string
        attachmentId?: string
    }
    getAttachment: {
        siteId: string
        attachmentId?: string
        variant?: string
    }
    findNotifications: {
        siteId: string
        cursor?: Cursor
        limit?: number
        view?: 'all' | 'unread'
    }
    markNotifications: {
        siteId: string
        deliveryIds?: string[]
        all?: boolean
    }
    storePolicy: {
        siteId: string
        config?: Record<string, string | number | boolean>
        expectedRevision?: number
        reason?: string
    }
    getPolicy: {
        siteId: string
    }
    getSiteInfo: {
        siteId: string
        hostname?: string
    }
    getDraft: {
        siteId: string
        draftId?: string
    }
    joinCategory: {
        siteId: string
        contactListId?: string
    }
    leaveCategory: {
        siteId: string
        contactListId?: string
    }
    findCategoryMembers: {
        siteId: string
        contactListId?: string
        cursor?: Cursor
        limit?: number
    }
    setCategoryMember: {
        siteId: string
        contactListId?: string
        targetPartyId?: string
        state?: string
        roleTypeId?: string
        expectedRevision?: number
        reason?: string
        password?: string
        code?: string
    }
    bindMailbox: {
        siteId: string
        contactListId?: string
        operationId: string
        confirm?: boolean
    }
    findRuns: {
        siteId: string
        cursor?: Cursor
        limit?: number
    }
    publishSitePage: {
        siteId: string
        pageRole?: string
        wikiPageId?: string
        versionName?: string
        expectedRevision?: number
    }
    getFeed: {
        siteId: string
        format?: string
    }
    getPostLocation: {
        siteId: string
        postId?: string
    }
    getEditablePost: {
        siteId: string
        postId?: string
    }
    previewTopicAction: {
        siteId: string
        rootCommEventId?: string
        targetContactListId?: string
        action?: string
        postIds?: string[]
        targetRootCommEventId?: string
    }
    resolveDelivery: {
        siteId: string
        deliveryId?: string
        expectedRevision?: number
        decision?: string
        reason?: string
    }
    addReviewNote: {
        siteId: string
        reviewId?: string
        body?: string
        operationId: string
    }
    manageRun: {
        siteId: string
        runId?: string
        action?: string
        reason?: string
    }
    endSanction: {
        siteId: string
        sanctionId?: string
        expectedRevision?: number
        reason?: string
    }
    findTags: {
        siteId: string
        query?: string
        limit?: number
        cursor?: Cursor
    }
    storeTag: {
        siteId: string
        tagId?: string
        name?: string
        description?: string
        allowedCategories?: string[]
        expectedRevision?: number
        reason?: string
        operationId: string
    }
    mergeTag: {
        siteId: string
        tagId?: string
        targetTagId?: string
        expectedRevision?: number
        reason?: string
        operationId: string
    }
    setReaction: {
        siteId: string
        postId?: string
        reactionKey?: string
        active?: boolean
    }
    acceptAnswer: {
        siteId: string
        rootCommEventId?: string
        postId?: string
        expectedRevision?: number
        reason?: string
    }
    getPoll: {
        siteId: string
        pollId?: string
    }
    votePoll: {
        siteId: string
        pollId?: string
        optionIds?: string[]
    }
    storeBookmark: {
        siteId: string
        bookmarkId?: string
        postId?: string
        note?: string
        remindAt?: number | string
        expectedRevision?: number
    }
    removeBookmark: {
        siteId: string
        bookmarkId?: string
    }
    findBookmarks: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    getPostHistory: {
        siteId: string
        postId?: string
    }
    comparePostRevisions: {
        siteId: string
        postId?: string
        fromRevision?: number
        toRevision?: number
    }
    restorePostRevision: {
        siteId: string
        postId?: string
        revision?: number
        expectedRevision?: number
        reason?: string
    }
    deletePost: {
        siteId: string
        postId?: string
        expectedRevision?: number
        reason?: string
    }
    storeRule: {
        siteId: string
        ruleId?: string
        contactListId?: string
        ruleType?: string
        pattern?: string
        action?: string
        active?: boolean
        sequenceNum?: number
        expectedRevision?: number
        reason?: string
        operationId: string
    }
    findRules: {
        siteId: string
    }
    testRule: {
        siteId: string
        ruleType?: string
        pattern?: string
        body?: string
    }
    setTrust: {
        siteId: string
        targetPartyId?: string
        trustLevel?: string
        locked?: boolean
        reason?: string
        expectedRevision?: number
    }
    decideReviews: {
        siteId: string
        reviewIds?: string[]
        decision?: string
        reason?: string
    }
    appealReview: {
        siteId: string
        reviewId?: string
        reason?: string
        operationId: string
    }
    findMyReviews: {
        siteId: string
    }
    createConversation: {
        siteId: string
        participantHandles?: string[]
        title?: string
        body?: string
        attachmentIds?: string[]
        operationId: string
    }
    findConversations: {
        siteId: string
        view?: string
        limit?: number
        cursor?: Cursor
    }
    updateParticipants: {
        siteId: string
        rootCommEventId?: string
        participantHandles?: string[]
        targetHandles?: string[]
        ownerHandles?: string
        confirm?: boolean
        expectedRevision?: number
    }
    setConversationState: {
        siteId: string
        rootCommEventId?: string
        action?: string
    }
    setMemberPreference: {
        siteId: string
        targetHandle?: string
        preference?: string
        expiresAt?: number | string
    }
    escalateReview: {
        siteId: string
        reviewId?: string
        reason?: string
        active?: boolean
    }
    storeRoute: {
        siteId: string
        routeId?: string
        address?: string
        contactListId?: string
        active?: boolean
        expectedRevision?: number
        operationId: string
    }
    findRoutes: {
        siteId: string
    }
    findInboundReceipts: {
        siteId: string
        limit?: number
        cursor?: Cursor
    }
    testRoute: {
        siteId: string
        routeId?: string
    }
    retryInbound: {
        siteId: string
        receiptId?: string
    }
    setAccessGrant: {
        siteId: string
        handle?: string
        targetType?: 'site' | 'category'
        contactListId?: string
        fromDate?: string | number
        thruDate?: string | number
        reason?: string
        operationId: string
        wikiPageId?: string
    }
    endAccessGrant: {
        siteId: string
        grantId?: string
        expectedRevision?: number
        reason?: string
    }
    findAccessGrants: {
        siteId: string
        contactListId?: string
        handle?: string
        limit?: number
        cursor?: Cursor
    }
    storeSubscriptionBinding: {
        siteId: string
        subscriptionResourceId?: string
        targetType?: 'site' | 'category'
        contactListId?: string
        reason?: string
        wikiPageId?: string
    }
    findSubscriptionBindings: {
        siteId: string
    }
    getTopicLinks: {
        siteId: string
        rootCommEventId?: string
    }
    createCaseFromTopic: {
        siteId: string
        rootCommEventId?: string
        postIds?: string[]
        requestCategoryId?: string
        reason?: string
        operationId: string
    }
    previewCaseReply: {
        siteId: string
        rootCommEventId?: string
        requestId?: string
        body?: string
    }
    publishCaseReply: {
        siteId: string
        rootCommEventId?: string
        requestId?: string
        body?: string
        previewHash?: string
        operationId: string
    }
    linkDiscussion: {
        siteId: string
        rootCommEventId?: string
        sourceType?: 'product' | 'article'
        sourceId?: string
        gate?: 'narrow' | 'none'
        reason?: string
        operationId: string
    }
    detachDiscussion: {
        siteId: string
        linkId?: string
        confirmAudience?: boolean
        reason?: string
    }
    draftArticleFromTopic: {
        siteId: string
        rootCommEventId?: string
        postIds?: string[]
        title?: string
        reviewerUsername?: string
        reason?: string
        operationId: string
    }
    findModerationScopes: Record<string, never>
    getRetentionPolicy: {
        siteId: string
    }
    storeRetentionPolicy: {
        siteId: string
        deliveryDays?: number
        inboundDays?: number
        deletedPostDays?: number
        jobDays?: number
        invitationDays?: number
        expectedRevision?: number
        reason?: string
    }
    previewOperation: {
        siteId: string
        operation?: 'rebuild-counters' | 'retry-deliveries' | 'retention' | 'export-site'
        contactListId?: string
    }
    startOperation: {
        siteId: string
        operation?: 'rebuild-counters' | 'retry-deliveries' | 'retention' | 'export-site'
        contactListId?: string
        dryRun?: boolean
        expectedRevision?: number
        reason?: string
    }
    requestPersonalDataAction: {
        siteId: string
        kind?: 'export' | 'erasure'
        reason?: string
        confirm?: boolean
    }
    findDataRequests: {
        siteId: string
        mine?: boolean
        limit?: number
        cursor?: Cursor
    }
    decideDataRequest: {
        siteId: string
        requestId?: string
        decision?: 'approved' | 'rejected'
        reason?: string
        expectedRevision?: number
    }
    findExports: {
        siteId: string
    }
    getExport: {
        siteId: string
        exportId?: string
    }
    getActivity: {
        siteId: string
        contactListId?: string
        fromDate?: string | number
        thruDate?: string | number
        interval?: 'day' | 'week'
    }
    exportReport: {
        siteId: string
        report?: 'activity' | 'moderation' | 'deliveries'
        contactListId?: string
        fromDate?: string | number
        thruDate?: string | number
    }
    registerImport: {
        siteId: string
        archiveName?: string
        checksum?: string
        sourceName?: string
    }
    stageImport: {
        siteId: string
        importId?: string
    }
    storeImportMappings: {
        siteId: string
        importId?: string
        mappings?: Array<{ mappingType: 'identity' | 'staff' | 'group' | 'feature'; sourceId: string; decision: string; targetId?: string; reason?: string }>
        reason?: string
    }
    findImports: {
        siteId: string
    }
    getImport: {
        siteId: string
        importId?: string
    }
    runImport: {
        siteId: string
        importId?: string
        reason?: string
    }
    reconcileImport: {
        siteId: string
        importId?: string
    }
    approveImport: {
        siteId: string
        importId?: string
        role?: 'operator' | 'owner'
        expectedRevision?: number
        reason?: string
    }
    activateImport: {
        siteId: string
        importId?: string
        sourceFrozen?: boolean
        backupReference?: string
        confirm?: boolean
    }
    cancelImport: {
        siteId: string
        importId?: string
        reason?: string
    }
    resolvePermalink: {
        siteId: string
        path?: string
    }
    getShopContext: {
        siteId: string
    }
    getShopPage: {
        siteId: string
        pageKind: string
        /** P3: the catalog kinds' inputs */
        productId?: string
        variantId?: string
        quantity?: string
        productCategoryId?: string
        query?: string
        sort?: ShopSort
        cursor?: string
        routePath?: string
    }
    /** registered frontends only */
    getShopThemeRelease: {
        siteId: string
        releaseId: string
    }
    /** registered frontends only; at most 50 comma-separated paths */
    getShopThemeFiles: {
        siteId: string
        releaseId: string
        paths: string
    }
    getSiteGeneration: {
        siteId: string
    }
    /** Shop P3: the catalog reads; each answers ShopPublication's fields */
    getShopHome: { siteId: string }
    getStoreCategories: { siteId: string }
    getStoreCategory: { siteId: string; productCategoryId: string; sort?: ShopSort; cursor?: string; limit?: string }
    findProducts: { siteId: string; productCategoryId?: string; query?: string; sort?: ShopSort; cursor?: string; limit?: string }
    searchShop: { siteId: string; query: string; sort?: ShopSort; cursor?: string; limit?: string }
    getProduct: { siteId: string; productId: string; variantId?: string; quantity?: string }
    quoteSelection: { siteId: string; productId: string; variantId?: string; quantity?: string }
    getStorePage: { siteId: string; routePath: string }
    getShopSitemap: { siteId: string }
    /** Commerce P4's live menu and redirects of the site's Shop mount */
    getSiteNavigation: { siteId: string; menuKey?: string; locale?: string }
    resolveSiteRedirect: { siteId: string; path: string }
    /** Shop P4: the cart; token is the presentation session's cart capability (never an order id) */
    getCart: { siteId: string; token?: string }
    addCartItem: { siteId: string; token?: string; productId: string; variantId?: string; quantity?: string; expectedRevision?: string; operationId?: string }
    updateCartItem: { siteId: string; token: string; orderItemSeqId: string; quantity: string; expectedRevision: string; operationId?: string }
    removeCartItem: { siteId: string; token: string; orderItemSeqId: string; expectedRevision: string; operationId?: string }
    applyPromoCode: { siteId: string; token: string; promoCode: string; expectedRevision: string; operationId?: string }
    removePromoCode: { siteId: string; token: string; promoCode: string; expectedRevision: string; operationId?: string }
    /** signed in: attach (sign-in) and release (sign-out) the session's cart */
    attachCart: { siteId: string; token?: string }
    releaseCart: { siteId: string; token?: string }
}
export type Operation = keyof OperationInputs
export type Request<O extends Operation> = { operation: O; input: OperationInputs[O] }
export type Result<O extends Operation> = O extends 'getPosts' ? PostWindow : O extends 'publishPost' ? PublishedPost : O extends 'markRead' ? { marker: ReadMarker } : O extends 'getShopContext' ? ShopContext : O extends 'getShopPage' ? ShopPage : O extends 'getSiteGeneration' ? { siteId: string; generation: number; release: { releaseId: string; manifestDigest: string } | null } : Record<string, unknown>
