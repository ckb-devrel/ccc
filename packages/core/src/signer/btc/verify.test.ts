import { describe, expect, it } from "vitest";
import { bytesFrom } from "../../bytes";
import { hexFrom } from "../../hex";
import { messageHashBtcEcdsa } from "./verify";

describe("messageHashBtcEcdsa", () => {
  it("should hash a string message with the default prefix", () => {
    const message = "hello world";
    const hash = messageHashBtcEcdsa(message);
    expect(hexFrom(hash)).toBe(
      "0x0b6b6ce07bc55ee4aeba0098a5e5d2c8986cab228a54199723f9962316633733",
    );
  });

  it("should hash a bytes message with the default prefix", () => {
    const message = bytesFrom("hello world", "utf8");
    const hash = messageHashBtcEcdsa(message);
    expect(hexFrom(hash)).toBe(
      "0x0b6b6ce07bc55ee4aeba0098a5e5d2c8986cab228a54199723f9962316633733",
    );
  });

  it("should hash a string message with a custom prefix", () => {
    const message = "test message";
    const prefix = "Custom Prefix:";
    const hash = messageHashBtcEcdsa(message, prefix);
    // Custom prefix hashes are not standard, this is just to test the implementation
    expect(hexFrom(hash)).toBe(
      "0x490753d972e3234b777e2eeff0195657e86a35ce317abf5124dc13696c3969fc",
    );
  });

  it("should hash a bytes message with a custom prefix", () => {
    const message = bytesFrom("test message", "utf8");
    const prefix = bytesFrom("Custom Prefix:", "utf8");
    const hash = messageHashBtcEcdsa(message, prefix);
    expect(hexFrom(hash)).toBe(
      "0x490753d972e3234b777e2eeff0195657e86a35ce317abf5124dc13696c3969fc",
    );
  });

  it("should handle an empty message", () => {
    const message = "";
    const hash = messageHashBtcEcdsa(message);
    expect(hexFrom(hash)).toBe(
      "0x80e795d4a4caadd7047af389d9f7f220562feb6196032e2131e10563352c4bcc",
    );
  });

  it("should handle a message with non-ASCII characters", () => {
    const message = "你好，世界";
    const hash = messageHashBtcEcdsa(message);
    expect(hexFrom(hash)).toBe(
      "0xd6f001f3c0c93bbbd60331c9275637d06d7e861327fc339dbbb785f44e557084",
    );
  });

  it("should handle a message with length >= 0xfd", () => {
    const message = "a".repeat(0xfd);
    const hash = messageHashBtcEcdsa(message);
    expect(hexFrom(hash)).toBe(
      "0xdf167ad249ff5837e6acada677118b2ecc6757ab4cdade39caead99ef0220230",
    );
  });

  it("should handle a message with length > 0xffff", () => {
    const message = "a".repeat(0x10000);
    const hash = messageHashBtcEcdsa(message);
    expect(hexFrom(hash)).toBe(
      "0xd5db7ae9446693355e5674d5d17e7b0a29f13fc174055077d9613e9ab2b462fe",
    );
  });
});
