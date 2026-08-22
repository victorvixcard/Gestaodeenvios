import type { User, Product, Company, Order, OrderItem, OrderNote, OrderEvent, Permission } from '../types'
import type { LogEntry, LogAction, LogEntityType } from '../contexts/LogsContext'
import type { UserRole } from '../types'

export function mapUser(u: Record<string, unknown>): User {
  const name = String(u.name ?? '')
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return {
    id: String(u.id),
    name,
    email: String(u.email ?? ''),
    role: (u.role as UserRole) ?? 'operator',
    tenantSlug: String(u.tenant_slug ?? u.tenantSlug ?? ''),
    avatarInitials: String(u.avatar_initials ?? u.avatarInitials ?? initials),
    avatarUrl: (u.avatar_url ?? u.avatarUrl) as string | undefined,
    active: Boolean(u.active),
    permissions: (u.permissions as Permission[]) ?? [],
    whatsapp: (u.whatsapp as string | null) ?? undefined,
    sectors: ((u.sectors as Array<{ id: number | string; name: string }> | null) ?? [])
      .map((s) => ({ id: String(s.id), name: s.name })),
  }
}

export function mapProduct(p: Record<string, unknown>): Product {
  return {
    id: String(p.id),
    code: String(p.code ?? ''),
    name: String(p.name ?? ''),
    description: String(p.description ?? ''),
    category: String(p.category ?? ''),
    imageUrl: (p.image_url ?? p.imageUrl) as string | undefined,
    videoUrl: (p.video_url ?? p.videoUrl) as string | undefined,
    price: p.price != null ? Number(p.price) : undefined,
    stock: Number(p.stock ?? 0),
    active: Boolean(p.active),
    variations: p.variations as Product['variations'],
  }
}

export function mapCompany(c: Record<string, unknown>): Company {
  const products = c.products as Array<{ id: number | string }> | null | undefined
  const allowedProductIds: string[] = products
    ? products.map((p) => String(p.id))
    : (c.allowedProductIds as string[] | undefined) ?? []

  return {
    slug: String(c.slug ?? ''),
    name: String(c.name ?? ''),
    logoColor: String(c.logoColor ?? c.logo_color ?? '#000000'),
    logoInitials: String(c.logoInitials ?? c.logo_initials ?? ''),
    logoUrl: (c.logoUrl ?? c.logo_url) as string | undefined,
    active: Boolean(c.active),
    allowedProductIds,
    createdAt: String(c.createdAt ?? c.created_at ?? new Date().toISOString()),
  }
}

export function mapOrderItem(item: Record<string, unknown>): OrderItem {
  return {
    productId: String(item.product_id ?? item.productId ?? ''),
    productName: String(item.product_name ?? item.productName ?? ''),
    quantity: Number(item.quantity ?? 0),
    specifications: String(item.specifications ?? ''),
    selectedVariations: (item.selected_variations ?? item.selectedVariations) as OrderItem['selectedVariations'],
    deadline: (item.deadline as string | null) ?? undefined,
    deadlineDays: item.deadlineDays != null ? Number(item.deadlineDays) : undefined,
    isOverdue: Boolean(item.isOverdue),
    overdueDays: Number(item.overdueDays ?? 0),
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
    lineTotal: item.lineTotal != null ? Number(item.lineTotal) : undefined,
  }
}

export function mapOrderNote(note: Record<string, unknown>): OrderNote {
  return {
    id: String(note.id),
    authorName: String(note.author_name ?? note.authorName ?? ''),
    authorRole: (note.author_role ?? note.authorRole) as OrderNote['authorRole'],
    content: String(note.content ?? ''),
    createdAt: String(note.created_at ?? note.createdAt ?? ''),
  }
}

export function mapOrderEvent(event: Record<string, unknown>): OrderEvent {
  return {
    id: String(event.id),
    type: event.type as OrderEvent['type'],
    description: String(event.description ?? ''),
    authorName: String(event.author_name ?? event.authorName ?? ''),
    status: event.status as OrderEvent['status'],
    createdAt: String(event.created_at ?? event.createdAt ?? ''),
  }
}

export function mapOrder(o: Record<string, unknown>): Order {
  const items = (o.items as Record<string, unknown>[] | null) ?? []
  const notes = (o.notes as Record<string, unknown>[] | null) ?? []
  const events = (o.events as Record<string, unknown>[] | null) ?? []
  return {
    id: String(o.id ?? ''),
    tenantSlug: String(o.tenantSlug ?? o.tenant_slug ?? ''),
    tenantName: String(o.tenantName ?? o.tenant_name ?? o.tenantSlug ?? ''),
    title: String(o.title ?? ''),
    status: o.status as Order['status'],
    items: items.map(mapOrderItem),
    notes: notes.map(mapOrderNote),
    events: events.map(mapOrderEvent),
    cancelReason: (o.cancelReason ?? o.cancel_reason) as string | undefined,
    requestedBy: String(o.requestedBy ?? o.requested_by ?? ''),
    assignedTo: (o.assignedTo ?? o.assigned_to) as string | undefined,
    createdAt: String(o.createdAt ?? o.created_at ?? ''),
    updatedAt: String(o.updatedAt ?? o.updated_at ?? ''),
    files: (o.files as Order['files']) ?? [],
  }
}

export function mapLog(l: Record<string, unknown>): LogEntry {
  return {
    id: String(l.id),
    timestamp: String(l.created_at ?? l.timestamp ?? ''),
    action: (l.action as LogAction),
    entityType: (l.entity_type ?? l.entityType) as LogEntityType,
    entityId: String(l.entity_id ?? l.entityId ?? ''),
    entityName: String(l.entity_name ?? l.entityName ?? ''),
    userName: String(l.user_name ?? l.userName ?? ''),
    userEmail: String(l.user_email ?? l.userEmail ?? ''),
    userRole: (l.user_role ?? l.userRole) as UserRole,
    tenantSlug: String(l.tenant_slug ?? l.tenantSlug ?? ''),
    details: (l.details as string | undefined),
  }
}
