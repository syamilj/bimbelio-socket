export const env = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  FE_API_URL: process.env.FE_API_URL,
  BE_API_URL: process.env.BE_API_URL,
  CRM_API_URL: process.env.CRM_API_URL,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
};

if (!env.NODE_ENV) {
  throw new Error("NODE_ENV is not defined in environment variables");
}

if (!env.PORT) {
  throw new Error("PORT is not defined in environment variables");
}

if (!env.BE_API_URL) {
  throw new Error("BE_API_URL is not defined in environment variables");
}

if (!env.FE_API_URL) {
  throw new Error("FE_API_URL is not defined in environment variables");
}

if (!env.CRM_API_URL) {
  throw new Error("CRM_API_URL is not defined in environment variables");
}
