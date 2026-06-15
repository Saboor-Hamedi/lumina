const content = `
  <a href="#structure">Structure</a> .
  <a href="#domains">Domains</a> .
  ![Python](url)
`;

const tokens = content.split(/(\s+|!\[[^\]]*\]\([^)]+\)|<a\s[^>]*>[\s\S]*?<\/a>)/gi).filter(Boolean);
console.log(tokens);
