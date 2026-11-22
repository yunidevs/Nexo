import { z } from "zod";

const defaultValues = {
    DATABASE_URL: "postgresql://nexo_dev:nexo_dev@127.0.0.1:6432/nexo_erp?schema=public",
    JWT_ACCESS_SECRET: "desarrollo-secreto-local-de-32-caracteres",
} as const;

// PayPal no admite UYU. El marketplace mantiene sus importes en UYU y cobra
// en una de estas monedas usando PAYPAL_EXCHANGE_RATE.
export const paypalCurrencies = [
    "AUD",
    "BRL",
    "CAD",
    "CNY",
    "CZK",
    "DKK",
    "EUR",
    "HKD",
    "HUF",
    "ILS",
    "JPY",
    "MYR",
    "MXN",
    "TWD",
    "NZD",
    "NOK",
    "PHP",
    "PLN",
    "GBP",
    "SGD",
    "SEK",
    "CHF",
    "THB",
    "USD",
] as const;

export type PayPalCurrency = (typeof paypalCurrencies)[number];

const configSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().url().default(defaultValues.DATABASE_URL),
    JWT_ACCESS_SECRET: z.string().min(32, "Debe tener al menos 32 caracteres."),
    MAILTRAP_SMTP_HOST: z.string().default("sandbox.smtp.mailtrap.io"),
    MAILTRAP_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(2525),
    MAILTRAP_SMTP_USER: z.string().default(""),
    MAILTRAP_SMTP_PASS: z.string().default(""),
    MAILTRAP_FROM_EMAIL: z.string().email().or(z.literal("")).default(""),
    MAILTRAP_FROM_NAME: z.string().default("NexoERP"),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    PAYPAL_CLIENT_ID: z.string().default(""),
    PAYPAL_CLIENT_SECRET: z.string().default(""),
    PAYPAL_BASE_URL: z
        .string()
        .url()
        .refine((value) => new URL(value).protocol === "https:", {
            message: "La URL base de PayPal debe usar HTTPS.",
        })
        .default("https://api-m.sandbox.paypal.com"),
    PAYPAL_WEBHOOK_ID: z.string().default(""),
    PAYPAL_CURRENCY: z.enum(paypalCurrencies).default("USD"),
    PAYPAL_EXCHANGE_RATE: z
        .union([
            z.literal(""),
            z
                .string()
                .regex(
                    /^\d+(?:\.\d{1,6})?$/,
                    "La tasa de cambio admite hasta seis decimales.",
                ),
        ])
        .default(""),
    MARKETPLACE_COMMISSION_PERCENT: z
        .string()
        .regex(/^\d+(?:\.\d{1,2})?$/, "La comisión admite hasta dos decimales.")
        .transform(Number)
        .pipe(z.number().finite().min(0).max(100))
        .default("2"),
    WHATSAPP_ACCESS_TOKEN: z.string().default(""),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
    WHATSAPP_API_VERSION: z
        .string()
        .regex(/^v\d+\.\d+$/, "La versión de la API debe tener el formato v<mayor>.<menor>.")
        .default("v23.0"),
    WHATSAPP_OTP_TEMPLATE: z.string().default(""),
    WHATSAPP_OTP_TEMPLATE_LANG: z
        .string()
        .regex(/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/, "El idioma de la plantilla no es válido.")
        .default("es"),
    // Los cortes del dashboard son locales (no UTC). Se valida contra ICU
    // para rechazar zonas inexistentes al arrancar.
    DASHBOARD_TIMEZONE: z
        .string()
        .trim()
        .min(1)
        .default("America/Montevideo")
        .refine(
            (zona) => {
                try {
                    new Intl.DateTimeFormat("en-US", {
                        timeZone: zona,
                    }).format(new Date());
                    return true;
                } catch {
                    return false;
                }
            },
            { message: "La zona horaria del dashboard no es válida." },
        ),
});

export type AppConfig = {
    environment: "development" | "test" | "production";
    port: number;
    corsOrigin: string;
    jwtSecret: string;
    mailtrapSmtpHost?: string;
    mailtrapSmtpPort?: number;
    mailtrapSmtpUser?: string;
    mailtrapSmtpPass?: string;
    mailtrapFromEmail?: string;
    mailtrapFromName?: string;
    frontendUrl?: string;
    paypalClientId: string;
    paypalClientSecret: string;
    paypalBaseUrl: string;
    paypalWebhookId: string;
    paypalCurrency: PayPalCurrency;
    paypalExchangeRate: number;
    marketplaceCommissionPercent?: number;
    whatsappAccessToken: string;
    whatsappPhoneNumberId: string;
    whatsappApiVersion: string;
    whatsappOtpTemplate: string;
    whatsappOtpTemplateLang: string;
    dashboardTimezone: string;
};

