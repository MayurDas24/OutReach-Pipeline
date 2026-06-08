export const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export const deduplicateEmails = (emails) => {
  return [...new Set(emails.filter(Boolean))];
};

export const deduplicateContacts = (contacts) => {
  const seen = new Set();
  return contacts.filter((c) => {
    const key = c.email || c.linkedin || c.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
