import {
  AdminMessageSourceType,
  ApplicationStatus,
  BathroomType,
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionPriceType,
  ExcursionScheduleMode,
  ExcursionSessionStatus,
  ExcursionStatus,
  OccupancyStatus,
} from "@prisma/client";
import { z } from "zod";
import { crimeaLocationIds, propertyAboutLimits, propertyTypeIds } from "@/lib/constants";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { defaultRoomPriceType, normalizeRoomPriceType, roomPriceTypeValues } from "@/lib/pricing";
import { isManagedPublicUrl } from "@/lib/storage";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { ITINERARY_ITEM_LABEL_VALUES } from "@/types/excursions";
import {
  additionalPlaceTypeOptions,
  bathroomLocationOptions,
  bathroomToiletOptions,
  bedTypeMaxCountById,
  bedTypeOptions,
  bedTypePlacesById,
  getAllowedBedTypeIdsForRoomType,
  getFixedMainPlacesForRoomType,
  roomTypeLabelById,
  roomTypeOptions,
  type BedTypeId,
  type RoomTypeId,
} from "@/lib/room-catalog";

// Phone validation helper shared by auth schemas.
const authPhoneSchema = z
  .string()
  .trim()
  .min(1, "Введите номер телефона")
  .refine((v) => /^\+?\d[\d\s()-]*$/.test(v), "Телефон содержит недопустимые символы")
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Введите корректный номер телефона");

// Zod contracts are reused by API handlers to keep validation centralized.
export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, "Имя должно содержать минимум 2 символа"),
    lastName: z.string().trim().min(2, "Фамилия должна содержать минимум 2 символа"),
    phone: authPhoneSchema,
    password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
    confirmPassword: z.string().min(8, "Подтвердите пароль"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  phone: authPhoneSchema,
  password: z.string().min(8, "Введите пароль"),
});

export const forgotPasswordSchema = z.object({
  phone: authPhoneSchema,
});

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(24, "Телефон слишком длинный")
  .optional()
  .or(z.literal(""))
  .refine(
    (value) => !value || /^[+0-9()\s-]+$/.test(value),
    "Телефон содержит недопустимые символы",
  )
  .refine((value) => !value || isLikelyPhoneNumber(value), "Введите корректный номер телефона");

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2, "Имя должно содержать минимум 2 символа").max(80),
  lastName: z.string().trim().min(2, "Фамилия должна содержать минимум 2 символа").max(80),
  phone: authPhoneSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "Введите текущий пароль"),
    newPassword: z.string().min(8, "Новый пароль должен содержать минимум 8 символов"),
    confirmPassword: z.string().min(8, "Подтвердите новый пароль"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Новые пароли не совпадают",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"],
  });

const propertyTypeIdSet = new Set(propertyTypeIds);
const locationIdSet = new Set(crimeaLocationIds);
const roomTypeIdSet = new Set<string>(roomTypeOptions.map((item) => item.id));
const bedTypeIdSet = new Set<string>(bedTypeOptions.map((item) => item.id));
const additionalPlaceTypeIdSet = new Set<string>(additionalPlaceTypeOptions.map((item) => item.id));
const bathroomLocationIdSet = new Set<string>(bathroomLocationOptions.map((item) => item.id));
const bathroomToiletIdSet = new Set<string>(bathroomToiletOptions.map((item) => item.id));
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const petsPolicySchema = z.enum(["FORBIDDEN", "ON_REQUEST", "ALLOWED"]);
const smokingPolicySchema = z.enum(["FORBIDDEN", "ON_REQUEST", "ALLOWED"]);

function isLikelyPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function optionalHttpUrlSchema(fieldLabel: string) {
  return z
    .string()
    .trim()
    .max(255, "Ссылка слишком длинная")
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      `${fieldLabel}: ссылка должна начинаться с http:// или https://`,
    );
}

function optionalTelegramUrlSchema(fieldLabel: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = normalizeTelegramProfileUrl(value);
    return normalized ?? "";
  }, optionalHttpUrlSchema(fieldLabel));
}

function optionalWhatsappUrlSchema(fieldLabel: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = normalizeWhatsappUrl(value);
    return normalized ?? value.trim();
  }, optionalHttpUrlSchema(fieldLabel));
}

function optionalNormalizedProfileUrlSchema(
  fieldLabel: string,
  normalizer: (value: string | null | undefined) => string | null,
  example: string,
) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = normalizer(value);
      return normalized ?? value.trim();
    },
    optionalHttpUrlSchema(fieldLabel).refine((value) => !value || Boolean(normalizer(value)), {
      message: `${fieldLabel}: укажите корректную ссылку вида ${example}`,
    }),
  );
}

const photoUrlSchema = z
  .string()
  .trim()
  .max(2048, "Ссылка на фото слишком длинная")
  .refine(
    (value) => /^https?:\/\/\S+$/i.test(value) || /^\/[^\s]+$/.test(value),
    "Ссылка на фото должна быть абсолютным URL (http/https) или относительным путем вида /uploads/...",
  )
  .refine(
    (value) => isManagedPublicUrl(value),
    "Ссылка на фото должна указывать на файл из хранилища проекта",
  );

const managedMediaUrlSchema = photoUrlSchema;

// Wizard step 1: property type + name.
export const propertyStep1Schema = z.object({
  type: z
    .string()
    .trim()
    .refine((value) => propertyTypeIdSet.has(value), "Выберите тип объекта из списка"),
  name: z.string().trim().min(2, "Название должно содержать минимум 2 символа").max(120),
});

// Wizard step 2: Crimea location only.
export const propertyStep2Schema = z.object({
  locationId: z
    .string()
    .trim()
    .refine((value) => locationIdSet.has(value), "Выберите локацию Крыма из списка"),
  locationName: z.string().trim().min(2, "Название локации слишком короткое").max(120),
});

