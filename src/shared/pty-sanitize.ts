// Removes color-query escape sequences (OSC 10;? / 11;? / 12;? / 4;?)
// coming from the pty. Otherwise xterm.js answers them by writing its own
// theme colors back into the pty, and the shell echoes those responses,
// which looks like garbage being typed into the input line.
export function sanitizePtyData(data: string): string {
  return data.replace(/\x1b\](?:\d+);\?(?:\x07|\x1b\\)/g, '')
}
