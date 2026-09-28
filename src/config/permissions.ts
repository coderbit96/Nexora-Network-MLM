import type { ApplicationRoleName } from "@/types/domain";

/**
 * The sole source of permission identifiers. Application code must consume the
 * constants below rather than scattering string literals through route handlers.
 */
export const PERMISSION = {
  DASHBOARD: { VIEW: "dashboard.view", FINANCE: "dashboard.finance", SALES: "dashboard.sales" },
  MEMBERS: { VIEW: "members.view", CREATE: "members.create", EDIT: "members.edit", ACTIVATE: "members.activate", DEACTIVATE: "members.deactivate", VIEW_NETWORK: "members.viewNetwork", VIEW_FINANCIALS: "members.viewFinancials", EXPORT: "members.export" },
  GENEALOGY: { VIEW: "genealogy.view", VIEW_ALL: "genealogy.viewAll" },
  COMMISSIONS: { VIEW: "commissions.view", VIEW_ALL: "commissions.viewAll", MANAGE_RULES: "commissions.manageRules", RECALCULATE: "commissions.recalculate", EXPORT: "commissions.export" },
  WALLET: { VIEW: "wallet.view", VIEW_ALL: "wallet.viewAll", ADJUST: "wallet.adjust", EXPORT: "wallet.export" },
  WITHDRAWALS: { VIEW: "withdrawals.view", VIEW_ALL: "withdrawals.viewAll", APPROVE: "withdrawals.approve", REJECT: "withdrawals.reject", PROCESS: "withdrawals.process", COMPLETE: "withdrawals.complete", EXPORT: "withdrawals.export" },
  PRODUCTS: { VIEW: "products.view", CREATE: "products.create", EDIT: "products.edit", ACTIVATE: "products.activate", DELETE: "products.delete" },
  CATEGORIES: { VIEW: "categories.view", MANAGE: "categories.manage" },
  ORDERS: { VIEW: "orders.view", VIEW_ALL: "orders.viewAll", MANAGE: "orders.manage", CANCEL: "orders.cancel", REFUND: "orders.refund", EXPORT: "orders.export" },
  PAYMENTS: { VIEW: "payments.view", VERIFY: "payments.verify", MANAGE: "payments.manage", REFUND: "payments.refund" },
  REPORTS: { VIEW: "reports.view", MEMBERS: "reports.members", SALES: "reports.sales", COMMISSIONS: "reports.commissions", WALLET: "reports.wallet", WITHDRAWALS: "reports.withdrawals", EXPORT: "reports.export" },
  NOTIFICATIONS: { VIEW: "notifications.view", SEND: "notifications.send", MANAGE: "notifications.manage" },
  STAFF: { VIEW: "staff.view", CREATE: "staff.create", EDIT: "staff.edit", DISABLE: "staff.disable" },
  ROLES: { VIEW: "roles.view", CREATE: "roles.create", EDIT: "roles.edit", DELETE: "roles.delete", ASSIGN: "roles.assign" },
  SETTINGS: { VIEW: "settings.view", MANAGE: "settings.manage" },
  AUDIT: { VIEW: "audit.view", EXPORT: "audit.export" },
  SYSTEM: { MANAGE: "system.manage" },
} as const;

export type PermissionCategory = keyof typeof PERMISSION;
export type PermissionKey = {
  [Category in PermissionCategory]: (typeof PERMISSION)[Category][keyof (typeof PERMISSION)[Category]];
}[PermissionCategory];

export type PermissionMetadata = {
  key: PermissionKey;
  label: string;
  description: string;
  category: PermissionCategory;
  sensitive: boolean;
};

const permission = (key: PermissionKey, label: string, description: string, category: PermissionCategory, sensitive = false): PermissionMetadata => ({ key, label, description, category, sensitive });