// Wizard step 3: base card + map coordinates.
export const propertyStep3Schema = z.object({
  locationId: z.string().trim().min(1).nullable().optional(),
  locationName: z.string().trim().min(2, "Выберите или введите населенный пункт").max(120),
  address: z.string().trim().min(5, "Адрес должен содержать минимум 5 символов").max(240),
  seaDistance: z.string().trim().max(80, "Расстояние до моря слишком длинное").optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Wizard step 4: public contact/settings.
export const propertyStep4Schema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Введите корректный номер телефона")
    .max(24, "Телефон слишком длинный")
    .regex(/^[+0-9()\s-]+$/, "Телефон содержит недопустимые символы")
    .refine((value) => isLikelyPhoneNumber(value), "Введите корректный номер телефона"),
  phoneName: z.string().trim().max(80, "Имя слишком длинное").optional().or(z.literal("")),
  phone2: optionalPhoneSchema,
  phone2Name: z.string().trim().max(80, "Имя слишком длинное").optional().or(z.literal("")),
  phone3: optionalPhoneSchema,
  phone3Name: z.string().trim().max(80, "Имя слишком длинное").optional().or(z.literal("")),
  websiteUrl: optionalHttpUrlSchema("Сайт"),
  contactEmail: z
    .string()
    .trim()
    .max(254, "Email слишком длинный")
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Введите корректный email",
    ),
  contactPersonName: z
    .string()
    .trim()
    .max(120, "ФИО контактного лица слишком длинное")
    .optional()
    .or(z.literal("")),
  contactPersonRole: z
    .string()
    .trim()
    .max(120, "Должность слишком длинная")
    .optional()
    .or(z.literal("")),
  listingChannels: z
    .string()
    .trim()
    .max(500, "Поле о площадках размещения слишком длинное")
    .optional()
    .or(z.literal("")),
  whatsappUrl: optionalWhatsappUrlSchema("WhatsApp"),
  telegramUrl: optionalTelegramUrlSchema("Telegram"),
  vkUrl: optionalNormalizedProfileUrlSchema("VK", normalizeVkProfileUrl, "https://vk.com/username"),
  maxUrl: optionalNormalizedProfileUrlSchema(
    "Max",
    normalizeMaxProfileUrl,
    "https://max.ru/username",
  ),
  okUrl: optionalNormalizedProfileUrlSchema(
    "Одноклассники",
    normalizeOkProfileUrl,
    "https://ok.ru/profile/123456789",
  ),
  receiveRequests: z.boolean(),
});

// Wizard step 5: description; amenities are managed on room-category amenities screen.
export const propertyStep5Schema = z.object({
  description: z
    .string()
    .trim()
    .min(
      propertyAboutLimits.description.min,
      `Описание должно содержать минимум ${propertyAboutLimits.description.min} символов`,
    )
    .max(
      propertyAboutLimits.description.max,
      `Описание не должно превышать ${propertyAboutLimits.description.max} символов`,
    ),
  faqItems: z
    .array(
      z.object({
        q: z.string().trim().min(1).max(propertyAboutLimits.faq.questionMax),
        a: z.string().trim().min(1).max(propertyAboutLimits.faq.answerMax),
      }),
    )
    .max(propertyAboutLimits.faq.maxItems)
    .optional(),
  amenityIds: z.array(z.string().trim().min(1)).max(50),
  customAmenities: z
    .array(z.string().trim().min(2, "Своя услуга должна содержать минимум 2 символа").max(60))
    .max(30),
});

// Wizard step 6: living rules with cross-field constraints.
export const propertyStep6Schema = z
  .object({
    checkInFrom: z.string().trim().regex(timeRegex, "Время заезда должно быть в формате чч:мм"),
    checkOutUntil: z.string().trim().regex(timeRegex, "Время выезда должно быть в формате чч:мм"),
    childrenAllowed: z.boolean(),
    childrenMinAge: z.number().int().min(0).max(17).nullable(),
    petsPolicy: petsPolicySchema,
    smokingPolicy: smokingPolicySchema,
    quietHoursEnabled: z.boolean(),
    quietHoursFrom: z
      .string()
      .trim()
      .regex(timeRegex, "Тихие часы: время начала в формате чч:мм")
      .nullable(),
    quietHoursTo: z
      .string()
      .trim()
      .regex(timeRegex, "Тихие часы: время окончания в формате чч:мм")
      .nullable(),
    parkingInfo: z.string().trim().max(300).nullable().optional(),
    mealOptions: z.string().trim().max(300).nullable().optional(),
    prepaymentPolicy: z.string().trim().max(300).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.childrenAllowed && data.childrenMinAge !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Если дети не размещаются, возраст не указывается",
        path: ["childrenMinAge"],
      });
    }

    if (data.quietHoursEnabled && (!data.quietHoursFrom || !data.quietHoursTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Заполните интервал тихих часов",
        path: ["quietHoursFrom"],
      });
    }

    if (!data.quietHoursEnabled && (data.quietHoursFrom || data.quietHoursTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Если тихие часы выключены, интервал должен быть пустым",
        path: ["quietHoursFrom"],
      });
    }
  });

// Wizard step 7: KSR registry block (can be explicitly marked as not applicable).
export const propertyStep7Schema = z
  .object({
    classificationApplicable: z.boolean(),
    starRating: z.number().int().min(1).max(5).nullable(),
    registryNumber: z.string().trim().max(120).nullable(),
    registryDetails: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .transform((value) => value ?? null),
    selfAssessmentPassed: z.boolean().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.classificationApplicable) {
      return;
    }

    if (!data.registryNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите номер записи в реестре КСР",
        path: ["registryNumber"],
      });
    }

    if (data.registryNumber && data.registryNumber.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Номер записи в реестре слишком короткий",
        path: ["registryNumber"],
      });
    }
  });

// Discriminated union allows strict per-step payload handling in API.
export const updatePropertyStepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal(1), data: propertyStep1Schema }),
  z.object({ step: z.literal(2), data: propertyStep2Schema }),
  z.object({ step: z.literal(3), data: propertyStep3Schema }),
  z.object({ step: z.literal(4), data: propertyStep4Schema }),
  z.object({ step: z.literal(5), data: propertyStep5Schema }),
  z.object({ step: z.literal(6), data: propertyStep6Schema }),
  z.object({ step: z.literal(7), data: propertyStep7Schema }),
]);

