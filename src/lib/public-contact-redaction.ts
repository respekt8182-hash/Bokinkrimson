export type RedactedPublicContactFields = {
  phoneMasked: string | null;
  phoneAvailable: boolean;
  emailAvailable: boolean;
  messengerAvailable: boolean;
};

export type DirectContactInput = {
  phone?: string | null;
  phone2?: string | null;
  phone3?: string | null;
  email?: string | null;
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
  vkUrl?: string | null;
  maxUrl?: string | null;
  okUrl?: string | null;
};

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasAnyPhone(input: DirectContactInput): boolean {
  return [input.phone, input.phone2, input.phone3].some(hasValue);
}

export function hasAnyMessenger(input: DirectContactInput): boolean {
  return [
    input.whatsappUrl,
    input.telegramUrl,
    input.vkUrl,
    input.maxUrl,
    input.okUrl,
  ].some(hasValue);
}

export function maskPublicPhone(phone: string | null | undefined): string | null {
  const value = phone?.trim() ?? "";
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "***";
  }

  if (value.startsWith("+")) {
    const countryLength =
      digits.startsWith("7") || digits.startsWith("1")
        ? 1
        : digits.length >= 11
          ? 3
          : Math.min(2, Math.max(1, digits.length - 7));
    return `+${digits.slice(0, countryLength)} *** ** **`;
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `${digits.startsWith("8") ? "8" : "+7"} *** ** **`;
  }

  return "*** ** **";
}

export function buildRedactedPublicContactFields(
  input: DirectContactInput,
): RedactedPublicContactFields {
  const firstPhone = [input.phone, input.phone2, input.phone3].find(hasValue) ?? null;

  return {
    phoneMasked: maskPublicPhone(firstPhone),
    phoneAvailable: hasAnyPhone(input),
    emailAvailable: hasValue(input.email),
    messengerAvailable: hasAnyMessenger(input),
  };
}

export function hasRevealableContact(input: RedactedPublicContactFields): boolean {
  return input.phoneAvailable || input.emailAvailable || input.messengerAvailable;
}
