"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_LEAD_MESSAGE_AUTHOR_GENDER,
  readLeadMessageAuthorGender,
  type LeadMessageAuthorGender,
  writeLeadMessageAuthorGender,
} from "@/lib/lead-message-author";

export function useLeadMessageAuthorGender() {
  const [authorGender, setAuthorGenderState] = useState<LeadMessageAuthorGender>(
    () => readLeadMessageAuthorGender() ?? DEFAULT_LEAD_MESSAGE_AUTHOR_GENDER,
  );

  const setAuthorGender = useCallback((value: LeadMessageAuthorGender) => {
    setAuthorGenderState(value);
    writeLeadMessageAuthorGender(value);
  }, []);

  return {
    authorGender,
    setAuthorGender,
  };
}
