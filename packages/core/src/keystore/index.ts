import { ctr } from "@noble/ciphers/aes.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { Bytes, BytesLike, bytesConcat, bytesFrom } from "../bytes/index.js";
import { hexFrom } from "../hex/index.js";

// The parameter r ("blockSize")
const DEFAULT_SCRYPT_PARAM_R = 8;
// The parallelization parameter p
const DEFAULT_SCRYPT_PARAM_P = 1;
// The CPU/Memory cost parameter N
const DEFAULT_SCRYPT_PARAM_N = 262144;

function mac(derivedKey: Bytes, cipherText: Bytes) {
  return hexFrom(
    keccak_256(bytesConcat(derivedKey.slice(16, 32), cipherText)),
  ).slice(2);
}

/**
 * @public
 */
export async function keystoreEncrypt(
  privateKeyLike: BytesLike,
  chainCodeLike: BytesLike,
  password: string,
): Promise<{
  id: string;
  crypto: {
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    cipher: string;
    kdf: string;
    kdfparams: {
      n: number;
      r: number;
      p: number;
      dklen: number;
      salt: string;
    };
    mac: string;
  };
}> {
  const salt = randomBytes(32);
  const iv = randomBytes(16);
  const kdfparams = {
    dklen: 32,
    salt: hexFrom(salt).slice(2),
    n: DEFAULT_SCRYPT_PARAM_N,
    r: DEFAULT_SCRYPT_PARAM_R,
    p: DEFAULT_SCRYPT_PARAM_P,
  };
  const derivedKey = await scryptAsync(bytesFrom(password, "utf8"), salt, {
    N: kdfparams.n,
    r: kdfparams.r,
    p: kdfparams.p,
    dkLen: kdfparams.dklen,
  });
  const cipher = ctr(
    derivedKey.slice(0, 16),
    iv.map((v) => v),
  );
  const ciphertext = cipher.encrypt(
    bytesConcat(bytesFrom(privateKeyLike), bytesFrom(chainCodeLike)),
  );

  return {
    id: hexFrom(randomBytes(16)).slice(2),
    crypto: {
      ciphertext: hexFrom(ciphertext).slice(2),
      cipherparams: {
        iv: hexFrom(iv).slice(2),
      },
      cipher: "aes-128-ctr",
      kdf: "scrypt",
      kdfparams,
      mac: mac(derivedKey, ciphertext),
    },
  };
}

/**
 * @public
 */
export async function keystoreDecrypt(
  keystore: unknown,
  password: string,
): Promise<{
  privateKey: Bytes;
  chainCode: Bytes;
}> {
  if (
    typeof keystore !== "object" ||
    keystore === null ||
    !("crypto" in keystore)
  ) {
    throw Error("Invalid keystore");
  }
  const crypto = keystore.crypto;

  if (
    typeof crypto !== "object" ||
    crypto === null ||
    !("kdfparams" in crypto) ||
    !("ciphertext" in crypto) ||
    typeof crypto.ciphertext !== "string" ||
    !("mac" in crypto) ||
    typeof crypto.mac !== "string" ||
    !("cipherparams" in crypto) ||
    typeof crypto.cipherparams !== "object" ||
    crypto.cipherparams === null ||
    !("iv" in crypto.cipherparams) ||
    typeof crypto.cipherparams.iv !== "string"
  ) {
    throw Error("Invalid crypto");
  }
  const kdfparams = crypto.kdfparams;

  if (
    typeof kdfparams !== "object" ||
    kdfparams === null ||
    !("n" in kdfparams) ||
    typeof kdfparams.n !== "number" ||
    !("r" in kdfparams) ||
    typeof kdfparams.r !== "number" ||
    !("p" in kdfparams) ||
    typeof kdfparams.p !== "number" ||
    !("dklen" in kdfparams) ||
    typeof kdfparams.dklen !== "number" ||
    !("salt" in kdfparams) ||
    typeof kdfparams.salt !== "string"
  ) {
    throw Error("Invalid kdfparams");
  }

  const derivedKey = await scryptAsync(
    bytesFrom(password, "utf8"),
    bytesFrom(kdfparams.salt),
    {
      N: kdfparams.n,
      r: kdfparams.r,
      p: kdfparams.p,
      dkLen: kdfparams.dklen,
    },
  );
  const ciphertext = bytesFrom(crypto.ciphertext);
  if (mac(derivedKey, ciphertext) !== crypto.mac) {
    throw Error("Invalid password");
  }
  const cipher = ctr(
    derivedKey.slice(0, 16),
    bytesFrom(crypto.cipherparams.iv),
  );
  const result = cipher.decrypt(ciphertext);
  return {
    privateKey: result.slice(0, 32),
    chainCode: result.slice(32),
  };
}
