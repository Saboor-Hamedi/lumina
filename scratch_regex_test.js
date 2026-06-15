const { Decoration } = require('@codemirror/view')

const text = '<div align="center">';
const regex = /<div[^>]*align=["']center["'][^>]*>/i;
console.log('Regex match:', regex.test(text));

const tagRegex = /(<\/?div[^>]*>|<\/?p>|<\/?br\s*\/?>|<\/?span[^>]*>)/gi;
console.log('Tag match:', tagRegex.test(text));
