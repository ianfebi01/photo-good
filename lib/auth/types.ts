export const roles = ['super_admin', 'admin', 'operator', 'viewer'] as const

export type Role = ( typeof roles )[number]

export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

const roleRank: Record<Role, number> = {
  viewer      : 0,
  operator    : 1,
  admin       : 2,
  super_admin : 3,
}

export function hasRole( userRole: Role, requiredRole: Role ) {
  return roleRank[userRole] >= roleRank[requiredRole]
}

export function isRole( value: string ): value is Role {
  return roles.includes( value as Role )
}
