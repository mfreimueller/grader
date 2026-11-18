import { decodeCp437 } from "../../../../src/domain/gradeflow/cp437";

describe("cp437", () => {
  describe("decodeCp437", () => {
    it("keeps ASCII as it is", () => {
      expect(decodeCp437(Uint8Array.from([0x61, 0x2f, 0x7e]))).toBe("a/~");
    });

    it("maps the high half through the CP437 table", () => {
      expect(decodeCp437(Uint8Array.from([0x81, 0x84, 0x94, 0xe1, 0x80]))).toBe("üäößÇ");
      expect(decodeCp437(Uint8Array.from([0xff]))).toBe(" ");
      expect(decodeCp437(Uint8Array.from([0xb0]))).toBe("░");
    });

    it("has exactly 128 distinct high entries", () => {
      const all = decodeCp437(Uint8Array.from(Array.from({ length: 128 }, (_, i) => 0x80 + i)));
      expect([...all]).toHaveLength(128);
      expect(new Set(all).size).toBe(128);
    });
  });
});
