const text = `
<p class="center">
  <a href="#structure">Structure</a> .
</p>
<div align="center">
  ![Python](url)
</div>
`;

const divRegex = /<(div|p)[^>]*(?:align=["']center["']|class=["'][^"']*center[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/gi;

let match;
while ((match = divRegex.exec(text)) !== null) {
  console.log("Matched:", match[0]);
  console.log("Content:", match[2]);
}
