import axios from "axios";
import z from "zod";
import { checkZodSchema } from "../../utils/response";
import { env } from "../../env";

const CODE = "123";

const Schema = z.object({
  phoneNumber: z.string(),
  text: z.string(),
  variables: z.object({ name: z.string() }).optional(),
  useQueue: z.boolean(),
  useHumanBehavior: z.boolean(),
});

export const sendRich = async (payload: z.infer<typeof Schema>) => {
  try {
    checkZodSchema(Schema, payload);
    const response = await axios.post(
      `${env.CRM_API_URL}/web/send-rich?code=${CODE}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          code1: CODE,
          code2: CODE,
        },
      }
    );
    console.log("[CRM] : Success Send Rich", response.data);
    return true;
  } catch (error: any) {
    console.error("[CRM] : Failed Send Rich", error.message);
    return false;
  }
};
