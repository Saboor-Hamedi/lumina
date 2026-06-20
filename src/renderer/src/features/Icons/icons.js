export const EMOJI_LIST = [
  // 💻 General Tech & Dev
  { char: '💻', name: 'laptop', tags: ['computer', 'pc', 'mac', 'developer', 'work', 'remote'] },
  {
    char: '🖥️',
    name: 'desktop',
    tags: ['computer', 'monitor', 'screen', 'workstation', 'display']
  },
  { char: '⌨️', name: 'keyboard', tags: ['type', 'code', 'input', 'typing', 'mechanical'] },
  { char: '🖱️', name: 'mouse', tags: ['click', 'cursor', 'peripheral', 'computer'] },
  { char: '📱', name: 'smartphone', tags: ['mobile', 'app', 'ios', 'android', 'device'] },
  { char: '📟', name: 'pager', tags: ['retro', 'vintage', 'device', 'old'] },
  { char: '🕹️', name: 'joystick', tags: ['gaming', 'controller', 'play', 'arcade', 'console'] },
  { char: '🎮', name: 'gamepad', tags: ['play', 'console', 'controller', 'gaming', 'xbox'] },
  { char: '🎧', name: 'headphones', tags: ['audio', 'music', 'listen', 'podcast', 'sound'] },
  { char: '🖨️', name: 'printer', tags: ['print', 'office', 'document', 'paper', 'hardware'] },
  { char: '☎️', name: 'telephone', tags: ['call', 'phone', 'contact', 'support', 'office'] },

  // 🛠️ Development & Engineering
  {
    char: '🚀',
    name: 'rocket',
    tags: ['launch', 'deploy', 'fast', 'boost', 'ship', 'startup', 'space']
  },
  { char: '⚙️', name: 'gear', tags: ['settings', 'config', 'options', 'preferences', 'tools'] },
  { char: '🔧', name: 'wrench', tags: ['tool', 'fix', 'repair', 'config', 'mechanical'] },
  { char: '🛠️', name: 'tools', tags: ['wrench', 'hammer', 'build', 'construct', 'workshop'] },
  { char: '🐛', name: 'bug', tags: ['insect', 'error', 'debug', 'issue', 'problem'] },
  { char: '🔨', name: 'hammer', tags: ['build', 'construct', 'tool', 'fix', 'hardware'] },
  { char: '⚡', name: 'lightning', tags: ['bolt', 'fast', 'quick', 'electric', 'power', 'energy'] },
  { char: '🔌', name: 'plug', tags: ['power', 'connect', 'api', 'electric', 'energy'] },
  { char: '🔋', name: 'battery', tags: ['power', 'energy', 'charge', 'android', 'mobile'] },
  { char: '📡', name: 'satellite', tags: ['signal', 'wifi', 'connect', 'network', 'broadcast'] },
  { char: '🧪', name: 'test tube', tags: ['experiment', 'lab', 'testing', 'qa', 'science'] },
  { char: '🧬', name: 'dna', tags: ['code', 'biology', 'structure', 'genetic', 'science'] },

  // 🔒 Security & Privacy
  { char: '🔒', name: 'lock', tags: ['security', 'private', 'password', 'protected', 'auth'] },
  { char: '🔓', name: 'unlock', tags: ['open', 'access', 'public', 'unlocked'] },
  { char: '🔑', name: 'key', tags: ['lock', 'password', 'auth', 'access', 'secret'] },
  { char: '🛡️', name: 'shield', tags: ['security', 'protect', 'guard', 'safe', 'defense'] },
  {
    char: '🔐',
    name: 'locked with key',
    tags: ['security', 'encrypted', 'private', 'auth', 'safe']
  },
  { char: '🔏', name: 'locked with pen', tags: ['signature', 'seal', 'verified', 'secure'] },
  { char: '🗝️', name: 'old key', tags: ['lock', 'password', 'auth', 'access', 'retro'] },

  // ☁️ Cloud & Networking
  { char: '☁️', name: 'cloud', tags: ['weather', 'server', 'hosting', 'online', 'aws'] },
  { char: '🌐', name: 'globe', tags: ['world', 'internet', 'web', 'network', 'global'] },
  { char: '🌍', name: 'earth africa', tags: ['world', 'international', 'global', 'planet'] },
  { char: '🌎', name: 'earth americas', tags: ['world', 'international', 'global', 'planet'] },
  { char: '🌏', name: 'earth asia', tags: ['world', 'international', 'global', 'planet'] },
  {
    char: '🖧',
    name: 'network',
    tags: ['lan', 'ethernet', 'connect', 'internet', 'infrastructure']
  },
  { char: '📶', name: 'wifi', tags: ['signal', 'wireless', 'connect', 'internet', 'network'] },
  { char: '📡', name: 'antenna', tags: ['signal', 'wifi', 'connect', 'network', 'broadcast'] },

  // 💾 Data & Storage
  { char: '💾', name: 'floppy disk', tags: ['save', 'storage', 'data', 'retro', 'disk'] },
  { char: '💿', name: 'cd', tags: ['disk', 'storage', 'data', 'music', 'backup'] },
  { char: '📀', name: 'dvd', tags: ['disk', 'storage', 'data', 'video', 'backup'] },
  {
    char: '🗄️',
    name: 'file cabinet',
    tags: ['database', 'storage', 'archive', 'records', 'office']
  },
  { char: '🗃️', name: 'card file', tags: ['database', 'data', 'archive', 'catalog', 'organize'] },
  { char: '📊', name: 'bar chart', tags: ['graph', 'data', 'analytics', 'metrics', 'statistics'] },
  {
    char: '📈',
    name: 'chart increasing',
    tags: ['graph', 'data', 'analytics', 'growth', 'metrics']
  },
  {
    char: '📉',
    name: 'chart decreasing',
    tags: ['graph', 'data', 'analytics', 'decline', 'metrics']
  },

  // 📁 Files & Documents
  { char: '📁', name: 'folder', tags: ['directory', 'files', 'organize', 'project'] },
  { char: '📂', name: 'open folder', tags: ['directory', 'files', 'organize', 'active'] },
  { char: '📄', name: 'page', tags: ['file', 'document', 'text', 'paper', 'draft'] },
  { char: '📃', name: 'page curl', tags: ['file', 'document', 'text', 'paper', 'draft'] },
  { char: '📝', name: 'memo', tags: ['note', 'write', 'document', 'draft', 'pad'] },
  { char: '📋', name: 'clipboard', tags: ['copy', 'paste', 'task', 'list', 'todo'] },
  { char: '📅', name: 'calendar', tags: ['date', 'schedule', 'plan', 'event', 'meeting'] },
  {
    char: '📆',
    name: 'tear-off calendar',
    tags: ['date', 'schedule', 'plan', 'event', 'deadline']
  },
  { char: '📌', name: 'pushpin', tags: ['pin', 'location', 'save', 'mark', 'remember'] },
  { char: '📍', name: 'round pushpin', tags: ['pin', 'location', 'map', 'mark', 'position'] },
  { char: '📎', name: 'paperclip', tags: ['attach', 'file', 'document', 'link', 'office'] },
  {
    char: '🖇️',
    name: 'linked paperclips',
    tags: ['attach', 'file', 'document', 'linked', 'office']
  },
  { char: '📑', name: 'bookmark tabs', tags: ['tabs', 'document', 'browser', 'organize'] },

  // 🏗️ Infrastructure & Architecture
  { char: '🏠', name: 'house', tags: ['home', 'building', 'main', 'root', 'start'] },
  {
    char: '🏢',
    name: 'office building',
    tags: ['building', 'work', 'business', 'company', 'corporate']
  },
  {
    char: '🏗️',
    name: 'construction',
    tags: ['build', 'develop', 'architecture', 'engineer', 'project']
  },
  { char: '🧱', name: 'brick', tags: ['building', 'construction', 'material', 'wall', 'solid'] },
  {
    char: '🏭',
    name: 'factory',
    tags: ['industry', 'manufacturing', 'production', 'plant', 'build']
  },

  // 🎨 Design & Creative
  { char: '🎨', name: 'palette', tags: ['art', 'color', 'design', 'paint', 'creative'] },
  { char: '✏️', name: 'pencil', tags: ['write', 'draw', 'sketch', 'design', 'draft'] },
  { char: '✒️', name: 'pen', tags: ['write', 'sign', 'ink', 'document', 'author'] },
  { char: '🖌️', name: 'paintbrush', tags: ['art', 'design', 'paint', 'creative', 'color'] },
  { char: '🖍️', name: 'crayon', tags: ['art', 'draw', 'color', 'kids', 'creative'] },
  { char: '🔍', name: 'magnifying glass', tags: ['search', 'find', 'look', 'explore', 'zoom'] },
  {
    char: '🔎',
    name: 'magnifying glass right',
    tags: ['search', 'find', 'look', 'explore', 'zoom']
  },
  { char: '💡', name: 'lightbulb', tags: ['idea', 'hint', 'tip', 'solution', 'innovation'] },
  { char: '🧠', name: 'brain', tags: ['mind', 'smart', 'intelligence', 'think', 'learning'] },

  // 🚗 Transport & Vehicles
  { char: '🚗', name: 'car', tags: ['vehicle', 'drive', 'transport', 'auto', 'travel'] },
  { char: '🏎️', name: 'race car', tags: ['car', 'fast', 'speed', 'vehicle', 'racing'] },
  { char: '🚕', name: 'taxi', tags: ['vehicle', 'transport', 'city', 'drive', 'service'] },
  { char: '🚙', name: 'suv', tags: ['vehicle', 'drive', 'transport', 'offroad', 'family'] },
  { char: '🚌', name: 'bus', tags: ['vehicle', 'transport', 'public', 'travel', 'city'] },
  { char: '🚎', name: 'trolley', tags: ['vehicle', 'transport', 'public', 'city'] },
  { char: '🏍️', name: 'motorcycle', tags: ['vehicle', 'bike', 'fast', 'ride', 'transport'] },
  { char: '🚲', name: 'bicycle', tags: ['bike', 'ride', 'exercise', 'transport', 'cycle'] },
  { char: '✈️', name: 'airplane', tags: ['flight', 'travel', 'jet', 'airport', 'transport'] },
  { char: '🚁', name: 'helicopter', tags: ['flight', 'air', 'transport', 'rescue', 'travel'] },
  { char: '🚂', name: 'steam locomotive', tags: ['train', 'transport', 'rail', 'travel', 'retro'] },
  { char: '🚆', name: 'bullet train', tags: ['train', 'fast', 'transport', 'rail', 'japan'] },
  { char: '🚢', name: 'ship', tags: ['boat', 'sea', 'travel', 'transport', 'cruise'] },
  { char: '🛸', name: 'ufo', tags: ['space', 'alien', 'fly', 'mystery', 'science'] },

  // 🎯 Symbols & Markers
  { char: '⭐', name: 'star', tags: ['favorite', 'important', 'bookmark', 'rate', 'highlight'] },
  {
    char: '🌟',
    name: 'glowing star',
    tags: ['favorite', 'important', 'special', 'magic', 'shine']
  },
  { char: '✨', name: 'sparkles', tags: ['magic', 'new', 'clean', 'shiny', 'feature'] },
  { char: '🔥', name: 'fire', tags: ['hot', 'trending', 'important', 'popular', 'lit'] },
  { char: '✅', name: 'check mark', tags: ['done', 'complete', 'success', 'verified', 'approved'] },
  { char: '✔️', name: 'heavy check mark', tags: ['done', 'complete', 'success', 'approved'] },
  { char: '❌', name: 'cross mark', tags: ['close', 'error', 'cancel', 'reject', 'fail'] },
  { char: '❎', name: 'negative cross', tags: ['close', 'error', 'cancel', 'reject'] },
  { char: '⚠️', name: 'warning', tags: ['alert', 'danger', 'caution', 'important', 'attention'] },
  { char: '🚫', name: 'prohibited', tags: ['stop', 'deny', 'block', 'forbidden', 'restricted'] },
  { char: '❓', name: 'question mark', tags: ['help', 'unknown', 'ask', 'support', 'faq'] },
  { char: '❔', name: 'white question', tags: ['help', 'unknown', 'ask', 'support'] },
  { char: '❗', name: 'exclamation', tags: ['alert', 'important', 'attention', 'urgent'] },
  { char: '❕', name: 'white exclamation', tags: ['alert', 'important', 'attention'] },
  { char: '💯', name: '100', tags: ['perfect', 'score', 'complete', 'excellent', 'achievement'] },

  // 👥 People & Communication
  { char: '👤', name: 'person', tags: ['user', 'account', 'profile', 'avatar', 'individual'] },
  { char: '👥', name: 'people', tags: ['group', 'team', 'users', 'community', 'collaboration'] },
  {
    char: '🧑‍💻',
    name: 'technologist',
    tags: ['developer', 'coder', 'programmer', 'engineer', 'tech']
  },
  { char: '👨‍💻', name: 'man technologist', tags: ['developer', 'coder', 'programmer', 'engineer'] },
  {
    char: '👩‍💻',
    name: 'woman technologist',
    tags: ['developer', 'coder', 'programmer', 'engineer']
  },
  { char: '🧑‍🏫', name: 'teacher', tags: ['education', 'learn', 'instructor', 'mentor', 'guide'] },
  { char: '💬', name: 'speech bubble', tags: ['chat', 'message', 'comment', 'talk', 'discuss'] },
  { char: '💭', name: 'thought bubble', tags: ['idea', 'think', 'imagine', 'dream', 'mind'] },
  { char: '🗨️', name: 'left speech bubble', tags: ['chat', 'message', 'comment', 'talk'] },
  { char: '🗯️', name: 'anger bubble', tags: ['angry', 'shout', 'complain', 'frustrated'] },
  { char: '👋', name: 'wave', tags: ['hello', 'goodbye', 'greeting', 'welcome'] },
  { char: '🤝', name: 'handshake', tags: ['deal', 'partner', 'agreement', 'team', 'collaborate'] },
  { char: '💪', name: 'muscle', tags: ['strong', 'power', 'workout', 'capable', 'determined'] },
  {
    char: '🧑‍🤝‍🧑',
    name: 'people holding hands',
    tags: ['team', 'partners', 'friends', 'support', 'together']
  },

  // 😊 Faces & Emotions
  { char: '😀', name: 'grinning face', tags: ['happy', 'joy', 'smile', 'positive'] },
  { char: '😁', name: 'beaming face', tags: ['happy', 'joy', 'smile', 'laugh', 'bright'] },
  { char: '😂', name: 'joy', tags: ['laugh', 'funny', 'tears', 'haha', 'hilarious'] },
  { char: '😎', name: 'sunglasses', tags: ['cool', 'awesome', 'style', 'confident'] },
  { char: '🤔', name: 'thinking', tags: ['hmm', 'ponder', 'consider', 'wonder', 'question'] },
  { char: '🤯', name: 'mind blown', tags: ['shock', 'amazing', 'crazy', 'mindblown', 'surprise'] },
  { char: '🥳', name: 'party face', tags: ['celebrate', 'fun', 'party', 'happy', 'festive'] },
  { char: '😊', name: 'smiling face', tags: ['happy', 'joy', 'nice', 'pleased', 'friendly'] },
  { char: '🙂', name: 'slightly smiling', tags: ['happy', 'positive', 'nice', 'good'] },
  { char: '😍', name: 'heart eyes', tags: ['love', 'crush', 'beautiful', 'awesome', 'like'] },
  { char: '🥰', name: 'smiling with hearts', tags: ['love', 'crush', 'beautiful', 'affection'] },
  { char: '😘', name: 'kiss', tags: ['love', 'affection', 'friendly', 'sent'] },
  { char: '😅', name: 'sweat smile', tags: ['nervous', 'anxious', 'sweat', 'effort'] },
  { char: '😭', name: 'crying', tags: ['sad', 'tears', 'cry', 'emotional'] },
  { char: '😤', name: 'triumph', tags: ['frustrated', 'angry', 'determined', 'annoyed'] },
  { char: '😈', name: 'smiling devil', tags: ['evil', 'mischief', 'naughty', 'trick'] },
  { char: '👻', name: 'ghost', tags: ['spooky', 'halloween', 'boo', 'fun', 'scary'] },
  { char: '👽', name: 'alien', tags: ['space', 'ufo', 'extraterrestrial', 'scifi'] },
  { char: '🤖', name: 'robot', tags: ['bot', 'machine', 'ai', 'automation', 'tech'] },

  // 🍕 Food & Drink
  { char: '🍕', name: 'pizza', tags: ['food', 'italian', 'cheese', 'delivery', 'eat'] },
  { char: '🍔', name: 'burger', tags: ['food', 'fastfood', 'lunch', 'eat', 'american'] },
  { char: '🌮', name: 'taco', tags: ['food', 'mexican', 'lunch', 'eat', 'spicy'] },
  { char: '🍣', name: 'sushi', tags: ['food', 'japanese', 'fish', 'raw', 'fresh'] },
  { char: '🍜', name: 'ramen', tags: ['food', 'japanese', 'soup', 'noodles', 'warm'] },
  { char: '☕', name: 'coffee', tags: ['drink', 'caffeine', 'morning', 'java', 'code'] },
  { char: '🍵', name: 'tea', tags: ['drink', 'warm', 'relax', 'chill', 'beverage'] },
  { char: '🍺', name: 'beer', tags: ['drink', 'happy hour', 'party', 'relax'] },
  { char: '🍷', name: 'wine', tags: ['drink', 'classy', 'dinner', 'celebrate'] },
  { char: '🥂', name: 'clinking glasses', tags: ['celebrate', 'toast', 'drink', 'cheers'] },
  { char: '🍎', name: 'red apple', tags: ['fruit', 'food', 'healthy', 'mac', 'snack'] },
  { char: '🍌', name: 'banana', tags: ['fruit', 'food', 'healthy', 'snack'] },

  // 🌿 Nature & Environment
  { char: '🌳', name: 'tree', tags: ['nature', 'wood', 'forest', 'green', 'environment'] },
  { char: '🌲', name: 'pine tree', tags: ['nature', 'wood', 'forest', 'green', 'winter'] },
  { char: '🌱', name: 'seedling', tags: ['plant', 'grow', 'nature', 'green', 'spring'] },
  { char: '🌿', name: 'herb', tags: ['plant', 'nature', 'green', 'fresh', 'garden'] },
  {
    char: '🌸',
    name: 'cherry blossom',
    tags: ['flower', 'spring', 'japan', 'nature', 'beautiful']
  },
  { char: '🌺', name: 'hibiscus', tags: ['flower', 'nature', 'tropical', 'beautiful'] },
  { char: '🌻', name: 'sunflower', tags: ['flower', 'sun', 'nature', 'happy'] },
  { char: '🌹', name: 'rose', tags: ['flower', 'love', 'romance', 'nature', 'beautiful'] },
  { char: '🌷', name: 'tulip', tags: ['flower', 'spring', 'nature', 'beautiful'] },
  { char: '🌊', name: 'wave', tags: ['water', 'sea', 'ocean', 'nature', 'flow'] },
  { char: '🌅', name: 'sunrise', tags: ['morning', 'nature', 'beautiful', 'new day'] },
  { char: '🌈', name: 'rainbow', tags: ['color', 'pride', 'weather', 'beautiful', 'diversity'] },

  // 🎯 Objects & Life
  { char: '🏆', name: 'trophy', tags: ['award', 'win', 'success', 'prize', 'achievement'] },
  { char: '🥇', name: 'gold medal', tags: ['award', 'win', 'first', 'gold', 'success'] },
  { char: '🥈', name: 'silver medal', tags: ['award', 'win', 'second', 'silver', 'runner up'] },
  { char: '🥉', name: 'bronze medal', tags: ['award', 'win', 'third', 'bronze', 'medal'] },
  { char: '🏅', name: 'sports medal', tags: ['award', 'win', 'success', 'achievement'] },
  { char: '🎯', name: 'bullseye', tags: ['goal', 'aim', 'focus', 'target', 'objective'] },
  { char: '🎖️', name: 'military medal', tags: ['award', 'honor', 'service', 'achievement'] },
  { char: '💎', name: 'gem stone', tags: ['diamond', 'precious', 'jewel', 'value', 'crystal'] },
  { char: '💰', name: 'money bag', tags: ['cash', 'coin', 'wealth', 'finance', 'payment'] },
  { char: '💳', name: 'credit card', tags: ['money', 'pay', 'buy', 'payment', 'finance'] },
  { char: '🛒', name: 'shopping cart', tags: ['shop', 'buy', 'store', 'checkout', 'ecommerce'] },
  { char: '📦', name: 'package', tags: ['box', 'shipping', 'delivery', 'bundle', 'order'] },
  { char: '🎁', name: 'gift', tags: ['present', 'birthday', 'surprise', 'box', 'celebration'] },
  { char: '🎈', name: 'balloon', tags: ['party', 'celebrate', 'birthday', 'fun'] },
  {
    char: '🎉',
    name: 'party popper',
    tags: ['celebrate', 'party', 'success', 'cheer', 'congrats']
  },
  {
    char: '🎊',
    name: 'confetti ball',
    tags: ['celebrate', 'party', 'success', 'congrats', 'festive']
  },
  { char: '🔔', name: 'bell', tags: ['alert', 'notification', 'sound', 'ring', 'reminder'] },
  {
    char: '🔕',
    name: 'bell with slash',
    tags: ['mute', 'silent', 'quiet', 'no alerts', 'do not disturb']
  },

  // ❤️ Health & Wellness
  { char: '❤️', name: 'red heart', tags: ['love', 'like', 'favorite', 'health', 'passion'] },
  { char: '🧡', name: 'orange heart', tags: ['love', 'like', 'warm', 'passion'] },
  { char: '💛', name: 'yellow heart', tags: ['love', 'like', 'happy', 'friendship'] },
  { char: '💚', name: 'green heart', tags: ['love', 'like', 'nature', 'healthy'] },
  { char: '💙', name: 'blue heart', tags: ['love', 'like', 'trust', 'loyalty'] },
  { char: '💜', name: 'purple heart', tags: ['love', 'like', 'passion', 'creative'] },
  { char: '🖤', name: 'black heart', tags: ['love', 'dark', 'gothic', 'mystery'] },
  { char: '💔', name: 'broken heart', tags: ['sad', 'break', 'fail', 'heartbreak', 'hurt'] },
  { char: '💝', name: 'heart with ribbon', tags: ['love', 'gift', 'valentine', 'care'] },
  { char: '💞', name: 'revolving hearts', tags: ['love', 'crush', 'passion', 'excited'] },
  { char: '💓', name: 'beating heart', tags: ['love', 'alive', 'health', 'life'] },
  { char: '💗', name: 'growing heart', tags: ['love', 'grow', 'passion', 'excited'] },
  { char: '💖', name: 'sparkling heart', tags: ['love', 'special', 'magic', 'shine'] },
  { char: '💘', name: 'cupid heart', tags: ['love', 'crush', 'valentine', 'romance'] },
  { char: '💕', name: 'two hearts', tags: ['love', 'couple', 'together', 'romance'] },

  // ⏰ Time & Schedule
  { char: '⏰', name: 'alarm clock', tags: ['time', 'clock', 'wake', 'alert', 'schedule'] },
  { char: '⏳', name: 'hourglass', tags: ['time', 'wait', 'sand', 'loading', 'countdown'] },
  { char: '⌛', name: 'hourglass done', tags: ['time', 'done', 'end', 'finish'] },
  { char: '🕐', name: 'one oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕑', name: 'two oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕒', name: 'three oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕓', name: 'four oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕔', name: 'five oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕕', name: 'six oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕖', name: 'seven oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕗', name: 'eight oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕘', name: 'nine oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕙', name: 'ten oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕚', name: 'eleven oclock', tags: ['time', 'clock', 'schedule'] },
  { char: '🕛', name: 'twelve oclock', tags: ['time', 'clock', 'schedule'] },

  // 🧭 Direction & Navigation
  { char: '➡️', name: 'right arrow', tags: ['direction', 'forward', 'next', 'continue'] },
  { char: '⬅️', name: 'left arrow', tags: ['direction', 'back', 'previous', 'return'] },
  { char: '⬆️', name: 'up arrow', tags: ['direction', 'top', 'above', 'increase'] },
  { char: '⬇️', name: 'down arrow', tags: ['direction', 'bottom', 'below', 'decrease'] },
  { char: '↗️', name: 'up right arrow', tags: ['direction', 'northeast', 'forward up'] },
  { char: '↘️', name: 'down right arrow', tags: ['direction', 'southeast', 'forward down'] },
  { char: '↖️', name: 'up left arrow', tags: ['direction', 'northwest', 'back up'] },
  { char: '↙️', name: 'down left arrow', tags: ['direction', 'southwest', 'back down'] },
  { char: '🔄', name: 'refresh', tags: ['sync', 'cycle', 'spin', 'reload', 'update'] },
  { char: '🔁', name: 'repeat', tags: ['loop', 'cycle', 'again', 'refresh'] },
  { char: '🔂', name: 'repeat once', tags: ['loop', 'cycle', 'single', 'repeat'] },
  { char: '⏩', name: 'fast forward', tags: ['skip', 'next', 'faster', 'forward'] },
  { char: '⏪', name: 'rewind', tags: ['skip', 'back', 'previous', 'backward'] },
  { char: '⏫', name: 'fast up', tags: ['up', 'fast', 'increase'] },
  { char: '⏬', name: 'fast down', tags: ['down', 'fast', 'decrease'] },

  // 🌟 Space & Science
  { char: '🌙', name: 'moon', tags: ['night', 'dark', 'lunar', 'sleep', 'space'] },
  { char: '🌚', name: 'new moon face', tags: ['night', 'dark', 'moon', 'mystery'] },
  { char: '🌛', name: 'first quarter moon face', tags: ['night', 'moon', 'waxing'] },
  { char: '🌜', name: 'last quarter moon face', tags: ['night', 'moon', 'waning'] },
  { char: '☀️', name: 'sun', tags: ['day', 'light', 'weather', 'hot', 'bright'] },
  { char: '🌞', name: 'sun face', tags: ['happy', 'sun', 'warm', 'bright'] },
  { char: '⭐', name: 'white medium star', tags: ['star', 'night', 'sky', 'space'] },
  { char: '🌠', name: 'shooting star', tags: ['wish', 'night', 'space', 'magic'] },
  { char: '🌌', name: 'milky way', tags: ['space', 'stars', 'galaxy', 'universe'] },
  { char: '🪐', name: 'ringed planet', tags: ['space', 'saturn', 'planet', 'solar system'] },
  { char: '🌍', name: 'globe showing europe-africa', tags: ['world', 'globe', 'earth', 'planet'] },

  // 🎨 Additional Useful Icons
  { char: '🧮', name: 'abacus', tags: ['math', 'count', 'calculate', 'ancient'] },
  { char: '🧾', name: 'receipt', tags: ['bill', 'invoice', 'payment', 'business', 'purchase'] },
  { char: '🗂️', name: 'card index dividers', tags: ['organize', 'catalog', 'reference', 'files'] },
  { char: '🗒️', name: 'spiral notepad', tags: ['notes', 'write', 'pad', 'list', 'todo'] },
  { char: '🗓️', name: 'spiral calendar', tags: ['plan', 'schedule', 'appointment', 'meeting'] },
  { char: '📇', name: 'card index', tags: ['contacts', 'directory', 'addresses', 'list'] },
  { char: '📮', name: 'postbox', tags: ['mail', 'email', 'message', 'send'] },
  { char: '📬', name: 'open mailbox', tags: ['mail', 'email', 'message', 'receive'] },
  { char: '📭', name: 'closed mailbox', tags: ['mail', 'email', 'no message', 'empty'] },
  { char: '📪', name: 'closed mailbox lowered', tags: ['mail', 'no messages', 'empty'] },
  { char: '📫', name: 'closed mailbox raised', tags: ['mail', 'has messages', 'full'] },
  { char: '📯', name: 'postal horn', tags: ['mail', 'announce', 'broadcast', 'message'] },
  { char: '📨', name: 'incoming envelope', tags: ['mail', 'email', 'message', 'receive'] },
  { char: '📧', name: 'email', tags: ['mail', 'message', 'send', 'outlook', 'gmail'] },
  { char: '📩', name: 'envelope with arrow', tags: ['mail', 'send', 'outbound', 'email'] },
  { char: '📤', name: 'outbox tray', tags: ['send', 'upload', 'share', 'export'] },
  { char: '📥', name: 'inbox tray', tags: ['receive', 'download', 'import', 'incoming'] },
  { char: '🖊️', name: 'pen', tags: ['write', 'sign', 'draw', 'mark'] },
  { char: '🖋️', name: 'fountain pen', tags: ['write', 'sign', 'draw', 'classy'] },
  { char: '🖍️', name: 'crayon', tags: ['draw', 'art', 'kids', 'color'] },
  { char: '🩸', name: 'blood drop', tags: ['health', 'medical', 'period', 'blood'] },
  { char: '🩹', name: 'adhesive bandage', tags: ['health', 'medical', 'first aid', 'injury'] },
  { char: '🩺', name: 'stethoscope', tags: ['health', 'medical', 'doctor', 'checkup'] },
  { char: '🧷', name: 'safety pin', tags: ['fasten', 'attach', 'secure', 'repair'] },
  { char: '🧸', name: 'teddy bear', tags: ['toy', 'cute', 'child', 'love'] },
  { char: '🧵', name: 'thread', tags: ['sew', 'fashion', 'craft', 'textile'] },
  { char: '🧶', name: 'yarn', tags: ['knit', 'craft', 'warm', 'fashion'] },
  { char: '🪡', name: 'sewing needle', tags: ['sew', 'repair', 'fashion', 'craft'] },
  { char: '🪢', name: 'knot', tags: ['tie', 'rope', 'secure', 'nautical'] },
  { char: '🪣', name: 'bucket', tags: ['container', 'clean', 'carry', 'sand'] },
  { char: '🪤', name: 'mouse trap', tags: ['trap', 'catch', 'problem', 'solved'] },
  { char: '🪥', name: 'toothbrush', tags: ['clean', 'hygiene', 'dental', 'morning'] },
  { char: '🪦', name: 'headstone', tags: ['grave', 'death', 'halloween', 'spooky'] },
  { char: '🪧', name: 'placard', tags: ['sign', 'protest', 'advertise', 'message'] },
  { char: '🪨', name: 'rock', tags: ['stone', 'nature', 'solid', 'heavy'] },
  { char: '🪴', name: 'potted plant', tags: ['plant', 'nature', 'home', 'green'] },
  { char: '🪸', name: 'coral', tags: ['sea', 'ocean', 'nature', 'reef'] },
  { char: '🪹', name: 'nest', tags: ['bird', 'nature', 'home', 'eggs'] },
  { char: '🪺', name: 'nest with eggs', tags: ['bird', 'nature', 'home', 'family'] },
  { char: '🪷', name: 'lotus', tags: ['flower', 'meditation', 'yoga', 'peace'] }
]

// Create a highly optimized searchable index
export const EMOJI_INDEX = EMOJI_LIST.map((item) => {
  return {
    ...item,
    searchString: [item.name, ...item.tags].join(' ').toLowerCase()
  }
})
