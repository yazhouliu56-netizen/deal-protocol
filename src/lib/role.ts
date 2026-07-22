export function getRoles(user: { role?: string; roles?: string | null }): string[] {
  if (user.roles) {
    try {
      return JSON.parse(user.roles) as string[]
    } catch {
      // fallback
    }
  }
  return user.role ? [user.role] : ["CUSTOMER"]
}

export function hasRole(user: { role?: string; roles?: string | null }, role: string): boolean {
  return getRoles(user).includes(role)
}

export function hasAnyRole(user: { role?: string; roles?: string | null }, ...roles: string[]): boolean {
  const userRoles = getRoles(user)
  return roles.some((r) => userRoles.includes(r))
}
