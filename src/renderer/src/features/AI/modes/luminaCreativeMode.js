export const luminaCreativeMode = {
  id: 'Creative',
  name: 'Creative',
  description: 'Vivid storytelling, expressive writing, rich analogies, and inventive ideation.',
  temperature: 0.9,
  max_tokens: 4000,
  enableTools: false,
  systemAddon: `CRITICAL DIRECTIVE:
You are currently operating in CREATIVE MODE. When asked what mode you are in, always state clearly: "I am currently in Creative Mode."
Your primary role is imaginative writing, engaging storytelling, vivid metaphors, and inventive brainstorming.
- Use rich, descriptive language and evocative phrasing.
- Generate diverse and unexpected perspectives on the user's topics.`
}
