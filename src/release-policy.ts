/** GitHub may label a SemVer prerelease as stable; inspect both signals. */
export function isPrereleaseRelease(tag: string | undefined, githubPrerelease: boolean): boolean {
    if (githubPrerelease) return true;
    if (!tag) return false;
    // 只识别完整 SemVer，避免把任意带连字符的标签误判为预发布。
    // Only parse complete SemVer so ordinary dashed release names stay unchanged.
    return /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*(?:\+[0-9A-Za-z.-]+)?$/i.test(tag.trim());
}

/** Unknown or invalid publication dates cannot meet a positive minimum age. */
export function isReleaseOldEnough(publishedAt: string | undefined, minimumDays: number, now = Date.now()): boolean {
    if (minimumDays <= 0) return true;
    if (!publishedAt) return false;
    const published = Date.parse(publishedAt);
    return Number.isFinite(published) && published <= now - Math.floor(minimumDays) * 24 * 60 * 60 * 1000;
}

export function hasKnownPublicationDate(publishedAt: string | undefined): boolean {
    return Boolean(publishedAt && Number.isFinite(Date.parse(publishedAt)));
}