/** Stable, display-ready metadata used for database initialization and future RBAC management. */
export const PERMISSION_CATALOG = [
  permission(PERMISSION.DASHBOARD.VIEW, "View dashboard", "View operational dashboard summaries.", "DASHBOARD"),
  permission(PERMISSION.DASHBOARD.FINANCE, "View financial dashboard", "View wallet, commission, and withdrawal dashboard metrics.", "DASHBOARD"),
  permission(PERMISSION.DASHBOARD.SALES, "View sales dashboard", "View order and sales dashboard metrics.", "DASHBOARD"),
  permission(PERMISSION.MEMBERS.VIEW, "View members", "View member identities and profiles.", "MEMBERS"),
  permission(PERMISSION.MEMBERS.CREATE, "Create members", "Create application member records through approved operations.", "MEMBERS"),
  permission(PERMISSION.MEMBERS.EDIT, "Edit members", "Edit permitted member profile information.", "MEMBERS"),
  permission(PERMISSION.MEMBERS.ACTIVATE, "Activate members", "Activate pending or inactive member accounts.", "MEMBERS", true),
  permission(PERMISSION.MEMBERS.DEACTIVATE, "Deactivate members", "Suspend or deactivate member accounts.", "MEMBERS", true),
  permission(PERMISSION.MEMBERS.VIEW_NETWORK, "View member networks", "Inspect member sponsor, referral, and genealogy data.", "MEMBERS"),
  permission(PERMISSION.MEMBERS.VIEW_FINANCIALS, "View member financials", "View another member's wallet, orders, commissions, and withdrawals.", "MEMBERS", true),
  permission(PERMISSION.MEMBERS.EXPORT, "Export members", "Export member information.", "MEMBERS"),
  permission(PERMISSION.GENEALOGY.VIEW, "View genealogy", "View the authorized member genealogy scope.", "GENEALOGY"),
  permission(PERMISSION.GENEALOGY.VIEW_ALL, "View all genealogy", "Inspect genealogy for any member.", "GENEALOGY", true),
  permission(PERMISSION.COMMISSIONS.VIEW, "View commissions", "View the caller's commission information.", "COMMISSIONS"),
  permission(PERMISSION.COMMISSIONS.VIEW_ALL, "View all commissions", "View commission history for all members.", "COMMISSIONS", true),
  permission(PERMISSION.COMMISSIONS.MANAGE_RULES, "Manage commission rules", "Create, edit, or retire commission rules.", "COMMISSIONS", true),
  permission(PERMISSION.COMMISSIONS.RECALCULATE, "Recalculate commissions", "Run approved commission recalculation or recovery workflows.", "COMMISSIONS", true),
  permission(PERMISSION.COMMISSIONS.EXPORT, "Export commissions", "Export commission records.", "COMMISSIONS"),
  permission(PERMISSION.WALLET.VIEW, "View wallet", "View the caller's wallet and ledger.", "WALLET"),
  permission(PERMISSION.WALLET.VIEW_ALL, "View all wallets", "View wallets and ledger history for all members.", "WALLET", true),
  permission(PERMISSION.WALLET.ADJUST, "Adjust wallet", "Post a reasoned manual wallet adjustment.", "WALLET", true),
  permission(PERMISSION.WALLET.EXPORT, "Export wallets", "Export wallet and ledger data.", "WALLET"),
  permission(PERMISSION.WITHDRAWALS.VIEW, "View withdrawals", "View the caller's withdrawal history.", "WITHDRAWALS"),
  permission(PERMISSION.WITHDRAWALS.VIEW_ALL, "View all withdrawals", "View withdrawal requests for all members.", "WITHDRAWALS", true),
  permission(PERMISSION.WITHDRAWALS.APPROVE, "Approve withdrawals", "Approve pending withdrawal requests.", "WITHDRAWALS", true),
  permission(PERMISSION.WITHDRAWALS.REJECT, "Reject withdrawals", "Reject pending withdrawal requests.", "WITHDRAWALS", true),
  permission(PERMISSION.WITHDRAWALS.PROCESS, "Process withdrawals", "Mark approved withdrawals as processing.", "WITHDRAWALS", true),
  permission(PERMISSION.WITHDRAWALS.COMPLETE, "Complete withdrawals", "Mark processing withdrawals complete with a payment reference.", "WITHDRAWALS", true),
  permission(PERMISSION.WITHDRAWALS.EXPORT, "Export withdrawals", "Export withdrawal data.", "WITHDRAWALS"),
  permission(PERMISSION.PRODUCTS.VIEW, "View products", "View product catalog administration data.", "PRODUCTS"),
  permission(PERMISSION.PRODUCTS.CREATE, "Create products", "Create products.", "PRODUCTS"),
  permission(PERMISSION.PRODUCTS.EDIT, "Edit products", "Edit product details and commercial values.", "PRODUCTS"),
  permission(PERMISSION.PRODUCTS.ACTIVATE, "Activate products", "Activate or deactivate products.", "PRODUCTS", true),
  permission(PERMISSION.PRODUCTS.DELETE, "Delete products", "Archive products.", "PRODUCTS", true),
  permission(PERMISSION.CATEGORIES.VIEW, "View categories", "View product categories.", "CATEGORIES"),
  permission(PERMISSION.CATEGORIES.MANAGE, "Manage categories", "Create, edit, or delete product categories.", "CATEGORIES"),
  permission(PERMISSION.ORDERS.VIEW, "View orders", "View the caller's orders.", "ORDERS"),
  permission(PERMISSION.ORDERS.VIEW_ALL, "View all orders", "View orders for all members.", "ORDERS", true),
  permission(PERMISSION.ORDERS.MANAGE, "Manage orders", "Advance permitted order fulfillment states.", "ORDERS", true),
  permission(PERMISSION.ORDERS.CANCEL, "Cancel orders", "Cancel eligible orders.", "ORDERS", true),
  permission(PERMISSION.ORDERS.REFUND, "Refund orders", "Initiate an eligible order refund workflow.", "ORDERS", true),
  permission(PERMISSION.ORDERS.EXPORT, "Export orders", "Export order data.", "ORDERS"),
  permission(PERMISSION.PAYMENTS.VIEW, "View payments", "View payment records.", "PAYMENTS", true),
  permission(PERMISSION.PAYMENTS.VERIFY, "Verify payments", "Perform approved payment verification.", "PAYMENTS", true),
  permission(PERMISSION.PAYMENTS.MANAGE, "Manage payments", "Manage payment operations permitted by the provider workflow.", "PAYMENTS", true),
  permission(PERMISSION.PAYMENTS.REFUND, "Refund payments", "Initiate provider payment refunds.", "PAYMENTS", true),
  permission(PERMISSION.REPORTS.VIEW, "View reports", "Open reporting dashboards.", "REPORTS"),
  permission(PERMISSION.REPORTS.MEMBERS, "View member reports", "Run member reports.", "REPORTS"),
  permission(PERMISSION.REPORTS.SALES, "View sales reports", "Run sales and order reports.", "REPORTS"),
  permission(PERMISSION.REPORTS.COMMISSIONS, "View commission reports", "Run commission reports.", "REPORTS"),
  permission(PERMISSION.REPORTS.WALLET, "View wallet reports", "Run wallet reports.", "REPORTS"),
  permission(PERMISSION.REPORTS.WITHDRAWALS, "View withdrawal reports", "Run withdrawal reports.", "REPORTS"),
  permission(PERMISSION.REPORTS.EXPORT, "Export reports", "Export report results.", "REPORTS"),
  permission(PERMISSION.NOTIFICATIONS.VIEW, "View notifications", "View operational notification history.", "NOTIFICATIONS"),
  permission(PERMISSION.NOTIFICATIONS.SEND, "Send notifications", "Send approved notifications.", "NOTIFICATIONS", true),
  permission(PERMISSION.NOTIFICATIONS.MANAGE, "Manage notifications", "Manage notification operations.", "NOTIFICATIONS", true),
  permission(PERMISSION.STAFF.VIEW, "View staff", "View staff account records.", "STAFF"),
  permission(PERMISSION.STAFF.CREATE, "Create staff", "Create staff application access.", "STAFF", true),
  permission(PERMISSION.STAFF.EDIT, "Edit staff", "Edit staff account details.", "STAFF", true),
  permission(PERMISSION.STAFF.DISABLE, "Disable staff", "Disable staff application access.", "STAFF", true),
  permission(PERMISSION.ROLES.VIEW, "View roles", "View roles and assigned permissions.", "ROLES"),
  permission(PERMISSION.ROLES.CREATE, "Create roles", "Create non-system roles.", "ROLES", true),
  permission(PERMISSION.ROLES.EDIT, "Edit roles", "Change eligible role definitions.", "ROLES", true),
  permission(PERMISSION.ROLES.DELETE, "Delete roles", "Delete eligible non-system roles.", "ROLES", true),
  permission(PERMISSION.ROLES.ASSIGN, "Assign roles", "Assign roles to application users.", "ROLES", true),
  permission(PERMISSION.SETTINGS.VIEW, "View settings", "View business configuration.", "SETTINGS"),
  permission(PERMISSION.SETTINGS.MANAGE, "Manage settings", "Change business configuration.", "SETTINGS", true),
  permission(PERMISSION.AUDIT.VIEW, "View audit logs", "View sanitized audit records.", "AUDIT", true),
  permission(PERMISSION.AUDIT.EXPORT, "Export audit logs", "Export sanitized audit records.", "AUDIT", true),
  permission(PERMISSION.SYSTEM.MANAGE, "Manage system", "Perform restricted system administration.", "SYSTEM", true),
] as const satisfies readonly PermissionMetadata[];

