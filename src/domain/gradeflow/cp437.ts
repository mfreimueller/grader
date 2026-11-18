// Code page 437: the legacy encoding of file names in zips that do not set the UTF-8 flag.

const HIGH_HALF =
  "ÇüéâäàåçêëèïîìÄÅ" +
  "ÉæÆôöòûùÿÖÜ¢£¥₧ƒ" +
  "áíóúñÑªº¿⌐¬½¼¡«»" +
  "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐" +
  "└┴┬├─┼╞╟╚╔╩╦╠═╬╧" +
  "╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀" +
  "αßΓπΣσµτΦΘΩδ∞φε∩" +
  "≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const TABLE: readonly string[] = [...HIGH_HALF];

export function decodeCp437(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    text += byte < 0x80 ? String.fromCharCode(byte) : (TABLE[byte - 0x80] as string);
  }
  return text;
}