const roomMetaSchema = z
  .object({
    roomType: z
      .string()
      .trim()
      .refine((value) => roomTypeIdSet.has(value), "Выберите корректный тип номера"),
    roomName: z
      .string()
      .trim()
      .min(2, "Название номера должно содержать минимум 2 символа")
      .max(120, "Название номера слишком длинное"),
    floor: z.number().int().min(1).max(99).nullable(),
    nameInExtranet: z.string().trim().max(120, "Название в экстранете слишком длинное").nullable(),
    bedConfiguration: z
      .array(
        z.object({
          type: z
            .string()
            .trim()
            .refine((value) => bedTypeIdSet.has(value), "Выберите корректный тип кровати"),
          count: z.number().int().min(1).max(20),
        }),
      )
      .max(10),
    bedSets: z
      .array(
        z
          .array(
            z.object({
              type: z
                .string()
                .trim()
                .refine((value) => bedTypeIdSet.has(value), "Выберите корректный тип кровати"),
              count: z.number().int().min(1).max(20),
            }),
          )
          .min(1)
          .max(10),
      )
      .max(10)
      .optional(),
    hasAdditionalPlaces: z.boolean(),
    additionalPlaceTypes: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => additionalPlaceTypeIdSet.has(value), "Некорректный тип доп. места"),
      )
      .max(5),
    hasPrivateBathroom: z.boolean(),
    privateBathroomLocations: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => bathroomLocationIdSet.has(value), "Некорректное расположение санузла"),
      )
      .max(7),
    privateToiletLocations: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => bathroomToiletIdSet.has(value), "Некорректное расположение туалета"),
      )
      .max(7),
    hasSharedBathroom: z.boolean(),
    sharedBathroomLocations: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => bathroomLocationIdSet.has(value), "Некорректное расположение санузла"),
      )
      .max(7),
    sharedToiletLocations: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => bathroomToiletIdSet.has(value), "Некорректное расположение туалета"),
      )
      .max(7),
    privateBathroomCount: z.number().int().min(1).max(10).nullable(),
  })
  .superRefine((data, ctx) => {
    const bedSets =
      data.bedSets && data.bedSets.length > 0 ? data.bedSets : [data.bedConfiguration];
    const usesExplicitBedSets = Boolean(data.bedSets && data.bedSets.length > 0);
    const roomType: RoomTypeId | null = roomTypeIdSet.has(data.roomType)
      ? (data.roomType as RoomTypeId)
      : null;
    const allowedBedTypeIds = roomType ? getAllowedBedTypeIdsForRoomType(roomType) : null;
    const allowedBedTypeIdSet = allowedBedTypeIds ? new Set(allowedBedTypeIds) : null;

    bedSets.forEach((set, setIndex) => {
      const bedUnitsCount = set.reduce((sum, item) => sum + item.count, 0);
      if (bedUnitsCount > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Суммарно можно добавить не более 20 кроватей",
          path: usesExplicitBedSets ? ["bedSets", setIndex] : ["bedConfiguration"],
        });
      }

      const groupedByType = new Map<string, number>();
      for (const item of set) {
        groupedByType.set(item.type, (groupedByType.get(item.type) ?? 0) + item.count);
      }

      for (const [type, count] of groupedByType) {
        const maxByType = bedTypeMaxCountById[type as keyof typeof bedTypeMaxCountById] ?? 20;
        if (count > maxByType) {
          const typeLabel = bedTypeOptions.find((item) => item.id === type)?.label ?? type;
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Для типа кровати «${typeLabel}» превышен максимум (${maxByType})`,
            path: usesExplicitBedSets ? ["bedSets", setIndex] : ["bedConfiguration"],
          });
        }
      }

      const hasNoBedType = set.some((item) => item.type === "no_bed");
      if (hasNoBedType && set.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "В наборе «Кровать не предусмотрена» нельзя комбинировать с другими типами кроватей",
          path: usesExplicitBedSets ? ["bedSets", setIndex] : ["bedConfiguration"],
        });
      }

      if (roomType && allowedBedTypeIdSet) {
        set.forEach((item, itemIndex) => {
          const bedType = item.type as BedTypeId;
          if (allowedBedTypeIdSet.has(bedType)) {
            return;
          }

          const bedTypeLabel =
            bedTypeOptions.find((option) => option.id === bedType)?.label ?? item.type;
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Для типа номера «${roomTypeLabelById[roomType]}» нельзя использовать «${bedTypeLabel}»`,
            path: usesExplicitBedSets
              ? ["bedSets", setIndex, itemIndex, "type"]
              : ["bedConfiguration", itemIndex, "type"],
          });
        });
      }
    });

    if (data.hasAdditionalPlaces === false && data.additionalPlaceTypes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Отключите доп. места или очистите их типы",
        path: ["additionalPlaceTypes"],
      });
    }

    if (!data.hasPrivateBathroom && !data.hasSharedBathroom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите хотя бы один вариант ванной комнаты",
        path: ["hasPrivateBathroom"],
      });
    }

    if (!data.hasPrivateBathroom) {
      if (
        data.privateBathroomLocations.length > 0 ||
        data.privateToiletLocations.length > 0 ||
        data.privateBathroomCount !== null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для отключенного собственного санузла данные должны быть пустыми",
          path: ["hasPrivateBathroom"],
        });
      }
    } else if (data.privateBathroomCount === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите количество ванных комнат в номере",
        path: ["privateBathroomCount"],
      });
    }

    if (!data.hasSharedBathroom) {
      if (data.sharedBathroomLocations.length > 0 || data.sharedToiletLocations.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для отключенного общего санузла данные должны быть пустыми",
          path: ["hasSharedBathroom"],
        });
      }
    }

    // Cross-check with top-level capacity is performed in roomBaseSchema superRefine.
  });

const roomBaseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Название номера должно содержать минимум 2 символа")
      .max(120, "Название номера слишком длинное"),
    beds: z.number().int().min(1, "Количество основных мест не может быть меньше 1").max(20),
    extraBeds: z.number().int().min(0).max(8),
    roomsCount: z
      .number()
      .int()
      .min(1, "Количество комнат не может быть меньше 1")
      .max(20, "Количество комнат не может превышать 20"),
    areaSqm: z
      .number()
      .min(5, "Площадь номера должна быть не меньше 5 м²")
      .max(5000, "Площадь номера не должна превышать 5000 м²")
      .nullable(),
    bathroomType: z.nativeEnum(BathroomType),
    featureIds: z.array(z.string().trim().min(1)).max(80),
    customFeatures: z
      .array(z.string().trim().min(2, "Свое оснащение должно содержать минимум 2 символа").max(80))
      .max(30),
    meta: roomMetaSchema,
  })
  .superRefine((data, ctx) => {
    const roomType: RoomTypeId | null = roomTypeIdSet.has(data.meta.roomType)
      ? (data.meta.roomType as RoomTypeId)
      : null;

    if (data.beds + data.extraBeds > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Суммарная вместимость номера не может превышать 20 гостей",
        path: ["extraBeds"],
      });
    }

    if (!data.meta.hasAdditionalPlaces && data.extraBeds > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Если доп. места отключены, количество доп. мест должно быть 0",
        path: ["extraBeds"],
      });
    }

    if (
      data.meta.hasAdditionalPlaces &&
      data.extraBeds > 0 &&
      data.meta.additionalPlaceTypes.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для доп. мест выберите хотя бы один тип",
        path: ["meta", "additionalPlaceTypes"],
      });
    }

    if (roomType) {
      const fixedMainPlaces = getFixedMainPlacesForRoomType(roomType);
      if (fixedMainPlaces !== null && data.beds !== fixedMainPlaces) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Для типа номера «${roomTypeLabelById[roomType]}» количество основных мест фиксировано: ${fixedMainPlaces}`,
          path: ["beds"],
        });
      }
    }

    const bedSets =
      data.meta.bedSets && data.meta.bedSets.length > 0
        ? data.meta.bedSets
        : [data.meta.bedConfiguration];
    const hasMismatch = bedSets.some((set) => {
      const bedCapacity = set.reduce((sum, item) => {
        const places = bedTypePlacesById[item.type as keyof typeof bedTypePlacesById] ?? 0;
        return sum + item.count * places;
      }, 0);
      return data.beds > bedCapacity;
    });
    const hasOverDeclaredCapacity = bedSets.some((set) => {
      const bedCapacity = set.reduce((sum, item) => {
        const places = bedTypePlacesById[item.type as keyof typeof bedTypePlacesById] ?? 0;
        return sum + item.count * places;
      }, 0);
      return bedCapacity > data.beds;
    });

    if (hasMismatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Указанная вместимость не соответствует количеству спальных мест. Уменьшите основные места или добавьте больше кроватей",
        path: ["beds"],
      });
    }

    if (hasOverDeclaredCapacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Количество мест по кроватям не должно быть больше значения «Основные места». Уменьшите количество кроватей или увеличьте основные места",
        path: ["beds"],
      });
    }
  });

export const createRoomSchema = roomBaseSchema;
export const updateRoomSchema = roomBaseSchema;

const roomPriceTypeSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return defaultRoomPriceType;
  }
  return normalizeRoomPriceType(value);
}, z.enum(roomPriceTypeValues));

const roomPriceBaseSchema = z
  .object({
    dateFrom: z.string().trim().regex(isoDateRegex, "Дата начала должна быть в формате YYYY-MM-DD"),
    dateTo: z
      .string()
      .trim()
      .regex(isoDateRegex, "Дата окончания должна быть в формате YYYY-MM-DD"),
    price: z.number().positive("Цена должна быть больше 0").max(1_000_000, "Цена слишком большая"),
    priceType: roomPriceTypeSchema.default(defaultRoomPriceType),
    minGuests: z
      .number()
      .int()
      .min(1, "Минимум гостей должен быть не меньше 1")
      .max(40)
      .nullable()
      .optional(),
    minNights: z
      .number()
      .int()
      .min(1, "Минимум ночей должен быть не меньше 1")
      .max(60, "Минимум ночей не может быть больше 60")
      .nullable()
      .optional(),
    extraBedPrice: z
      .number()
      .positive("Цена доп. места должна быть больше 0")
      .max(1_000_000, "Цена доп. места слишком большая")
      .nullable()
      .optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3, "Код валюты должен состоять из 3 символов")
      .default("RUB")
      .refine((value) => value === "RUB", "На MVP поддерживается только валюта RUB"),
  })
  .superRefine((data, ctx) => {
    if (data.dateTo < data.dateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Дата окончания не может быть раньше даты начала",
        path: ["dateTo"],
      });
    }
  });

export const createRoomPriceSchema = roomPriceBaseSchema;
export const updateRoomPriceSchema = roomPriceBaseSchema;

const roomOccupancyBaseSchema = z
  .object({
    dateFrom: z.string().trim().regex(isoDateRegex, "Дата начала должна быть в формате YYYY-MM-DD"),
    dateTo: z
      .string()
      .trim()
      .regex(isoDateRegex, "Дата окончания должна быть в формате YYYY-MM-DD"),
    timeFrom: z
      .string()
      .trim()
      .regex(timeRegex, "Время начала должно быть в формате чч:мм")
      .nullable()
      .optional(),
    timeTo: z
      .string()
      .trim()
      .regex(timeRegex, "Время окончания должно быть в формате чч:мм")
      .nullable()
      .optional(),
    status: z.nativeEnum(OccupancyStatus).optional(),
    tag: z.string().trim().max(20, "Метка не должна превышать 20 символов").nullable().optional(),
    source: z.string().trim().max(80, "Источник слишком длинный").nullable().optional(),
    color: z.string().trim().max(16, "Цвет слишком длинный").nullable().optional(),
    adultsCount: z
      .number()
      .int()
      .min(1, "Взрослых должно быть не меньше 1")
      .max(20)
      .nullable()
      .optional(),
    childrenCount: z
      .number()
      .int()
      .min(0, "Детей не может быть меньше 0")
      .max(20)
      .nullable()
      .optional(),
    guestName: z.string().trim().max(120, "ФИО слишком длинное").nullable().optional(),
    guestPhone: z.string().trim().max(24, "Телефон слишком длинный").nullable().optional(),
    guestContacts: z.string().trim().max(255, "Контакты слишком длинные").nullable().optional(),
    description: z
      .string()
      .trim()
      .max(250, "Описание не должно превышать 250 символов")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateTo < data.dateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Дата окончания не может быть раньше даты начала",
        path: ["dateTo"],
      });
    }
  });

export const createRoomOccupancySchema = roomOccupancyBaseSchema;
export const updateRoomOccupancySchema = roomOccupancyBaseSchema;

export const createApplicationSchema = z
  .object({
    roomId: z.string().trim().min(1).nullable().optional(),
    dateFrom: z.string().trim().regex(isoDateRegex, "Дата заезда должна быть в формате YYYY-MM-DD"),
    dateTo: z.string().trim().regex(isoDateRegex, "Дата выезда должна быть в формате YYYY-MM-DD"),
    guestsCount: z.number().int().min(1, "Количество гостей не может быть меньше 1").max(20),
    message: z.string().trim().max(2000).nullable().optional(),
    contactName: z
      .string()
      .trim()
      .min(2, "Имя контакта должно содержать минимум 2 символа")
      .max(120),
    contactPhone: z
      .string()
      .trim()
      .min(7, "Телефон должен содержать минимум 7 символов")
      .max(24, "Телефон слишком длинный")
      .regex(/^[+0-9()\s-]+$/, "Телефон содержит недопустимые символы"),
    contactEmail: z.string().trim().email("Введите корректный email"),
  })
  .superRefine((data, ctx) => {
    if (data.dateTo < data.dateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Дата выезда не может быть раньше даты заезда",
        path: ["dateTo"],
      });
    }
  });

export const updateApplicationStatusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
});

const optionalReviewDateSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => {
    if (!value) {
      return true;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return parsed.getTime() <= today.getTime();
  }, "Дата отзыва не может быть в будущем");

export const createReviewSchema = z.object({
  rating: z
    .number()
    .min(0.5, "Оценка должна быть от 0.5 до 5")
    .max(5, "Оценка должна быть от 0.5 до 5")
    .refine((value) => Math.abs(value * 2 - Math.round(value * 2)) < Number.EPSILON, {
      message: "Оценка задается шагом 0.5",
    }),
  text: z
    .string()
    .trim()
    .min(10, "Текст отзыва должен содержать минимум 10 символов")
    .max(2000, "Текст отзыва слишком длинный"),
  guestCity: z.string().trim().max(80, "Город слишком длинный").optional().or(z.literal("")),
  reviewedAt: optionalReviewDateSchema,
  reviewCategory: z.string().trim().max(40).optional().or(z.literal("")),
  reviewHighlight: z.string().trim().max(160).optional().or(z.literal("")),
});

export const manualExternalReviewSchema = createReviewSchema
  .extend({
    authorName: z
      .string()
      .trim()
      .min(2, "Укажите имя автора отзыва")
      .max(80, "Имя автора слишком длинное"),
    sourceUrl: z
      .string()
      .trim()
      .max(500, "Ссылка слишком длинная")
      .refine((value) => {
        if (!value) {
          return true;
        }

        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, "Ссылка должна начинаться с http:// или https://")
      .optional()
      .or(z.literal("")),
    sourceName: z
      .string()
      .trim()
      .max(80, "Название сайта слишком длинное")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (!data.sourceUrl && !data.sourceName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите название сайта или ссылку на источник",
        path: ["sourceName"],
      });
    }
  });

export const createAdminMessageSchema = z
  .object({
    sourceType: z.nativeEnum(AdminMessageSourceType),
    propertyId: z.string().trim().min(1).nullable().optional(),
    excursionId: z.string().trim().min(1).nullable().optional(),
    message: z
      .string()
      .trim()
      .min(10, "Сообщение должно содержать минимум 10 символов")
      .max(2000, "Сообщение не должно превышать 2000 символов"),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === AdminMessageSourceType.OBJECT && !data.propertyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для сообщения по объекту нужен идентификатор объекта",
        path: ["propertyId"],
      });
    }

    if (data.sourceType === AdminMessageSourceType.EXCURSION && !data.excursionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для сообщения по экскурсии нужен идентификатор экскурсии",
        path: ["excursionId"],
      });
    }
  });

const moderateEntitySchema = z
  .object({
    action: z.enum(["approve", "needs_fix", "reject"]),
    comment: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const requiresComment = data.action === "needs_fix" || data.action === "reject";
    const comment = data.comment?.trim() ?? "";

    if (requiresComment && comment.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для этого действия нужен комментарий минимум 5 символов",
        path: ["comment"],
      });
    }
  });

export const moderatePropertySchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    comment: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const comment = data.comment?.trim() ?? "";

    if (data.action === "reject" && comment.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для отклонения нужен комментарий минимум 5 символов",
        path: ["comment"],
      });
    }
  });

export const moderateExcursionSchema = moderateEntitySchema;

const excursionLocationIdSchema = z.string().trim().min(1).max(120);
const excursionDistrictIdSchema = z.string().trim().min(1).max(120);
const excursionCategoryIdSchema = z.string().trim().min(1).max(120);
const excursionTagSchema = z.string().trim().min(2).max(60);
const excursionLanguageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(8)
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/, "Код языка должен быть в формате ru/en/ru-RU");

const excursionRouteLocationSchema = z.object({
  locationId: excursionLocationIdSchema,
  sortOrder: z.number().int().min(0).max(999),
});

const excursionHighlightSchema = z.string().trim().min(2).max(120);
const excursionSectionPhotoGroupsSchema = z
  .object({
    dates: z.array(managedMediaUrlSchema).max(8).optional(),
    program: z.array(managedMediaUrlSchema).max(8).optional(),
    logistics: z.array(managedMediaUrlSchema).max(8).optional(),
    accommodation: z.array(managedMediaUrlSchema).max(8).optional(),
    included: z.array(managedMediaUrlSchema).max(8).optional(),
    requirements: z.array(managedMediaUrlSchema).max(8).optional(),
  })
  .partial();
const itineraryDaySchema = z.object({
  day: z.number().int().min(1).max(100),
  itemLabel: z.enum(ITINERARY_ITEM_LABEL_VALUES).optional(),
  title: z.string().trim().min(2).max(120),
  teaser: z.string().trim().max(240).optional(),
  description: z.string().trim().min(10).max(4000),
  locations: z.array(z.string().trim().min(1).max(120)).max(20),
  startTime: z.string().trim().max(10).optional(),
  endTime: z.string().trim().max(10).optional(),
  included: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  meals: z.string().trim().max(120).optional(),
  accommodation: z.string().trim().max(160).optional(),
  activities: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  // V2 extensions
  mealsIncluded: z.array(z.string().trim().min(1).max(60)).max(5).optional(),
  transportModes: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
  overnightLocation: z.string().trim().max(160).optional(),
  accommodationName: z.string().trim().max(160).optional(),
  optionalExtras: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  notes: z.string().trim().max(1000).optional(),
  photoUrls: z.array(managedMediaUrlSchema).max(4).optional(),
});
const excursionExtraOptionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
  included: z.boolean(),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
});

export const updateExcursionSchema = z
  .object({
    offerType: z.nativeEnum(ExcursionOfferType).optional(),
    subtypeLabel: z.string().trim().min(2).max(120).nullable().optional(),
    title: z.string().trim().min(2).max(140).nullable().optional(),
    locationId: excursionLocationIdSchema.optional(),
    locationName: z.string().trim().min(2).max(120).optional(),
    mainLocationId: excursionLocationIdSchema.nullable().optional(),
    anchorLocationId: excursionLocationIdSchema.nullable().optional(),
    districtId: excursionDistrictIdSchema.nullable().optional(),
    categoryId: excursionCategoryIdSchema.nullable().optional(),
    tags: z.array(excursionTagSchema).max(30).optional(),
    address: z.string().trim().min(2).max(240).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    startPoint: z.string().trim().min(2).max(240).nullable().optional(),
    meetingPointText: z.string().trim().min(2).max(240).nullable().optional(),
    meetingLocationId: excursionLocationIdSchema.nullable().optional(),
    pickupAvailable: z.boolean().optional(),
    pickupLocationIds: z.array(excursionLocationIdSchema).max(50).optional(),
    routeLocations: z.array(excursionRouteLocationSchema).max(80).optional(),
    description: z.string().trim().min(20).max(5000).nullable().optional(),
    shortDescription: z.string().trim().min(10).max(1000).nullable().optional(),
    fullDescription: z.string().trim().min(20).max(5000).nullable().optional(),
    routeDescription: z.string().trim().min(10).max(5000).nullable().optional(),
    highlights: z.array(excursionHighlightSchema).max(6).optional(),
    durationMinutes: z.number().int().min(15).max(10080).nullable().optional(),
    durationDays: z.number().int().min(1).max(365).nullable().optional(),
    durationNights: z.number().int().min(0).max(364).nullable().optional(),
    itineraryDays: z.array(itineraryDaySchema).max(60).optional(),
    finishPoint: z.string().trim().min(2).max(240).nullable().optional(),
    scheduleText: z.string().trim().min(2).max(2000).nullable().optional(),
    scheduleMode: z.nativeEnum(ExcursionScheduleMode).optional(),
    availabilityMode: z.nativeEnum(ExcursionAvailabilityMode).optional(),
    availabilityNote: z.string().trim().min(2).max(1000).nullable().optional(),
    format: z.nativeEnum(ExcursionFormat).nullable().optional(),
    groupSizeMin: z.number().int().min(1).max(1000).nullable().optional(),
    groupSizeMax: z.number().int().min(1).max(1000).nullable().optional(),
    languageCodes: z.array(excursionLanguageCodeSchema).max(12).optional(),
    ageLimit: z.number().int().min(0).max(120).nullable().optional(),
    isKidFriendly: z.boolean().nullable().optional(),
    difficulty: z.nativeEnum(ExcursionDifficulty).nullable().optional(),
    priceType: z.nativeEnum(ExcursionPriceType).optional(),
    priceFrom: z.number().positive().max(1_000_000).nullable().optional(),
    priceTo: z.number().positive().max(1_000_000).nullable().optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .refine((value) => value === "RUB", "На MVP поддерживается только валюта RUB")
      .optional(),
    includedText: z.string().trim().min(2).max(4000).nullable().optional(),
    notIncludedText: z.string().trim().min(2).max(4000).nullable().optional(),
    includedItems: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    excludedItems: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    cancellationPolicy: z.string().trim().min(2).max(2000).nullable().optional(),
    cancellationPolicyType: z
      .enum(["FLEXIBLE", "MODERATE", "STRICT", "CUSTOM"])
      .nullable()
      .optional(),
    transferDetails: z.string().trim().max(300).nullable().optional(),
    timeline: z
      .array(
        z.object({
          step: z.number().int().min(1),
          time: z.string().trim().max(10),
          duration: z.string().trim().max(20),
          title: z.string().trim().min(1).max(80),
          description: z.string().trim().max(300).optional(),
          location: z.string().trim().max(100).optional(),
          icon: z.string().trim().max(40).optional(),
          photoUrls: z.array(managedMediaUrlSchema).max(4).optional(),
        }),
      )
      .max(20)
      .optional(),
    extraOptions: z.array(excursionExtraOptionSchema).max(30).optional(),
    pricingTiers: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(60),
          price: z.number().int().min(0).max(1_000_000),
          code: z.string().trim().max(30).optional(),
          currency: z.string().trim().max(3).optional(),
          ageFrom: z.number().int().min(0).max(120).nullable().optional(),
          ageTo: z.number().int().min(0).max(120).nullable().optional(),
          minPeople: z.number().int().min(1).max(1000).nullable().optional(),
          maxPeople: z.number().int().min(1).max(1000).nullable().optional(),
          isDefault: z.boolean().optional(),
          comment: z.string().trim().max(200).optional(),
        }),
      )
      .max(10)
      .optional(),
    faqItems: z
      .array(
        z.object({
          q: z.string().trim().min(1).max(200),
          a: z.string().trim().min(1).max(1000),
        }),
      )
      .max(20)
      .optional(),
    physicalRequirements: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    whatToBring: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    meetingPointLat: z.number().min(-90).max(90).nullable().optional(),
    meetingPointLng: z.number().min(-180).max(180).nullable().optional(),
    minBookingNoticeHours: z.number().int().min(0).max(720).nullable().optional(),
    priceUnitLabel: z.string().trim().min(2).max(80).nullable().optional(),
    // ── Tour logistics ──
    tourKind: z
      .enum([
        "ONE_DAY",
        "WEEKEND",
        "MULTI_DAY",
        "JEEP",
        "BOAT",
        "HIKING",
        "BUS",
        "COMBINED",
        "EXPEDITION",
        "CRUISE",
        "OTHER",
      ])
      .nullable()
      .optional(),
    transportModes: z
      .array(
        z.enum([
          "WALKING",
          "BUS",
          "MINIVAN",
          "CAR",
          "JEEP",
          "ATV",
          "BOAT",
          "TRAIN",
          "FLIGHT",
          "MIXED",
        ]),
      )
      .max(5)
      .optional(),
    departureMode: z
      .enum(["FIXED_DATES", "ON_REQUEST", "DAILY", "SEASONAL", "PRIVATE_ONLY"])
      .nullable()
      .optional(),
    arrivalInfo: z.string().trim().min(2).max(500).nullable().optional(),
    departureInfo: z.string().trim().min(2).max(500).nullable().optional(),
    // ── Accommodation ──
    accommodationProvided: z.boolean().nullable().optional(),
    accommodationType: z.string().trim().min(2).max(120).nullable().optional(),
    accommodationNights: z.number().int().min(0).max(364).nullable().optional(),
    accommodationFormat: z.string().trim().min(2).max(120).nullable().optional(),
    accommodationStars: z.string().trim().max(20).nullable().optional(),
    roomTypes: z
      .array(z.enum(["SINGLE", "DOUBLE", "TWIN", "TRIPLE", "SHARED", "CAMPING"]))
      .max(6)
      .optional(),
    singleSupplementAvailable: z.boolean().nullable().optional(),
    singleSupplementPrice: z.number().min(0).max(1_000_000).nullable().optional(),
    accommodationComment: z.string().trim().min(2).max(1000).nullable().optional(),
    // ── Meals ──
    mealPlan: z.string().trim().min(2).max(120).nullable().optional(),
    mealDetails: z.string().trim().min(2).max(1000).nullable().optional(),
    // ── Safety & documents ──
    documentsRequired: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
    insuranceIncluded: z.boolean().nullable().optional(),
    insuranceComment: z.string().trim().min(2).max(500).nullable().optional(),
    equipmentProvided: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    safetyInfo: z.string().trim().min(2).max(2000).nullable().optional(),
    routeConditions: z.string().trim().min(2).max(2000).nullable().optional(),
    hasGuideLicense: z.boolean().optional(),
    instantConfirmation: z.boolean().optional(),
    contactFirstName: z.string().trim().min(2).max(80).nullable().optional(),
    contactLastName: z.string().trim().min(2).max(80).nullable().optional(),
    contactPhone: z
      .string()
      .trim()
      .min(10, "Введите корректный номер телефона")
      .max(24, "Телефон слишком длинный")
      .regex(/^[+0-9()\s-]+$/, "Телефон содержит недопустимые символы")
      .refine((value) => isLikelyPhoneNumber(value), "Введите корректный номер телефона")
      .nullable()
      .optional(),
    contactPhoneName: z.string().trim().max(80, "Имя слишком длинное").nullable().optional(),
    contactPhone2: z
      .string()
      .trim()
      .min(10, "Введите корректный номер телефона")
      .max(24, "Телефон слишком длинный")
      .regex(/^[+0-9()\s-]+$/, "Телефон содержит недопустимые символы")
      .refine((value) => isLikelyPhoneNumber(value), "Введите корректный номер телефона")
      .nullable()
      .optional(),
    contactPhone2Name: z.string().trim().max(80, "Имя слишком длинное").nullable().optional(),
    contactPhone3: z
      .string()
      .trim()
      .min(10, "Введите корректный номер телефона")
      .max(24, "Телефон слишком длинный")
      .regex(/^[+0-9()\s-]+$/, "Телефон содержит недопустимые символы")
      .refine((value) => isLikelyPhoneNumber(value), "Введите корректный номер телефона")
      .nullable()
      .optional(),
    contactPhone3Name: z.string().trim().max(80, "Имя слишком длинное").nullable().optional(),
    contactEmail: z
      .string()
      .trim()
      .email("Введите корректный email")
      .max(254, "Email слишком длинный")
      .nullable()
      .optional(),
    websiteUrl: optionalHttpUrlSchema("Сайт").nullable().optional(),
    whatsappUrl: optionalWhatsappUrlSchema("WhatsApp").nullable().optional(),
    telegramUrl: optionalTelegramUrlSchema("Telegram").nullable().optional(),
    vkUrl: optionalNormalizedProfileUrlSchema(
      "VK",
      normalizeVkProfileUrl,
      "https://vk.com/username",
    )
      .nullable()
      .optional(),
    maxUrl: optionalNormalizedProfileUrlSchema(
      "Max",
      normalizeMaxProfileUrl,
      "https://max.ru/username",
    )
      .nullable()
      .optional(),
    okUrl: optionalNormalizedProfileUrlSchema(
      "Одноклассники",
      normalizeOkProfileUrl,
      "https://ok.ru/profile/123456789",
    )
      .nullable()
      .optional(),
    photoUrls: z.array(managedMediaUrlSchema).max(12).optional(),
    sectionPhotoGroups: excursionSectionPhotoGroupsSchema.optional(),
    videoUrls: z.array(managedMediaUrlSchema).max(2).optional(),
    status: z.nativeEnum(ExcursionStatus).optional(),
  })
  .superRefine((data, ctx) => {
    const hasLatitude = data.latitude !== undefined && data.latitude !== null;
    const hasLongitude = data.longitude !== undefined && data.longitude !== null;

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для карты укажите и широту, и долготу",
        path: hasLatitude ? ["longitude"] : ["latitude"],
      });
    }

    if (
      data.groupSizeMin !== undefined &&
      data.groupSizeMax !== undefined &&
      data.groupSizeMin !== null &&
      data.groupSizeMax !== null &&
      data.groupSizeMax < data.groupSizeMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Максимальный размер группы не может быть меньше минимального",
        path: ["groupSizeMax"],
      });
    }

    if (
      data.priceFrom !== undefined &&
      data.priceTo !== undefined &&
      data.priceFrom !== null &&
      data.priceTo !== null &&
      data.priceTo < data.priceFrom
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Цена "до" не может быть меньше цены "от"',
        path: ["priceTo"],
      });
    }

    if (data.offerType === ExcursionOfferType.TOUR) {
      if (
        data.durationDays !== undefined &&
        data.durationNights !== undefined &&
        data.durationDays !== null &&
        data.durationNights !== null &&
        data.durationNights > data.durationDays
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ночей не может быть больше, чем дней",
          path: ["durationNights"],
        });
      }
    }

    if (data.routeLocations && data.routeLocations.length > 0) {
      const seenSortOrders = new Set<number>();
      for (const routeLocation of data.routeLocations) {
        if (seenSortOrders.has(routeLocation.sortOrder)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Порядок точек маршрута должен быть уникальным",
            path: ["routeLocations"],
          });
          break;
        }
        seenSortOrders.add(routeLocation.sortOrder);
      }
    }

    if (data.itineraryDays) {
      const seenDayNumbers = new Set<number>();
      for (const day of data.itineraryDays) {
        if (seenDayNumbers.has(day.day)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Номера дней программы должны быть уникальными",
            path: ["itineraryDays"],
          });
          break;
        }
        seenDayNumbers.add(day.day);
      }
    }
  });

const excursionSessionInputSchema = z
  .object({
    startAt: z.string().trim().min(16).max(40),
    endAt: z.string().trim().min(16).max(40).nullable().optional(),
    capacity: z.number().int().min(1).max(10000).nullable().optional(),
    priceOverride: z.number().positive().max(1_000_000).nullable().optional(),
    status: z.nativeEnum(ExcursionSessionStatus).optional(),
    bookingDeadlineMinutes: z
      .number()
      .int()
      .min(0)
      .max(30 * 24 * 60)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startAt);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startAt должен быть корректной датой/временем",
        path: ["startAt"],
      });
      return;
    }

    if (data.endAt) {
      const end = new Date(data.endAt);
      if (Number.isNaN(end.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endAt должен быть корректной датой/временем",
          path: ["endAt"],
        });
        return;
      }

      if (end.getTime() <= start.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Время окончания должно быть позже начала",
          path: ["endAt"],
        });
      }
    }
  });

export const upsertExcursionSessionsSchema = z.object({
  sessions: z.array(excursionSessionInputSchema).max(1000),
});

const excursionScheduleRuleInputSchema = z
  .object({
    dateFrom: z
      .string()
      .trim()
      .regex(isoDateRegex, "dateFrom должен быть YYYY-MM-DD")
      .nullable()
      .optional(),
    dateTo: z
      .string()
      .trim()
      .regex(isoDateRegex, "dateTo должен быть YYYY-MM-DD")
      .nullable()
      .optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    timeStarts: z
      .array(z.string().trim().regex(timeRegex, "Время должно быть в формате чч:мм"))
      .min(1)
      .max(16),
    durationMinutes: z.number().int().min(15).max(10080).nullable().optional(),
    capacityDefault: z.number().int().min(1).max(10000).nullable().optional(),
    priceOverride: z.number().positive().max(1_000_000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateFrom && data.dateTo && data.dateTo < data.dateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dateTo не может быть раньше dateFrom",
        path: ["dateTo"],
      });
    }
  });

const excursionScheduleExceptionInputSchema = z.object({
  date: z.string().trim().regex(isoDateRegex, "date должен быть YYYY-MM-DD"),
  isClosed: z.boolean().optional(),
  overrideTimeStarts: z
    .array(z.string().trim().regex(timeRegex, "Время должно быть в формате чч:мм"))
    .max(16)
    .optional(),
  overrideCapacity: z.number().int().min(1).max(10000).nullable().optional(),
  overridePrice: z.number().positive().max(1_000_000).nullable().optional(),
  notes: z.string().trim().max(400).nullable().optional(),
});

export const upsertExcursionScheduleRulesSchema = z.object({
  scheduleMode: z.nativeEnum(ExcursionScheduleMode).optional(),
  rules: z.array(excursionScheduleRuleInputSchema).max(120),
  exceptions: z.array(excursionScheduleExceptionInputSchema).max(365).optional(),
});

export const createReviewReportSchema = z.object({
  reason: z.enum(["spam", "abuse", "misleading", "other"], {
    message: "Выберите причину жалобы",
  }),
  comment: z
    .string()
    .trim()
    .max(500, "Комментарий не должен превышать 500 символов")
    .optional()
    .or(z.literal("")),
});
