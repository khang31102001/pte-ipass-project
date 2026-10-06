import argon2 from "argon2";

const OPTIONS: argon2.Options = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Băm giả để thời gian phản hồi như nhau khi email không tồn tại (chống dò tài khoản). */
let dummy: Promise<string> | undefined;
export const dummyVerify = async (plain: string) => {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummy, plain);
};

/** Chính sách mật khẩu tối thiểu: ≥ 10 ký tự, có chữ hoa, chữ thường và số. */
export function passwordIssues(plain: string): string | null {
  if (plain.length < 10) return "Mật khẩu tối thiểu 10 ký tự";
  if (!/[a-z]/.test(plain) || !/[A-Z]/.test(plain) || !/\d/.test(plain)) return "Mật khẩu cần có chữ hoa, chữ thường và số";
  return null;
}
