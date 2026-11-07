/**
 * @license
 * MIT License
 * Copyright (c) 2026 KazeDevID
 *
 * @kazedevid/tiktok-sup v1.3.0
 * Pure TikTok Web Scraper & Clean Media Stream Engine
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
const MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
const BOT_USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function mergeCookies(existingCookieStr = "", newCookieHeaders = []) {
  const jar = /* @__PURE__ */ new Map();
  if (existingCookieStr) {
    for (const part of String(existingCookieStr).split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        jar.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim());
      }
    }
  }
  const headersList = Array.isArray(newCookieHeaders) ? newCookieHeaders : newCookieHeaders ? [newCookieHeaders] : [];
  for (const item of headersList) {
    if (!item) continue;
    const cookiePart = String(item).split(";")[0].trim();
    const eqIdx = cookiePart.indexOf("=");
    if (eqIdx !== -1) {
      jar.set(cookiePart.slice(0, eqIdx).trim(), cookiePart.slice(eqIdx + 1).trim());
    }
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}
function extractCookieHeaders(res) {
  if (!res || !res.headers) return [];
  const headersAny = res.headers;
  if (typeof headersAny.getSetCookie === "function") {
    const list = headersAny.getSetCookie();
    if (Array.isArray(list) && list.length > 0) return list.filter(Boolean);
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}
function findItemStruct(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return null;
  if (obj.itemInfo?.itemStruct && typeof obj.itemInfo.itemStruct === "object") {
    return obj.itemInfo.itemStruct;
  }
  if (obj.itemStruct && typeof obj.itemStruct === "object" && (obj.itemStruct.id || obj.itemStruct.imagePost || obj.itemStruct.video)) {
    return obj.itemStruct;
  }
  for (const key of Object.keys(obj)) {
    if (key.includes("translation") || key.includes("i18n")) continue;
    const val = obj[key];
    if (val && typeof val === "object") {
      const found = findItemStruct(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function parseTikTokUrl(inputUrl) {
  const clean = String(inputUrl || "").trim();
  if (/^\d{15,22}$/.test(clean)) {
    return {
      videoId: clean,
      isShort: false,
      isPhoto: false,
      normalizedUrl: `https://www.tiktok.com/@tiktok/video/${clean}`
    };
  }
  const isShort = clean.includes("vt.tiktok.com") || clean.includes("vm.tiktok.com") || clean.includes("/t/");
  const isPhoto = clean.includes("/photo/");
  const videoMatch = clean.match(/\/video\/(\d{15,22})/);
  const photoMatch = clean.match(/\/photo\/(\d{15,22})/);
  const vMatch = clean.match(/\/v\/(\d{15,22})/);
  const userMatch = clean.match(/@([a-zA-Z0-9_.-]+)/);
  const videoId = videoMatch?.[1] || photoMatch?.[1] || vMatch?.[1];
  const username = userMatch?.[1];
  let normalizedUrl = clean;
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    normalizedUrl = "https://" + clean;
  }
  if (videoId && !username && !isShort) {
    if (isPhoto) {
      normalizedUrl = `https://www.tiktok.com/@tiktok/photo/${videoId}`;
    } else {
      normalizedUrl = `https://www.tiktok.com/@tiktok/video/${videoId}`;
    }
  }
  return {
    videoId,
    username,
    isShort,
    isPhoto,
    normalizedUrl
  };
}
async function resolveUrl(inputUrl) {
  const { normalizedUrl, videoId: parsedId, isPhoto: parsedIsPhoto } = parseTikTokUrl(inputUrl);
  const res = await fetch(normalizedUrl, {
    headers: {
      "User-Agent": MOBILE_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    },
    redirect: "follow"
  });
  const cookies = mergeCookies("", extractCookieHeaders(res));
  let finalUrl = res.url;
  const isPhoto = finalUrl.includes("/photo/") || parsedIsPhoto;
  const idMatch = finalUrl.match(/\/video\/(\d{15,22})/);
  const photoMatch = finalUrl.match(/\/photo\/(\d{15,22})/);
  const extractedId = photoMatch?.[1] || idMatch?.[1] || parsedId;
  if (finalUrl.includes("tiktok.com/?") && extractedId) {
    finalUrl = isPhoto ? `https://www.tiktok.com/@tiktok/photo/${extractedId}` : `https://www.tiktok.com/@tiktok/video/${extractedId}`;
  }
  return {
    canonicalUrl: finalUrl,
    cookies,
    videoId: extractedId,
    isPhoto
  };
}
async function scrapeVideo(inputUrl) {
  const {
    canonicalUrl,
    cookies: initialCookies,
    videoId: resolvedId,
    isPhoto: urlIsPhoto
  } = await resolveUrl(inputUrl);
  let cookieJar = initialCookies || "";
  const res = await fetch(canonicalUrl, {
    headers: {
      "User-Agent": MOBILE_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.tiktok.com/",
      ...cookieJar ? { Cookie: cookieJar } : {}
    },
    redirect: "follow"
  });
  cookieJar = mergeCookies(cookieJar, extractCookieHeaders(res));
  let html = res.ok ? await res.text() : "";
  let itemStruct = null;
  let commentsRaw = [];
  if (html) {
    const apiDataMatch = html.match(
      /<script id="api-data"[^>]*>([\s\S]*?)<\/script>/
    );
    if (apiDataMatch) {
      try {
        const parsed = JSON.parse(apiDataMatch[1]);
        const detail = parsed.videoDetail || parsed.reflowVideoDetail || parsed.photoDetail;
        if (detail?.itemInfo?.itemStruct) {
          itemStruct = detail.itemInfo.itemStruct;
        } else {
          itemStruct = findItemStruct(parsed);
        }
        if (parsed.commentList?.comments && Array.isArray(parsed.commentList.comments)) {
          commentsRaw = parsed.commentList.comments;
        }
      } catch (_) {
      }
    }
  }
  if (!itemStruct && html) {
    const rehydrationMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (rehydrationMatch) {
      try {
        const parsed = JSON.parse(rehydrationMatch[1]);
        const scope = parsed["__DEFAULT_SCOPE__"] || {};
        const detailObj = scope["webapp.reflow.video.detail"] || scope["webapp.video-detail"] || scope["webapp.reflow.photo.detail"] || scope["webapp.photo-detail"] || scope["webapp.videoDetail"];
        if (detailObj?.itemInfo?.itemStruct) {
          itemStruct = detailObj.itemInfo.itemStruct;
        } else {
          itemStruct = findItemStruct(parsed);
        }
        if (detailObj?.commentList?.comments && Array.isArray(detailObj.commentList.comments)) {
          commentsRaw = detailObj.commentList.comments;
        }
      } catch (_) {
      }
    }
  }
  if (!itemStruct && html) {
    const nextMatch = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (nextMatch) {
      try {
        const parsed = JSON.parse(nextMatch[1]);
        itemStruct = findItemStruct(parsed);
      } catch (_) {
      }
    }
  }
  if (!itemStruct && html) {
    const sigiMatch = html.match(
      /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/
    );
    if (sigiMatch) {
      try {
        const parsed = JSON.parse(sigiMatch[1]);
        const items = parsed.ItemModule || {};
        const firstKey = Object.keys(items)[0];
        if (firstKey && items[firstKey]) {
          itemStruct = items[firstKey];
        }
      } catch (_) {
      }
    }
  }
  const needsPlayAddr = !itemStruct || !itemStruct.imagePost && !itemStruct.video?.playAddr;
  if (needsPlayAddr && resolvedId) {
    try {
      const fallbackUrl = urlIsPhoto ? `https://www.tiktok.com/@tiktok/photo/${resolvedId}` : `https://www.tiktok.com/@tiktok/video/${resolvedId}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          "User-Agent": MOBILE_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://www.tiktok.com/",
          ...cookieJar ? { Cookie: cookieJar } : {}
        },
        redirect: "follow"
      });
      cookieJar = mergeCookies(cookieJar, extractCookieHeaders(fbRes));
      if (fbRes.ok) {
        const fbHtml = await fbRes.text();
        const fbApiMatch = fbHtml.match(
          /<script id="api-data"[^>]*>([\s\S]*?)<\/script>/
        );
        if (fbApiMatch) {
          const parsed = JSON.parse(fbApiMatch[1]);
          const d = parsed.videoDetail || parsed.photoDetail;
          if (d?.itemInfo?.itemStruct) {
            itemStruct = d.itemInfo.itemStruct;
          } else {
            itemStruct = findItemStruct(parsed);
          }
          if (parsed.commentList?.comments) {
            commentsRaw = parsed.commentList.comments;
          }
        }
      }
    } catch (_) {
    }
  }
  let videoObjectData = null;
  if (!itemStruct && resolvedId) {
    try {
      const botUrl = `https://www.tiktok.com/@tiktok/video/${resolvedId}`;
      const botRes = await fetch(botUrl, {
        headers: {
          "User-Agent": BOT_USER_AGENT,
          "Referer": "https://www.tiktok.com/",
          ...cookieJar ? { Cookie: cookieJar } : {}
        },
        redirect: "follow"
      });
      cookieJar = mergeCookies(cookieJar, extractCookieHeaders(botRes));
      if (botRes.ok) {
        const botHtml = await botRes.text();
        const voMatch = botHtml.match(
          /<script[^>]*id="VideoObject"[^>]*>([\s\S]*?)<\/script>/
        );
        if (voMatch) {
          videoObjectData = JSON.parse(voMatch[1]);
        }
      }
    } catch (_) {
    }
  }
  if (!itemStruct && !videoObjectData) {
    throw new Error(
      "Could not locate TikTok post data on tiktok.com. Post may be private, region-restricted, or removed."
    );
  }
  const photoDetails = [];
  const photos = [];
  const rawImages = itemStruct?.imagePost?.images || itemStruct?.images || [];
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    rawImages.forEach((img, idx) => {
      const urlList = img.imageURL?.urlList || img.displayImage?.urlList || img.thumbnail?.urlList || (img.url ? [img.url] : []);
      const primaryUrl = urlList[0];
      if (primaryUrl) {
        photos.push(primaryUrl);
        photoDetails.push({
          index: idx + 1,
          url: primaryUrl,
          backupUrls: urlList.slice(1),
          thumbnail: img.thumbnail?.urlList?.[0] || primaryUrl,
          width: Number(img.imageWidth || img.width || 0) || void 0,
          height: Number(img.imageHeight || img.height || 0) || void 0
        });
      }
    });
  }
  const isPhoto = photos.length > 0;
  const postType = isPhoto ? "photo" : "video";
  const author = {
    id: String(itemStruct?.author?.id || videoObjectData?.creator?.["@id"] || ""),
    username: String(
      itemStruct?.author?.uniqueId || videoObjectData?.creator?.name || ""
    ),
    nickname: String(
      itemStruct?.author?.nickname || videoObjectData?.creator?.name || "TikTok Creator"
    ),
    avatar: String(
      itemStruct?.author?.avatarLarger || itemStruct?.author?.avatarMedium || itemStruct?.author?.avatarThumb || ""
    ),
    verified: Boolean(itemStruct?.author?.verified),
    secUid: itemStruct?.author?.secUid,
    signature: itemStruct?.author?.signature
  };
  let interactionLikes = 0;
  let interactionComments = 0;
  if (Array.isArray(videoObjectData?.interactionStatistic)) {
    for (const st of videoObjectData.interactionStatistic) {
      const type = st.interactionType?.["@type"] || "";
      if (type.includes("LikeAction"))
        interactionLikes = Number(st.userInteractionCount || 0);
      if (type.includes("CommentAction"))
        interactionComments = Number(st.userInteractionCount || 0);
    }
  }
  const stats = {
    views: Number(itemStruct?.stats?.playCount || 0),
    likes: Number(itemStruct?.stats?.diggCount || interactionLikes || 0),
    comments: Number(itemStruct?.stats?.commentCount || interactionComments || 0),
    shares: Number(itemStruct?.stats?.shareCount || 0),
    bookmarks: Number(itemStruct?.stats?.collectCount || 0)
  };
  const bitrates = [];
  if (Array.isArray(itemStruct?.video?.bitrateInfo)) {
    for (const b of itemStruct.video.bitrateInfo) {
      bitrates.push({
        gearName: b.GearName,
        bitrate: b.Bitrate,
        qualityType: b.QualityType,
        codecType: b.CodecType,
        url: b.PlayAddr?.UrlList?.[0]
      });
    }
  }
  const subtitles = [];
  if (Array.isArray(itemStruct?.video?.subtitleInfos)) {
    for (const sub of itemStruct.video.subtitleInfos) {
      if (sub.Url) {
        subtitles.push({
          id: String(sub.Id || ""),
          language: String(sub.Language || ""),
          languageCode: String(sub.LanguageCodeName || ""),
          url: String(sub.Url),
          format: String(sub.Format || "webvtt"),
          source: String(sub.Source || "")
        });
      }
    }
  }
  let video;
  if (!isPhoto) {
    const playAddr = itemStruct?.video?.playAddr ? String(itemStruct.video.playAddr) : bitrates[0]?.url;
    const downloadAddr = itemStruct?.video?.downloadAddr ? String(itemStruct.video.downloadAddr) : playAddr;
    const signedApiUrl = videoObjectData?.contentUrl;
    const resolvedPlayUrl = playAddr || signedApiUrl;
    if (resolvedPlayUrl || itemStruct?.video) {
      video = {
        id: String(itemStruct?.video?.id || itemStruct?.id || resolvedId || ""),
        duration: Number(itemStruct?.video?.duration || 0),
        width: Number(itemStruct?.video?.width || 0),
        height: Number(itemStruct?.video?.height || 0),
        ratio: itemStruct?.video?.ratio,
        cover: String(
          itemStruct?.video?.cover || (Array.isArray(videoObjectData?.thumbnailUrl) ? videoObjectData.thumbnailUrl[0] : videoObjectData?.thumbnailUrl) || ""
        ),
        dynamicCover: itemStruct?.video?.dynamicCover ? String(itemStruct.video.dynamicCover) : void 0,
        originCover: itemStruct?.video?.originCover ? String(itemStruct.video.originCover) : void 0,
        playUrl: resolvedPlayUrl,
        noWatermarkUrl: resolvedPlayUrl,
        downloadUrl: downloadAddr || resolvedPlayUrl,
        watermarkUrl: downloadAddr || resolvedPlayUrl,
        signedApiUrl,
        bitrates: bitrates.length > 0 ? bitrates : void 0,
        subtitles: subtitles.length > 0 ? subtitles : void 0,
        format: itemStruct?.video?.format || "mp4"
      };
    }
  }
  let music;
  if (itemStruct?.music) {
    music = {
      id: String(itemStruct.music.id || ""),
      title: String(itemStruct.music.title || "Original Sound"),
      author: String(itemStruct.music.authorName || author.nickname),
      duration: Number(itemStruct.music.duration || 0),
      playUrl: itemStruct.music.playUrl ? String(itemStruct.music.playUrl) : void 0,
      cover: itemStruct.music.coverLarge ? String(itemStruct.music.coverLarge) : itemStruct.music.coverMedium ? String(itemStruct.music.coverMedium) : void 0
    };
  }
  let comments;
  if (commentsRaw.length > 0) {
    comments = commentsRaw.map((c) => ({
      cid: String(c.cid || ""),
      text: String(c.text || ""),
      createTime: Number(c.create_time || 0),
      diggCount: Number(c.digg_count || 0),
      replyCount: Number(c.reply_comment_total || 0),
      user: {
        id: String(c.user?.uid || ""),
        username: String(c.user?.unique_id || ""),
        nickname: String(c.user?.nickname || ""),
        avatar: String(c.user?.avatar_thumb?.url_list?.[0] || "")
      }
    }));
  }
  const createTime = Number(
    itemStruct?.createTime || (videoObjectData?.uploadDate ? Math.floor(new Date(videoObjectData.uploadDate).getTime() / 1e3) : 0)
  );
  const createDate = createTime > 0 ? new Date(createTime * 1e3) : /* @__PURE__ */ new Date();
  const description = String(
    itemStruct?.desc || videoObjectData?.description || ""
  );
  const result = {
    id: String(itemStruct?.id || resolvedId || ""),
    url: canonicalUrl,
    postType,
    isPhoto,
    description,
    createTime,
    createTimeFormatted: createDate.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }),
    author,
    stats,
    video,
    photos: isPhoto ? photos : void 0,
    photoDetails: isPhoto ? photoDetails : void 0,
    music,
    comments,
    hashtags: extractHashtags(description),
    mentions: extractMentions(description),
    sessionCookies: cookieJar
  };
  if (result.video) {
    const defaultMediaUrl = result.video.noWatermarkUrl || result.video.playUrl || "";
    result.download = (outputPath, options = {}) => {
      let targetUrl = defaultMediaUrl;
      if (options.quality && Array.isArray(result.video?.bitrates)) {
        if (options.quality === "highest") {
          const sorted = [...result.video.bitrates].sort(
            (a, b) => (b.bitrate || 0) - (a.bitrate || 0)
          );
          if (sorted[0]?.url) targetUrl = sorted[0].url;
        } else if (options.quality === "lowest") {
          const sorted = [...result.video.bitrates].sort(
            (a, b) => (a.bitrate || 0) - (b.bitrate || 0)
          );
          if (sorted[0]?.url) targetUrl = sorted[0].url;
        } else {
          const matched = result.video.bitrates.find(
            (b) => b.gearName?.toLowerCase().includes(String(options.quality).toLowerCase())
          );
          if (matched?.url) targetUrl = matched.url;
        }
      }
      return downloadFile(targetUrl, outputPath, cookieJar);
    };
    result.downloadBuffer = () => downloadBuffer(defaultMediaUrl, cookieJar);
  }
  if (result.isPhoto && result.photos) {
    result.downloadPhotos = (outputDir) => downloadAllPhotos(result.photos || [], outputDir, cookieJar);
  }
  if (result.music?.playUrl) {
    result.downloadAudio = (outputPath) => downloadAudio(result.music.playUrl, outputPath, cookieJar);
    result.downloadAudioBuffer = () => downloadAudioBuffer(result.music.playUrl, cookieJar);
  }
  result.getComments = (count = 20, cursor = 0) => scrapeComments(result.id, { count, cursor, sessionCookies: cookieJar });
  result.getOEmbed = () => scrapeOEmbed(result.url);
  result.engagement = calculateEngagement(stats);
  result.getTranscript = () => {
    const subUrl = video?.subtitles?.[0]?.url;
    return subUrl ? scrapeTranscript(subUrl) : Promise.resolve(null);
  };
  return result;
}
async function scrapeUser(inputUsername) {
  const cleanUsername = String(inputUsername || "").trim().replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, "").replace(/^@+/, "").split("/")[0].split("?")[0];
  if (!cleanUsername) throw new Error('Parameter "inputUsername" is required');
  const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;
  const res = await fetch(profileUrl, {
    headers: {
      "User-Agent": MOBILE_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.tiktok.com/"
    },
    redirect: "follow"
  });
  const html = await res.text();
  const rehydrationMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (rehydrationMatch) {
    try {
      const data = JSON.parse(rehydrationMatch[1]);
      const userDetail = data["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
      const userInfo = userDetail?.userInfo;
      if (userInfo?.user) {
        const u = userInfo.user;
        const s = userInfo.stats || {};
        return {
          id: String(u.id || ""),
          uniqueId: String(u.uniqueId || cleanUsername),
          nickname: String(u.nickname || cleanUsername),
          avatar: String(
            u.avatarLarger || u.avatarMedium || u.avatarThumb || ""
          ),
          avatarMedium: String(u.avatarMedium || u.avatarThumb || ""),
          avatarThumb: String(u.avatarThumb || ""),
          signature: String(u.signature || ""),
          bioLink: u.bioLink ? { link: u.bioLink.link, risk: u.bioLink.risk } : void 0,
          verified: Boolean(u.verified),
          secUid: String(u.secUid || ""),
          privateAccount: Boolean(u.privateAccount),
          stats: {
            followerCount: Number(s.followerCount || 0),
            followingCount: Number(s.followingCount || 0),
            heartCount: Number(s.heartCount || s.heart || 0),
            videoCount: Number(s.videoCount || 0),
            friendCount: Number(s.friendCount || 0)
          },
          shareMeta: userDetail.shareMeta,
          getVideos: () => scrapeUserVideos(cleanUsername)
        };
      }
    } catch (_) {
    }
  }
  throw new Error(`Could not find profile data for @${cleanUsername}`);
}
async function scrapeTrending(category = "all") {
  const res = await fetch("https://www.tiktok.com/node/share/discover", {
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.tiktok.com/"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch trending discovery data: HTTP ${res.status}`);
  }
  const json = await res.json();
  const results = [];
  if (Array.isArray(json.body)) {
    for (const group of json.body) {
      if (Array.isArray(group.exploreList)) {
        for (const item of group.exploreList) {
          const cardItem = item.cardItem || {};
          let itemType = "unknown";
          if (cardItem.subTitle?.startsWith("@") || group.type === 1) {
            itemType = "creator";
          } else if (cardItem.title?.startsWith("#") || group.type === 2) {
            itemType = "hashtag";
          } else if (group.type === 3) {
            itemType = "music";
          }
          if (category === "all" || category === itemType) {
            results.push({
              type: itemType,
              id: String(cardItem.id || ""),
              title: String(cardItem.title || ""),
              subTitle: cardItem.subTitle,
              desc: cardItem.desc,
              cover: cardItem.cover
            });
          }
        }
      }
    }
  }
  return results;
}
async function scrapeHashtag(tag) {
  const cleanTag = String(tag || "").trim().replace(/^#/, "");
  const trending = await scrapeTrending("hashtag");
  const matched = trending.find(
    (h) => h.title.toLowerCase().replace(/^#/, "") === cleanTag.toLowerCase()
  );
  if (matched) {
    return {
      id: matched.id,
      title: matched.title,
      views: matched.subTitle,
      desc: matched.desc,
      cover: matched.cover,
      getVideos: () => scrapeHashtagVideos(cleanTag)
    };
  }
  return {
    id: cleanTag,
    title: `#${cleanTag}`,
    views: "Trending",
    getVideos: () => scrapeHashtagVideos(cleanTag)
  };
}
async function scrapeSound(soundIdOrUrl) {
  const clean = String(soundIdOrUrl || "").trim().replace(/^https?:\/\/(www\.)?tiktok\.com\/music\/[^\/]+-/, "");
  const trending = await scrapeTrending("music");
  const matched = trending.find(
    (m) => m.id === clean || m.title.toLowerCase().includes(clean.toLowerCase())
  );
  if (matched) {
    return {
      id: matched.id,
      title: matched.title,
      author: matched.subTitle,
      cover: matched.cover,
      getVideos: () => scrapeSoundVideos(clean)
    };
  }
  return {
    id: clean,
    title: "Soundtrack",
    getVideos: () => scrapeSoundVideos(clean)
  };
}
async function fetchMediaStream(mediaUrl, cookieStr = "", rangeHeader, userAgent = MOBILE_USER_AGENT) {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');
  const headers = {
    "User-Agent": userAgent,
    "Referer": "https://www.tiktok.com/",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9"
  };
  if (cookieStr) {
    headers["Cookie"] = cookieStr;
  }
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }
  let res = await fetch(mediaUrl, {
    headers,
    redirect: "follow"
  });
  if (res.status === 403 && !rangeHeader) {
    headers["Range"] = "bytes=0-";
    const retryRes = await fetch(mediaUrl, {
      headers,
      redirect: "follow"
    });
    if (retryRes.ok) {
      return retryRes;
    }
  }
  return res;
}
async function downloadFile(mediaUrl, outputPath, cookieStr = "") {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');
  if (!outputPath) throw new Error('Parameter "outputPath" is required');
  const res = await fetchMediaStream(mediaUrl, cookieStr);
  if (!res.ok) {
    throw new Error(
      `Failed to download media: HTTP ${res.status} (${res.statusText || "Forbidden"}). Ensure you pass the matching sessionCookies: await downloadFile(cleanUrl, path, post.sessionCookies) or use post.download(path).`
    );
  }
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fileStream = fs.createWriteStream(outputPath);
  if (res.body) {
    await pipeline(Readable.fromWeb(res.body), fileStream);
  } else {
    throw new Error("Response body was empty");
  }
  return outputPath;
}
async function downloadBuffer(mediaUrl, cookieStr = "") {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');
  const res = await fetchMediaStream(mediaUrl, cookieStr);
  if (!res.ok) {
    throw new Error(
      `Failed to download media buffer: HTTP ${res.status} (${res.statusText || "Forbidden"}). Ensure sessionCookies match the video URL signature.`
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
async function downloadPhoto(photoUrl, outputPath, cookieStr = "") {
  return downloadFile(photoUrl, outputPath, cookieStr);
}
async function downloadAllPhotos(photoUrls, outputDir, cookieStr = "") {
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    throw new Error('Parameter "photoUrls" must be a non-empty array');
  }
  const resolvedDir = path.resolve(outputDir || "./photos");
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }
  const savedPaths = [];
  for (let i = 0; i < photoUrls.length; i++) {
    const filename = `photo_${String(i + 1).padStart(2, "0")}.jpg`;
    const targetPath = path.join(resolvedDir, filename);
    await downloadFile(photoUrls[i], targetPath, cookieStr);
    savedPaths.push(targetPath);
  }
  return savedPaths;
}
async function downloadAudio(audioUrl, outputPath, cookieStr = "") {
  return downloadFile(audioUrl, outputPath, cookieStr);
}
async function downloadAudioBuffer(audioUrl, cookieStr = "") {
  return downloadBuffer(audioUrl, cookieStr);
}
async function batchDownload(urls, outputDir = "./downloads", options = {}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('Parameter "urls" must be a non-empty array of TikTok URLs');
  }
  const resolvedDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }
  const results = [];
  const delayMs = typeof options.delayMs === "number" ? options.delayMs : 300;
  for (let i = 0; i < urls.length; i++) {
    const rawUrl = String(urls[i] || "").trim();
    if (!rawUrl) continue;
    if (i > 0 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const post = await scrapeVideo(rawUrl);
      if (post.isPhoto && post.photos && post.photos.length > 0) {
        const photoSubdir = path.join(resolvedDir, `photos_${post.id}`);
        const saved = post.downloadPhotos ? await post.downloadPhotos(photoSubdir) : await downloadAllPhotos(post.photos, photoSubdir, post.sessionCookies);
        const item = {
          url: rawUrl,
          success: true,
          id: post.id,
          postType: "photo",
          path: photoSubdir,
          count: saved.length
        };
        results.push(item);
        if (typeof options.onProgress === "function") {
          options.onProgress({ current: i + 1, total: urls.length, item });
        }
      } else if (post.video) {
        const filePath = path.join(resolvedDir, `${post.id}_clean.mp4`);
        if (post.download) {
          await post.download(filePath, options);
        } else {
          const streamUrl = post.video.noWatermarkUrl || post.video.playUrl || "";
          await downloadFile(streamUrl, filePath, post.sessionCookies);
        }
        const item = {
          url: rawUrl,
          success: true,
          id: post.id,
          postType: "video",
          path: filePath
        };
        results.push(item);
        if (typeof options.onProgress === "function") {
          options.onProgress({ current: i + 1, total: urls.length, item });
        }
      }
    } catch (err) {
      const failItem = {
        url: rawUrl,
        success: false,
        error: err.message
      };
      results.push(failItem);
      if (typeof options.onProgress === "function") {
        options.onProgress({ current: i + 1, total: urls.length, error: err.message });
      }
    }
  }
  return results;
}
function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu);
  return matches ? [...new Set(matches.map((t) => t.slice(1)))] : [];
}
function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(/@([\p{L}\p{N}._]+)/gu);
  return matches ? [...new Set(matches.map((m) => m.slice(1)))] : [];
}
async function scrapeComments(postIdOrUrl, options = {}) {
  let postId = String(postIdOrUrl || "").trim();
  let cookieStr = options.sessionCookies || "";
  if (postId.startsWith("http")) {
    const post = await scrapeVideo(postId);
    postId = post.id;
    if (!cookieStr) {
      cookieStr = post.sessionCookies || "";
    }
  }
  const count = Math.min(options.count || 20, 50);
  const cursor = options.cursor || 0;
  const url = `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${encodeURIComponent(
    postId
  )}&count=${count}&cursor=${cursor}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
      "Referer": "https://www.tiktok.com/",
      ...cookieStr ? { Cookie: cookieStr } : {},
      "Accept": "application/json, text/plain, */*"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch comments: HTTP ${res.status}`);
  }
  const json = await res.json();
  const rawComments = Array.isArray(json.comments) ? json.comments : [];
  const comments = rawComments.map((c) => ({
    id: String(c.cid || ""),
    text: String(c.text || ""),
    createTime: Number(c.create_time || 0),
    createTimeFormatted: c.create_time ? new Date(c.create_time * 1e3).toLocaleString() : "",
    likes: Number(c.digg_count || 0),
    replyCount: Number(c.reply_comment_total || 0),
    authorPin: Boolean(c.author_pin),
    user: {
      id: String(c.user?.uid || c.user?.id || ""),
      username: String(c.user?.unique_id || c.user?.sec_uid || ""),
      nickname: String(c.user?.nickname || "TikTok User"),
      avatar: String(
        c.user?.avatar_thumb?.url_list?.[0] || c.user?.avatar_medium?.url_list?.[0] || ""
      )
    }
  }));
  return {
    postId,
    total: Number(json.total || comments.length),
    hasMore: Boolean(json.has_more),
    cursor: Number(json.cursor || 0),
    comments
  };
}
async function scrapeOEmbed(inputUrl) {
  const cleanUrl = String(inputUrl || "").trim();
  if (!cleanUrl) throw new Error('Parameter "inputUrl" is required');
  let targetUrl = cleanUrl;
  if (cleanUrl.includes("vt.tiktok.com")) {
    const resolved = await resolveUrl(cleanUrl);
    targetUrl = resolved.canonicalUrl;
  }
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`;
  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
      "Accept": "application/json, text/plain, */*"
    }
  });
  if (!res.ok) {
    const idMatch = targetUrl.match(/\/(video|photo)\/(\d{15,22})/);
    const mediaId = idMatch?.[2] || "";
    return {
      version: "1.0",
      type: "video",
      title: "TikTok Media",
      html: `<blockquote class="tiktok-embed" cite="${targetUrl}" data-video-id="${mediaId}"><section><a target="_blank" href="${targetUrl}">Watch on TikTok</a></section></blockquote><script async src="https://www.tiktok.com/embed.js"><\/script>`,
      providerUrl: "https://www.tiktok.com",
      providerName: "TikTok",
      embedProductId: mediaId
    };
  }
  const json = await res.json();
  return {
    version: json.version || "1.0",
    type: json.type || "video",
    title: json.title || "",
    authorName: json.author_name || "",
    authorUrl: json.author_url || "",
    width: json.width,
    height: json.height,
    html: json.html || "",
    providerUrl: json.provider_url || "https://www.tiktok.com",
    providerName: json.provider_name || "TikTok",
    embedProductId: json.embed_product_id
  };
}
async function scrapeSearch(query, category = "all") {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) throw new Error('Parameter "query" is required');
  const endpoint = `https://www.tiktok.com/node/share/discover?search=${encodeURIComponent(
    cleanQuery
  )}`;
  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.tiktok.com/"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to search tiktok.com: HTTP ${res.status}`);
  }
  const json = await res.json();
  const items = [];
  if (Array.isArray(json.body)) {
    for (const group of json.body) {
      if (Array.isArray(group.exploreList)) {
        for (const raw of group.exploreList) {
          const c = raw.cardItem || {};
          let itemType = "unknown";
          if (c.subTitle?.startsWith("@") || c.type === 2) {
            itemType = "creator";
          } else if (c.title?.startsWith("#") || c.type === 3) {
            itemType = "hashtag";
          } else if (c.type === 1 || c.extraInfo?.musicId) {
            itemType = "music";
          }
          if (category === "all" || category === itemType) {
            items.push({
              type: itemType,
              id: String(c.id || ""),
              title: String(c.title || ""),
              subTitle: c.subTitle,
              description: c.description || c.desc,
              cover: c.cover,
              link: c.link,
              extraInfo: c.extraInfo
            });
          }
        }
      }
    }
  }
  return {
    query: cleanQuery,
    category,
    items
  };
}
function parseIsoDuration(durationStr) {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}
function calculateEngagement(stats) {
  const views = Number(stats.views || 0);
  const likes = Number(stats.likes || 0);
  const comments = Number(stats.comments || 0);
  const shares = Number(stats.shares || 0);
  const bookmarks = Number(stats.bookmarks || 0);
  const totalEngagements = likes + comments + shares + bookmarks;
  const rate = views > 0 ? totalEngagements / views * 100 : 0;
  const likeRatio = views > 0 ? likes / views * 100 : 0;
  const virality = views > 0 ? (shares * 3 + bookmarks * 2 + likes) / views * 100 : 0;
  let benchmark = "Average";
  if (rate >= 15 || virality >= 25) {
    benchmark = "Viral";
  } else if (rate >= 8) {
    benchmark = "High";
  } else if (rate < 3) {
    benchmark = "Low";
  }
  return {
    engagementRate: parseFloat(rate.toFixed(2)),
    likeRatio: parseFloat(likeRatio.toFixed(2)),
    viralityScore: parseFloat(virality.toFixed(2)),
    benchmark
  };
}
function parseItemListHtml(html) {
  const match = html.match(
    /<script type="application\/ld\+json" id="ItemList">([\s\S]*?)<\/script>/
  );
  if (!match) return [];
  try {
    const json = JSON.parse(match[1]);
    const elements = Array.isArray(json.itemListElement) ? json.itemListElement : [];
    return elements.map((el) => {
      const idMatch = el.url?.match(/\/(video|photo)\/(\d{15,22})/);
      const videoId = idMatch?.[2] || String(el.url || "");
      const rawInteractions = el.interactionStatistic || [];
      let views = 0;
      let likes = 0;
      let bookmarks = 0;
      let shares = 0;
      const comments = parseInt(el.commentCount || "0", 10);
      if (Array.isArray(rawInteractions)) {
        for (const inter of rawInteractions) {
          const type = String(inter.interactionType?.["@type"] || "");
          const count = Number(inter.userInteractionCount || 0);
          if (type.includes("WatchAction")) views = count;
          else if (type.includes("LikeAction")) likes = count;
          else if (type.includes("SaveAction")) bookmarks = count;
          else if (type.includes("ShareAction")) shares = count;
        }
      }
      const stats = { views, likes, comments, shares, bookmarks };
      const durationSeconds = parseIsoDuration(el.duration);
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      const durationFormatted = `${mins}:${secs.toString().padStart(2, "0")}`;
      return {
        id: videoId,
        url: String(el.url || ""),
        title: String(el.name || "").replace(/ \| TikTok$/, ""),
        description: String(el.description || ""),
        thumbnail: String(el.thumbnailUrl?.[0] || ""),
        uploadDate: String(el.uploadDate || ""),
        duration: durationSeconds,
        durationFormatted,
        stats,
        audio: el.audio ? {
          title: el.audio.name,
          author: el.audio.author,
          url: el.audio.mainEntityOfPage?.["@id"]
        } : void 0,
        genre: Array.isArray(el.genre) ? el.genre : void 0,
        locationCreated: el.locationCreated,
        engagement: calculateEngagement(stats)
      };
    });
  } catch (_) {
    return [];
  }
}
async function scrapeUserVideos(inputUsername) {
  const cleanUsername = String(inputUsername || "").trim().replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, "").replace(/^@+/, "").split("/")[0].split("?")[0];
  if (!cleanUsername) throw new Error('Parameter "inputUsername" is required');
  const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;
  const res = await fetch(profileUrl, {
    headers: {
      "User-Agent": BOT_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user feed: HTTP ${res.status}`);
  }
  const html = await res.text();
  return parseItemListHtml(html);
}
async function scrapeHashtagVideos(tag) {
  const cleanTag = String(tag || "").trim().replace(/^#/, "");
  const url = `https://www.tiktok.com/tag/${encodeURIComponent(cleanTag)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": BOT_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch hashtag videos: HTTP ${res.status}`);
  return parseItemListHtml(await res.text());
}
async function scrapeSoundVideos(soundIdOrUrl) {
  let target = String(soundIdOrUrl || "").trim();
  if (!target.startsWith("http")) {
    target = `https://www.tiktok.com/music/track-${target}`;
  }
  const res = await fetch(target, {
    headers: {
      "User-Agent": BOT_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch sound videos: HTTP ${res.status}`);
  return parseItemListHtml(await res.text());
}
async function scrapeTranscript(subtitleUrlOrText) {
  let content = subtitleUrlOrText;
  if (subtitleUrlOrText.startsWith("http")) {
    const res = await fetch(subtitleUrlOrText, {
      headers: { "User-Agent": DESKTOP_USER_AGENT }
    });
    content = await res.text();
  }
  const cues = [];
  const cueBlocks = content.split(/\r?\n\r?\n/);
  for (const block of cueBlocks) {
    const lines = block.trim().split(/\r?\n/);
    const timeLine = lines.find((l) => l.includes("-->"));
    if (timeLine) {
      const parts = timeLine.split("-->");
      const start = parts[0]?.trim() || "";
      const end = parts[1]?.trim()?.split(" ")[0] || "";
      const textLines = lines.filter((l) => l !== timeLine && !l.match(/^\d+$/));
      const text = textLines.join(" ").replace(/<[^>]+>/g, "").trim();
      if (text) {
        cues.push({ start, end, text });
      }
    }
  }
  const fullText = cues.map((c) => c.text).join(" ");
  const words = fullText.split(/\s+/).filter(Boolean);
  return {
    wordCount: words.length,
    fullText,
    cues
  };
}
export {
  BOT_USER_AGENT,
  DESKTOP_USER_AGENT,
  MOBILE_USER_AGENT,
  batchDownload,
  calculateEngagement,
  downloadAllPhotos,
  downloadAudio,
  downloadAudioBuffer,
  downloadBuffer,
  downloadFile,
  downloadPhoto,
  extractCookieHeaders,
  extractHashtags,
  extractMentions,
  fetchMediaStream,
  findItemStruct,
  mergeCookies,
  parseIsoDuration,
  parseTikTokUrl,
  resolveUrl,
  scrapeComments,
  scrapeHashtag,
  scrapeHashtagVideos,
  scrapeOEmbed,
  scrapeSearch,
  scrapeSound,
  scrapeSoundVideos,
  scrapeTranscript,
  scrapeTrending,
  scrapeUser,
  scrapeUserVideos,
  scrapeVideo
};
