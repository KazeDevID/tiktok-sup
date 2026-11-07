/**
 * TypeScript Declarations for @kazedevid/tiktok-sup v1.4.0
 */

export interface DownloadOptions {
  quality?: "highest" | "lowest" | "original" | "1080p" | "720p" | "540p" | string;
}

export interface BatchItemResult {
  url: string;
  success: boolean;
  id?: string;
  postType?: "video" | "photo";
  path?: string;
  count?: number;
  error?: string;
}

export interface BatchDownloadOptions extends DownloadOptions {
  onProgress?: (progress: { current: number; total: number; item?: BatchItemResult; error?: string }) => void;
  delayMs?: number;
}

export type TikTokPostType = "video" | "photo";

export interface TikTokAuthor {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  verified: boolean;
  secUid?: string;
  signature?: string;
}

export interface TikTokStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
}

export interface TikTokBitrate {
  gearName?: string;
  bitrate?: number;
  qualityType?: number;
  codecType?: string;
  url?: string;
}

export interface TikTokSubtitle {
  id?: string;
  language: string;
  languageCode: string;
  url: string;
  format?: string;
  source?: string;
}

export interface TikTokVideoMedia {
  id: string;
  duration: number;
  width: number;
  height: number;
  ratio?: string;
  cover: string;
  dynamicCover?: string;
  originCover?: string;
  playUrl?: string;
  noWatermarkUrl?: string;
  downloadUrl?: string;
  watermarkUrl?: string;
  signedApiUrl?: string;
  bitrates?: TikTokBitrate[];
  subtitles?: TikTokSubtitle[];
  format?: string;
}

