/**
 * Syntax validation service conforming to RFC 5322 / RFC 5321 specifications.
 */

// RFC 5322 simplified standard regex for email validation
const RFC_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// TLD must be at least 2 alpha characters
const TLD_REGEX = /\.[a-zA-Z]{2,}$/;

/**
 * Validates the email syntax.
 * @param {string} email
 * @returns {{
 *   valid: boolean,
 *   rfc_compliant: boolean,
 *   user: string,
 *   domain: string
 * }}
 */
export function validateSyntax(email) {
  if (typeof email !== 'string') {
    return {
      valid: false,
      rfc_compliant: false,
      user: '',
      domain: '',
    };
  }

  const trimmed = email.trim();

  // Length constraints per RFC 5321
  if (trimmed.length === 0 || trimmed.length > 254) {
    return {
      valid: false,
      rfc_compliant: false,
      user: '',
      domain: '',
    };
  }

  // Exactly one '@' separator
  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) {
    const parts = trimmed.split('@');
    return {
      valid: false,
      rfc_compliant: false,
      user: parts[0] || '',
      domain: parts.slice(1).join('@') || '',
    };
  }

  const [user, domain] = trimmed.split('@');

  // Check local part (user)
  // Max 64 chars per RFC 5321
  if (!user || user.length > 64) {
    return {
      valid: false,
      rfc_compliant: false,
      user: user || '',
      domain: domain || '',
    };
  }

  // User cannot start or end with a dot, or have consecutive dots
  if (user.startsWith('.') || user.endsWith('.') || user.includes('..')) {
    return {
      valid: false,
      rfc_compliant: false,
      user,
      domain: domain || '',
    };
  }

  // Domain constraints
  // Max 255 chars
  if (!domain || domain.length > 255) {
    return {
      valid: false,
      rfc_compliant: false,
      user,
      domain: domain || '',
    };
  }

  // Domain cannot start or end with dot or hyphen, or have consecutive dots
  if (
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.startsWith('-') ||
    domain.endsWith('-') ||
    domain.includes('..')
  ) {
    return {
      valid: false,
      rfc_compliant: false,
      user,
      domain,
    };
  }

  // Must have at least one dot in domain and a valid TLD
  if (!domain.includes('.') || !TLD_REGEX.test(domain)) {
    return {
      valid: false,
      rfc_compliant: false,
      user,
      domain,
    };
  }

  // Check individual domain labels (max 63 chars each)
  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return {
        valid: false,
        rfc_compliant: false,
        user,
        domain,
      };
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return {
        valid: false,
        rfc_compliant: false,
        user,
        domain,
      };
    }
  }

  const matchesRegex = RFC_EMAIL_REGEX.test(trimmed);

  return {
    valid: matchesRegex,
    rfc_compliant: matchesRegex,
    user: user.toLowerCase(),
    domain: domain.toLowerCase(),
  };
}