export function loadConfig(
    env: NodeJS.ProcessEnv = process.env,
): AppConfig {
    const input = {
        NODE_ENV: env.NODE_ENV ?? "development",
        PORT: env.PORT ?? env.PUERTO_SERVIDOR ?? "4000",
        CORS_ORIGIN: env.CORS_ORIGIN ?? env.CORS_ORIGEN ?? "http://localhost:3000",
        DATABASE_URL:
            env.DATABASE_URL ?? defaultValues.DATABASE_URL,
        JWT_ACCESS_SECRET:
            env.JWT_ACCESS_SECRET ??
            env.JWT_ACCESS_SECRETO ??
            (env.NODE_ENV === "production"
                ? undefined
                : defaultValues.JWT_ACCESS_SECRET),
        MAILTRAP_SMTP_HOST: env.MAILTRAP_SMTP_HOST ?? "sandbox.smtp.mailtrap.io",
        MAILTRAP_SMTP_PORT: env.MAILTRAP_SMTP_PORT ?? "2525",
        MAILTRAP_SMTP_USER: env.MAILTRAP_SMTP_USER ?? "",
        MAILTRAP_SMTP_PASS: env.MAILTRAP_SMTP_PASS ?? "",
        MAILTRAP_FROM_EMAIL: env.MAILTRAP_FROM_EMAIL ?? "",
        MAILTRAP_FROM_NAME: env.MAILTRAP_FROM_NAME ?? "NexoERP",
        FRONTEND_URL: env.FRONTEND_URL ?? "http://localhost:3000",
        PAYPAL_CLIENT_ID: (env.PAYPAL_CLIENT_ID ?? "").trim(),
        PAYPAL_CLIENT_SECRET: (env.PAYPAL_CLIENT_SECRET ?? "").trim(),
        PAYPAL_BASE_URL:
            (env.PAYPAL_BASE_URL ?? "").trim() ||
            "https://api-m.sandbox.paypal.com",
        PAYPAL_WEBHOOK_ID: (env.PAYPAL_WEBHOOK_ID ?? "").trim(),
        PAYPAL_CURRENCY: (env.PAYPAL_CURRENCY ?? "USD").trim().toUpperCase(),
        PAYPAL_EXCHANGE_RATE: (env.PAYPAL_EXCHANGE_RATE ?? "").trim(),
        MARKETPLACE_COMMISSION_PERCENT:
            env.MARKETPLACE_COMMISSION_PERCENT ?? "2",
        WHATSAPP_ACCESS_TOKEN: (env.WHATSAPP_ACCESS_TOKEN ?? "").trim(),
        WHATSAPP_PHONE_NUMBER_ID: (env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim(),
        WHATSAPP_API_VERSION: (env.WHATSAPP_API_VERSION ?? "v23.0").trim(),
        WHATSAPP_OTP_TEMPLATE: (env.WHATSAPP_OTP_TEMPLATE ?? "").trim(),
        WHATSAPP_OTP_TEMPLATE_LANG:
            (env.WHATSAPP_OTP_TEMPLATE_LANG ?? "es").trim(),
    };

    const result = configSchema.safeParse(input);

    if (!result.success) {
        const invalidFields = [...new Set(
            result.error.issues.map((issue) => issue.path.join(".") || issue.code),
        )].join(", ");

        throw new Error(`Configuración inválida. Revisa: ${invalidFields}.`);
    }

    return {
        environment: result.data.NODE_ENV,
        port: result.data.PORT,
        corsOrigin: result.data.CORS_ORIGIN,
        jwtSecret: result.data.JWT_ACCESS_SECRET,
        mailtrapSmtpHost: result.data.MAILTRAP_SMTP_HOST,
        mailtrapSmtpPort: result.data.MAILTRAP_SMTP_PORT,
        mailtrapSmtpUser: result.data.MAILTRAP_SMTP_USER,
        mailtrapSmtpPass: result.data.MAILTRAP_SMTP_PASS,
        mailtrapFromEmail: result.data.MAILTRAP_FROM_EMAIL,
        mailtrapFromName: result.data.MAILTRAP_FROM_NAME,
        frontendUrl: result.data.FRONTEND_URL,
        paypalClientId: result.data.PAYPAL_CLIENT_ID,
        paypalClientSecret: result.data.PAYPAL_CLIENT_SECRET,
        paypalBaseUrl: result.data.PAYPAL_BASE_URL.replace(/\/+$/, ""),
        paypalWebhookId: result.data.PAYPAL_WEBHOOK_ID,
        paypalCurrency: result.data.PAYPAL_CURRENCY,
        paypalExchangeRate: result.data.PAYPAL_EXCHANGE_RATE
            ? Number(result.data.PAYPAL_EXCHANGE_RATE)
            : 0,
        marketplaceCommissionPercent:
            result.data.MARKETPLACE_COMMISSION_PERCENT,
        whatsappAccessToken: result.data.WHATSAPP_ACCESS_TOKEN,
        whatsappPhoneNumberId: result.data.WHATSAPP_PHONE_NUMBER_ID,
        whatsappApiVersion: result.data.WHATSAPP_API_VERSION,
        whatsappOtpTemplate: result.data.WHATSAPP_OTP_TEMPLATE,
        whatsappOtpTemplateLang: result.data.WHATSAPP_OTP_TEMPLATE_LANG,
        dashboardTimezone: result.data.DASHBOARD_TIMEZONE,
    };
}