export interface TikTokPhotoItem {
  index: number;
  url: string;
  backupUrls?: string[];
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface TikTokMusic {
  id: string;
  title: string;
  author: string;
  duration: number;
  playUrl?: string;
  cover?: string;
}

export interface TikTokCommentItem {
  id: string;
  text: string;
  createTime: number;
  createTimeFormatted: string;
  likes: number;
  replyCount: number;
  authorPin?: boolean;
  user: {
    id: string;
    username: string;
    nickname: string;
    avatar: string;
  };
}

export interface TikTokCommentsResult {
  postId: string;
  total: number;
  hasMore: boolean;
  cursor: number;
  comments: TikTokCommentItem[];
}

export interface TikTokOEmbed {
  version: string;
  type: string;
  title?: string;
  authorName?: string;
  authorUrl?: string;
  width?: string | number;
  height?: string | number;
  html: string;
  providerUrl: string;
  providerName: string;
  embedProductId?: string;
}

export interface TikTokSearchResultItem {
  type: "creator" | "hashtag" | "music" | "unknown";
  id: string;
  title: string;
  subTitle?: string;
  description?: string;
  cover?: string;
  link?: string;
  extraInfo?: Record<string, any>;
}

export interface TikTokSearchResult {
  query: string;
  category: "all" | "creator" | "hashtag" | "music";
  items: TikTokSearchResultItem[];
}

export interface TikTokComment {
  cid: string;
  text: string;
  createTime: number;
  diggCount: number;
  replyCount: number;
  user: {
    id: string;
    username: string;
    nickname: string;
    avatar: string;
  };
}

export interface TikTokVideoResult {
  id: string;
  url: string;
  postType: TikTokPostType;
  isPhoto: boolean;
  description: string;
  hashtags?: string[];
  mentions?: string[];
  createTime: number;
  createTimeFormatted: string;
  author: TikTokAuthor;
  stats: TikTokStats;
  video?: TikTokVideoMedia;
  photos?: string[];
  photoDetails?: TikTokPhotoItem[];
  music?: TikTokMusic;
  comments?: TikTokComment[];
  sessionCookies: string;
  download?: (outputPath: string, options?: DownloadOptions) => Promise<string>;
  downloadBuffer?: () => Promise<Buffer>;
  downloadPhotos?: (outputDir: string) => Promise<string[]>;
  downloadAudio?: (outputPath: string) => Promise<string>;
  downloadAudioBuffer?: () => Promise<Buffer>;
  getComments?: (count?: number, cursor?: number) => Promise<TikTokCommentsResult>;
  getOEmbed?: () => Promise<TikTokOEmbed>;
}

export interface TikTokUserProfile {
  id: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
  avatarMedium: string;
  avatarThumb: string;
  signature: string;
  bioLink?: { link: string; risk: number };
  verified: boolean;
  secUid: string;
  privateAccount: boolean;
  stats: {
    followerCount: number;
    followingCount: number;
    heartCount: number;
    videoCount: number;
    friendCount: number;
  };
  shareMeta?: {
    title: string;
    desc: string;
  };
}

export interface TikTokTrendingItem {
  type: "creator" | "hashtag" | "music" | "unknown";
  id: string;
  title: string;
  subTitle?: string;
  desc?: string;
  cover?: string;
}

export interface TikTokHashtagInfo {
  id: string;
  title: string;
  views?: string;
  desc?: string;
  cover?: string;
}

export interface TikTokSoundInfo {
  id: string;
  title: string;
  author?: string;
  playUrl?: string;
  cover?: string;
  duration?: number;
}

export const MOBILE_USER_AGENT: string;
export const BOT_USER_AGENT: string;
export const DESKTOP_USER_AGENT: string;

export function parseTikTokUrl(inputUrl: string): {
  normalizedUrl: string;
  videoId?: string;
  isPhoto: boolean;
};

export function resolveUrl(inputUrl: string): Promise<{
  canonicalUrl: string;
  cookies: string;
  videoId?: string;
  isPhoto: boolean;
}>;

export function scrapeVideo(inputUrl: string): Promise<TikTokVideoResult>;
export function scrapeUser(inputUsername: string): Promise<TikTokUserProfile>;
export function scrapeTrending(
  category?: "all" | "creator" | "hashtag" | "music"
): Promise<TikTokTrendingItem[]>;
export function scrapeHashtag(tag: string): Promise<TikTokHashtagInfo>;
export function scrapeSound(soundIdOrUrl: string): Promise<TikTokSoundInfo>;

export function scrapeComments(
  postIdOrUrl: string,
  options?: { count?: number; cursor?: number; sessionCookies?: string }
): Promise<TikTokCommentsResult>;

export function scrapeOEmbed(inputUrl: string): Promise<TikTokOEmbed>;

export function scrapeSearch(
  query: string,
  category?: "all" | "creator" | "hashtag" | "music"
): Promise<TikTokSearchResult>;

export function extractHashtags(text: string): string[];
export function extractMentions(text: string): string[];

export function fetchMediaStream(
  mediaUrl: string,
  cookieStr?: string,
  rangeHeader?: string
): Promise<Response>;

export function downloadFile(
  mediaUrl: string,
  outputPath: string,
  cookieStr?: string
): Promise<string>;

export function downloadBuffer(
  mediaUrl: string,
  cookieStr?: string
): Promise<Buffer>;

export function downloadPhoto(
  photoUrl: string,
  outputPath: string,
  cookieStr?: string
): Promise<string>;

export function downloadAllPhotos(
  photoUrls: string[],
  outputDir: string,
  cookieStr?: string
): Promise<string[]>;

export function downloadAudio(
  audioUrl: string,
  outputPath: string,
  cookieStr?: string
): Promise<string>;

export function downloadAudioBuffer(
  audioUrl: string,
  cookieStr?: string
): Promise<Buffer>;

export function batchDownload(
  urls: string[],
  outputDir?: string,
  options?: BatchDownloadOptions
): Promise<BatchItemResult[]>;

export function mergeCookies(
  existingCookieStr?: string,
  newCookieHeaders?: string | string[]
): string;

export function extractCookieHeaders(response: Response): string[];

declare const _default: {
  scrapeVideo: typeof scrapeVideo;
  scrapeUser: typeof scrapeUser;
  scrapeTrending: typeof scrapeTrending;
  scrapeHashtag: typeof scrapeHashtag;
  scrapeSound: typeof scrapeSound;
  scrapeComments: typeof scrapeComments;
  scrapeOEmbed: typeof scrapeOEmbed;
  scrapeSearch: typeof scrapeSearch;
  extractHashtags: typeof extractHashtags;
  extractMentions: typeof extractMentions;
  downloadFile: typeof downloadFile;
  downloadBuffer: typeof downloadBuffer;
  downloadPhoto: typeof downloadPhoto;
  downloadAllPhotos: typeof downloadAllPhotos;
  downloadAudio: typeof downloadAudio;
  downloadAudioBuffer: typeof downloadAudioBuffer;
  batchDownload: typeof batchDownload;
  parseTikTokUrl: typeof parseTikTokUrl;
  resolveUrl: typeof resolveUrl;
  fetchMediaStream: typeof fetchMediaStream;
  mergeCookies: typeof mergeCookies;
  extractCookieHeaders: typeof extractCookieHeaders;
};

export default _default;
