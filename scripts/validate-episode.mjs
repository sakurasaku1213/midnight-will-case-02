// シナリオJSONの参照整合性チェック
// 使い方: node scripts/validate-episode.mjs [data/episode-02.json]
// フラグの未定義参照、ID参照切れ、素材パス切れを検出する。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const episodePath = path.resolve(root, process.argv[2] || "data/episode-02.json");
const episode = JSON.parse(fs.readFileSync(episodePath, "utf8"));

const errors = [];
const warnings = [];

// --- ID収集 ---
const collectIds = (items, label, { requireId = true } = {}) => {
  const ids = new Set();
  for (const item of items || []) {
    if (!item.id) {
      if (requireId) {
        warnings.push(`${label}: id がない要素があります（エピソードによっては任意）: ${JSON.stringify(item).slice(0, 60)}`);
      }
      continue;
    }
    if (ids.has(item.id)) errors.push(`${label}: id が重複しています: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
};

const characterIds = collectIds(episode.characters, "characters");
const evidenceIds = collectIds(episode.evidence, "evidence");
const locationIds = collectIds(episode.locations, "locations");
collectIds(episode.talks, "talks");
collectIds(episode.presentReactions, "presentReactions", { requireId: false });
collectIds(episode.analysisLinks, "analysisLinks");
for (const location of episode.locations || []) {
  collectIds(location.actions, `locations/${location.id}/actions`);
}

// --- 再帰ウォーカー: フラグと参照を収集 ---
const setFlags = new Set();
const requiredFlags = new Map(); // flag -> 最初の参照箇所

const noteRequired = (flag, where) => {
  if (flag && !requiredFlags.has(flag)) requiredFlags.set(flag, where);
};

const walk = (node, trail) => {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${trail}[${index}]`));
    return;
  }
  if (!node || typeof node !== "object") return;

  const here = node.id ? `${trail}(${node.id})` : trail;

  for (const flag of node.setFlags || []) setFlags.add(flag);
  if (typeof node.setFlag === "string") setFlags.add(node.setFlag);
  // 証言の「押す」操作で立つフラグ（AppShellがstate.flagsへ追加する）
  if (typeof node.pressFlag === "string") setFlags.add(node.pressFlag);
  for (const flag of node.requiresFlags || []) noteRequired(flag, here);
  if (typeof node.requiredFlag === "string") noteRequired(node.requiredFlag, here);

  if (typeof node.characterId === "string" && !characterIds.has(node.characterId)) {
    errors.push(`${here}: characterId が未定義です: ${node.characterId}`);
  }
  if (typeof node.evidenceId === "string" && !evidenceIds.has(node.evidenceId)) {
    errors.push(`${here}: evidenceId が未定義です: ${node.evidenceId}`);
  }
  for (const id of node.evidenceIds || []) {
    if (!evidenceIds.has(id)) errors.push(`${here}: evidenceIds に未定義の証拠があります: ${id}`);
  }
  for (const id of node.addEvidence || []) {
    if (!evidenceIds.has(id)) errors.push(`${here}: addEvidence に未定義の証拠があります: ${id}`);
  }
  if (typeof node.evidenceAnswer === "string" && !evidenceIds.has(node.evidenceAnswer)) {
    errors.push(`${here}: evidenceAnswer が未定義です: ${node.evidenceAnswer}`);
  }
  for (const id of node.availableAt || []) {
    if (!locationIds.has(id)) errors.push(`${here}: availableAt に未定義の場所があります: ${id}`);
  }

  for (const [key, value] of Object.entries(node)) {
    walk(value, `${trail}.${key}`);
  }
};

walk(episode, "episode");

// --- トップレベル参照 ---
if (episode.startLocationId && !locationIds.has(episode.startLocationId)) {
  errors.push(`startLocationId が未定義です: ${episode.startLocationId}`);
}
if (episode.finalFlag) noteRequired(episode.finalFlag, "episode.finalFlag");

// --- フラグ整合性 ---
for (const [flag, where] of requiredFlags) {
  if (!setFlags.has(flag)) {
    errors.push(`フラグ "${flag}" は ${where} で要求されていますが、どこでも set されません。`);
  }
}
for (const flag of setFlags) {
  if (!requiredFlags.has(flag)) {
    warnings.push(`フラグ "${flag}" は set されますが、どこからも参照されていません。`);
  }
}

// --- 素材パス ---
const assetFields = [];
for (const character of episode.characters || []) {
  if (character.portrait) assetFields.push([`characters(${character.id}).portrait`, character.portrait]);
  for (const [variant, src] of Object.entries(character.portraitVariants || {})) {
    assetFields.push([`characters(${character.id}).portraitVariants.${variant}`, src]);
  }
}
for (const item of [...(episode.evidence || []), ...(episode.locations || [])]) {
  if (item.image) assetFields.push([`${item.id}.image`, item.image]);
}
const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  for (const [where, src] of assetFields) {
    if (typeof src !== "string" || !src) continue;
    const normalized = src.replace(/^\//, "");
    const candidates = [path.join(publicDir, normalized), path.join(root, normalized)];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      errors.push(`${where}: 素材ファイルが見つかりません: ${src}`);
    }
  }
} else {
  console.log("INFO: public フォルダが無いため、素材ファイルの存在チェックはスキップしました。");
}

// --- 結果 ---
for (const warning of warnings) console.log(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
console.log(`\n検証対象: ${path.relative(root, episodePath)}`);
console.log(`キャラ ${characterIds.size} / 証拠 ${evidenceIds.size} / 場所 ${locationIds.size} / setフラグ ${setFlags.size} / 参照フラグ ${requiredFlags.size}`);
console.log(`結果: エラー ${errors.length} 件 / 警告 ${warnings.length} 件`);
process.exit(errors.length > 0 ? 1 : 0);
