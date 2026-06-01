export function validatePassword(password: string): string | null {
  if (password.length < 8) return "At least 8 characters";
  if (!/[a-zA-Z]/.test(password)) return "Must contain at least one letter";
  if (!/\d/.test(password)) return "Must contain at least one number";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return "Must contain at least one special character";
  return null;
}
