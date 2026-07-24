const smsCodes = new Map<string, { code: string; expiresAt: number }>();

export function setSmsCode(phone: string, code: string): void {
  smsCodes.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
}

export function getSmsCode(phone: string): string | null {
  const entry = smsCodes.get(phone);
  if (!entry || entry.expiresAt < Date.now()) {
    smsCodes.delete(phone);
    return null;
  }
  return entry.code;
}

export function deleteSmsCode(phone: string): void {
  smsCodes.delete(phone);
}
