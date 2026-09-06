#!/usr/bin/env node
// json-pretty — stdin JSON in, pretty JSON out (validates too).
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { input += c; });
process.stdin.on("end", () => {
  if (!input.trim()) { console.error("json-pretty: empty stdin. Usage: curl … | json-pretty"); process.exit(1); }
  try {
    console.log(JSON.stringify(JSON.parse(input), null, 2));
  } catch (e) {
    console.error("json-pretty: invalid JSON — " + e.message.split("\n")[0]);
    process.exit(1);
  }
});