export const PERMISSIONS = PERMISSION_CATALOG.map((item) => item.key) as readonly PermissionKey[];
export const PERMISSION_BY_KEY = Object.fromEntries(PERMISSION_CATALOG.map((item) => [item.key, item])) as Readonly<Record<PermissionKey, PermissionMetadata>>;

export const APPLICATION_ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF", "MEMBER"] as const;

export function isApplicationRoleName(value: unknown): value is ApplicationRoleName {
  return typeof value === "string" && (APPLICATION_ROLES as readonly string[]).includes(value);
}

export const SYSTEM_ROLE_SLUGS: Record<ApplicationRoleName, string> = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  STAFF: "staff",
  MEMBER: "member",
};

/** Current defaults preserve existing administrator/staff access while using granular keys. */
export const SYSTEM_ROLE_PERMISSIONS: Record<ApplicationRoleName, readonly PermissionKey[]> = {
  // Super administrators receive their unrestricted access in the centralized
  // policy check. Persisting every key here would make catalog changes brittle.
  SUPER_ADMIN: [],
  ADMIN: PERMISSIONS,
  STAFF: [
    PERMISSION.MEMBERS.VIEW, PERMISSION.GENEALOGY.VIEW_ALL, PERMISSION.COMMISSIONS.VIEW_ALL,
    PERMISSION.WALLET.VIEW_ALL, PERMISSION.WITHDRAWALS.VIEW_ALL, PERMISSION.PRODUCTS.VIEW,
    PERMISSION.PRODUCTS.CREATE, PERMISSION.PRODUCTS.EDIT, PERMISSION.PRODUCTS.ACTIVATE, PERMISSION.PRODUCTS.DELETE,
    PERMISSION.CATEGORIES.VIEW, PERMISSION.CATEGORIES.MANAGE, PERMISSION.ORDERS.VIEW_ALL,
    PERMISSION.ORDERS.MANAGE, PERMISSION.ORDERS.REFUND, PERMISSION.PAYMENTS.VIEW,
    PERMISSION.REPORTS.VIEW, PERMISSION.REPORTS.MEMBERS, PERMISSION.REPORTS.SALES,
    PERMISSION.REPORTS.COMMISSIONS, PERMISSION.REPORTS.WALLET, PERMISSION.REPORTS.WITHDRAWALS,
    PERMISSION.REPORTS.EXPORT,
  ],
  MEMBER: [
    // This grants only a member's own withdrawal-history endpoint; the route
    // still resolves the profile from the authenticated MongoDB user.
    PERMISSION.WITHDRAWALS.VIEW,
  ],
};

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && Object.hasOwn(PERMISSION_BY_KEY, value);
}
