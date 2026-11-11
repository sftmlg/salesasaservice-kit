export function printLine(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function printErrorLine(text: string): void {
  process.stderr.write(`${text}\n`);
}
