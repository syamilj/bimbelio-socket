import { Response } from "express";

export const responseError = (
  res: Response,
  error: any,
  errorMessage?: string
) => {
  console.log({ error });
  const status = error.status || 500;
  const message =
    errorMessage ||
    (!error.message.includes("prisma") && error.message) ||
    "Terjadi kesalahan pada server";
  return res.status(status).json({
    status,
    message,
  });
};
export const responseErrorValidation = (res: Response, errors: any) => {
  const status = 400;
  const message = "Validasi gagal";
  return res.status(status).json({
    status,
    message,
    errors,
  });
};

export const response = (
  res: Response,
  status: number,
  message: string,
  data?: any,
  page?: number,
  total_pages?: number,
  total_data?: number
) => {
  return res.status(status).json({
    status,
    message,
    page,
    total_pages,
    total_data,
    data,
  });
};

export const throwError = (status: number, message?: string) => {
  const error = new Error(message || "Terjadi kesalahan pada server");
  (error as any).status = status || 500;
  throw error;
};

// export const getZodErrorMessage = (issues: any[]) => {
//   let message: string | null = null;
//   issues.forEach((issue) => {
//     if (message) return;
//     const msg = issue.message;
//     // console.log({ msg, issue });
//     const expected = issue.expected;
//     const received = issue.received;
//     const path: string[] = issue.path;
//     message = `${msg} : `;
//     path.forEach((item, i) => {
//       message += `${item}${i < path.length - 1 ? "." : ""}`;
//     });
//     message = `${message}\n\nDiharapkan: ${expected}\nDiterima: ${received}`;
//   });
//   return message || "Data tidak valid!";
// };

export const checkZodSchema = (
  // res: Response,
  schema: any,
  data: any,
  status?: number
) => {
  if (!data) {
    throw throwError(status || 400, "Payload tidak boleh kosong");
  }
  const validatedFields = schema.safeParse(data);
  if (!validatedFields.success) {
    throw throwError(
      status || 400,
      getZodErrorMessage(validatedFields.error.issues)
    );
    // return response(res, 400, getZodErrorMessage(validatedFields.error.issues));
  }
};

export const getZodErrorMessage = (issues: any[]) => {
  let message: string | null = null;
  console.log({ issues });
  issues.forEach((issue) => {
    if (message) return;
    const msg = issue.message;
    const code = issue.code;
    message = msg || null;
    console.log({ issue });
    const expected = issue.expected;
    const received = issue.received;
    const path: string[] = issue.path;
    console.log({ path });
    // message = `${msg} : `;
    // path.forEach((item, i) => {
    //   message += `${item}${i < path.length - 1 ? "." : ""}`;
    // });
    // message = `${message}\n\nExpected: ${expected}\nReceived: ${received}`;
    message = `Field ${path.join(".")} is invalid`;
    if (msg === "Required") {
      message = `Field ${path.join(".")} is required`;
    } else if (code === "invalid_type") {
      message = `Field ${path.join(".")} must be a ${expected}`;
    }
    if (code === "too_small") {
      message = `Field ${path.join(".")} atleast ${issue.minimum} characters`;
    }
    if (code === "too_big") {
      message = `Field ${path.join(".")} at most ${issue.maximum} characters`;
    }
    if (code === "custom") {
      message = msg;
    }
  });
  return message || "Data tidak valid!";
};
