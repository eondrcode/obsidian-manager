import type { BetaSource } from "./data/types";
import type { ReleaseVersion } from "./github-install";

export interface SourceReleaseRef {
	tag: string;
	publishedAt?: string;
	prerelease?: boolean;
	index?: number;
}

export interface SourceReleaseCheck {
	target: SourceReleaseRef | null;
	installed: SourceReleaseRef | null;
}

const cleanReleaseTag = (tag?: string | null): string => (tag || "").trim();

const normalizeReleaseTag = (tag?: string | null): string => {
	const cleaned = cleanReleaseTag(tag).replace(/^refs\/tags\//i, "");
	return cleaned.replace(/^v(?=\d)/i, "").toLowerCase();
};

export const releaseTagsMatch = (a?: string | null, b?: string | null): boolean => {
	const left = cleanReleaseTag(a);
	const right = cleanReleaseTag(b);
	if (!left || !right) return false;
	if (left === right) return true;
	const normalizedLeft = normalizeReleaseTag(left);
	const normalizedRight = normalizeReleaseTag(right);
	return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const releaseToRef = (release: ReleaseVersion, index: number): SourceReleaseRef => ({
	tag: release.version,
	publishedAt: release.publishedAt,
	prerelease: release.prerelease,
	index,
});

export const findReleaseByTag = (versions: ReleaseVersion[], tag?: string | null): SourceReleaseRef | null => {
	const cleaned = cleanReleaseTag(tag);
	if (!cleaned) return null;
	const exactIndex = versions.findIndex((release) => cleanReleaseTag(release.version) === cleaned);
	if (exactIndex >= 0) return releaseToRef(versions[exactIndex], exactIndex);
	const normalizedIndex = versions.findIndex((release) => releaseTagsMatch(release.version, cleaned));
	return normalizedIndex >= 0 ? releaseToRef(versions[normalizedIndex], normalizedIndex) : null;
};

export const pickSourceTargetRelease = (source: BetaSource, versions: ReleaseVersion[]): SourceReleaseRef | null => {
	if (source.mode === "frozen") {
		const pinnedTag = cleanReleaseTag(source.frozenVersion)
			|| cleanReleaseTag(source.latestReleaseTag)
			|| cleanReleaseTag(source.latestVersion);
		if (!pinnedTag) return null;
		return findReleaseByTag(versions, pinnedTag) ?? {
			tag: pinnedTag,
			publishedAt: source.latestReleasePublishedAt || source.latestPublishedAt,
		};
	}

	const release = (source.includePrerelease ? versions : versions.filter((item) => !item.prerelease))[0];
	if (!release) return null;
	return releaseToRef(release, versions.indexOf(release));
};

export const resolveInstalledSourceRelease = (
	source: BetaSource,
	versions: ReleaseVersion[],
	localVersion?: string
): SourceReleaseRef | null => {
	const candidates = [
		source.installedReleaseTag,
		localVersion,
		source.localVersion,
	].filter(Boolean) as string[];

	for (const candidate of candidates) {
		const release = findReleaseByTag(versions, candidate);
		if (release) return release;
	}

	const storedTag = cleanReleaseTag(source.installedReleaseTag);
	if (storedTag) {
		return {
			tag: storedTag,
			publishedAt: source.installedReleasePublishedAt,
		};
	}

	const fallbackTag = cleanReleaseTag(localVersion || source.localVersion);
	return fallbackTag ? { tag: fallbackTag, publishedAt: source.installedReleasePublishedAt } : null;
};

export const syncSourceReleaseCheck = (
	source: BetaSource,
	versions: ReleaseVersion[],
	localVersion?: string
): SourceReleaseCheck => {
	const target = pickSourceTargetRelease(source, versions);
	const installed = resolveInstalledSourceRelease(source, versions, localVersion);

	source.localVersion = localVersion || source.localVersion || "";
	source.latestReleaseTag = target?.tag || "";
	source.latestReleasePublishedAt = target?.publishedAt;
	source.latestVersion = target?.tag || "";
	source.latestPublishedAt = target?.publishedAt;

	if (installed?.tag) source.installedReleaseTag = installed.tag;
	if (installed?.publishedAt) source.installedReleasePublishedAt = installed.publishedAt;

	return { target, installed };
};

export const markSourceInstalledRelease = (
	source: BetaSource,
	releaseTag: string,
	publishedAt?: string,
	localVersion?: string
): void => {
	const tag = cleanReleaseTag(releaseTag);
	if (tag) source.installedReleaseTag = tag;
	source.installedReleasePublishedAt = publishedAt || source.installedReleasePublishedAt;
	source.localVersion = localVersion || source.localVersion || tag;
};

const parseReleaseDate = (value?: string): number | null => {
	if (!value) return null;
	const time = new Date(value).getTime();
	return Number.isNaN(time) ? null : time;
};

const compareVersionTags = (a = "0.0.0", b = "0.0.0"): number => {
	const pa = a.replace(/^v/i, "").split(".").map(Number);
	const pb = b.replace(/^v/i, "").split(".").map(Number);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const ai = Number.isFinite(pa[i]) ? pa[i] : 0;
		const bi = Number.isFinite(pb[i]) ? pb[i] : 0;
		if (ai > bi) return 1;
		if (ai < bi) return -1;
	}
	return 0;
};

export const sourceUsesReleaseUpdateCheck = (source: BetaSource): boolean =>
	source.updateCheckMode !== "version";

export const sourceHasVersionUpdate = (source: BetaSource): boolean => {
	const targetVersion = cleanReleaseTag(
		source.mode === "frozen"
			? source.frozenVersion || source.latestVersion || source.latestReleaseTag
			: source.latestVersion || source.latestReleaseTag
	);
	const localVersion = cleanReleaseTag(source.localVersion || source.installedReleaseTag);

	if (!targetVersion || !localVersion) return false;
	return source.mode === "frozen"
		? !releaseTagsMatch(targetVersion, localVersion)
		: compareVersionTags(targetVersion, localVersion) > 0;
};

export const sourceHasReleaseUpdate = (source: BetaSource): boolean => {
	const targetTag = source.mode === "frozen"
		? cleanReleaseTag(source.frozenVersion || source.latestReleaseTag || source.latestVersion)
		: cleanReleaseTag(source.latestReleaseTag || source.latestVersion);
	const installedTag = cleanReleaseTag(source.installedReleaseTag || source.localVersion);

	if (!targetTag || !installedTag) return false;
	if (releaseTagsMatch(targetTag, installedTag)) return false;

	if (source.mode === "frozen") return true;

	const targetDate = parseReleaseDate(source.latestReleasePublishedAt || source.latestPublishedAt);
	const installedDate = parseReleaseDate(source.installedReleasePublishedAt);
	if (targetDate !== null && installedDate !== null) return targetDate > installedDate;

	return true;
};

export const sourceHasUpdate = (source: BetaSource): boolean =>
	sourceUsesReleaseUpdateCheck(source)
		? sourceHasReleaseUpdate(source)
		: sourceHasVersionUpdate(source);
