import mongoose from "mongoose";
import { DataKey, VaultObject } from "./models";
import { KEK_ID, newWrappedDek, encryptPayload, decryptPayload, sha256 } from "./crypto";

async function activeDataKey(personId) {
  const existing = await DataKey.findOne({ personId, state: "active" });
  if (existing) return existing;
  const generation = (await DataKey.countDocuments({ personId })) + 1;
  return DataKey.create({ personId, kekId: KEK_ID, generation, wrapped: newWrappedDek() });
}

// AAD binds the ciphertext to its own metadata row and owner.
const aadFor = (objectId, personId) => `${objectId}|${personId}`;

export async function sealPayload(personId, payload) {
  const key = await activeDataKey(personId);
  const _id = new mongoose.Types.ObjectId();
  const aad = aadFor(_id, personId);
  return VaultObject.create({
    _id,
    personId,
    dataKeyId: key._id,
    storageLocator: `mongodb://vault.objects/${_id}`,
    aadDigest: sha256(aad),
    ...encryptPayload(key.wrapped, payload, aad),
  });
}

// Returns { data } or { shredded } or { error }. Pass a Map to reuse keys across many records.
export async function openPayload(vaultObjectId, keyCache = new Map()) {
  const obj = await VaultObject.findById(vaultObjectId).lean();
  if (!obj) return { error: "Vault object missing" };
  if (obj.shreddedAt) return { shredded: true };

  const keyId = String(obj.dataKeyId);
  if (!keyCache.has(keyId)) keyCache.set(keyId, await DataKey.findById(obj.dataKeyId).lean());
  const key = keyCache.get(keyId);
  if (!key || key.state === "shredded" || !key.wrapped?.ciphertext) return { shredded: true };

  try {
    return { data: decryptPayload(key.wrapped, obj, aadFor(obj._id, obj.personId)) };
  } catch {
    return { error: "Decryption or integrity check failed" };
  }
}
