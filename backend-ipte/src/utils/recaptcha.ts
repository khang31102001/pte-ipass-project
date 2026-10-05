// utils/recaptcha.ts
export type RecaptchaVerifyRequest = {
    token: string;
    ip?: string;
    expectedAction?: string;
};

export type RecaptchaGoogleResponse = {
    success: boolean;
    challenge_ts?: string; // ISO date string
    hostname?: string;
    score?: number; // v3 only
    action?: string; // v3 only
    "error-codes"?: string[];
};

export type RecaptchaVerifyResult = {
    raw: RecaptchaGoogleResponse;
    success: boolean;
    actionOk: boolean;
    score: number;
};

export async function verifyRecaptchaV3(
    req: RecaptchaVerifyRequest
): Promise<RecaptchaVerifyResult> {
    const { token, ip, expectedAction } = req;

    if (!token || typeof token !== "string") {
        throw new Error("Missing or invalid reCAPTCHA token");
    }

    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) throw new Error("Missing RECAPTCHA_SECRET_KEY");

    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (ip) params.append("remoteip", ip);

    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!resp.ok) {
        throw new Error(`reCAPTCHA verify request failed: HTTP ${resp.status}`);
    }

    const data = (await resp.json()) as RecaptchaGoogleResponse;

    const success = data.success === true;
    const actionOk = expectedAction ? data.action === expectedAction : true;

    // v3 có score, còn v2 thường không có -> fallback 0
    const score = typeof data.score === "number" ? data.score : 0;

    return { raw: data, success, actionOk, score };
}
