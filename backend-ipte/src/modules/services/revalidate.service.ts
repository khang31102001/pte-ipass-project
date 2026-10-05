export async function revalidate(tags: string[]): Promise<void> {
    try {
        await fetch(`${process.env.NEXT_APP_URL}/api/revalidate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-revalidate-secret": process.env.REVALIDATE_SECRET || "",
            },
            body: JSON.stringify({ tags }),
            signal: AbortSignal.timeout(5000),
        });
    } catch (err) {
        if ((err as any).name === "AbortError") {
            console.error("Revalidate timeout");
        } else {
            console.error("Revalidate failed", err);
        }
    }
}
