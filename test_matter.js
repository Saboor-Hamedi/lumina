const matter = require('gray-matter');

const input = "Hello world\n\n\n";
const output = matter.stringify(input, { title: "Test" });

console.log("Original length:", input.length);
console.log("Output ends with newlines?", output.endsWith("\n\n\n"));
console.log(JSON.stringify(output));
