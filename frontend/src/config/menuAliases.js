/**
 * menuAliases.js — Spoken-word aliases for local fallback parser.
 * Maps canonical menu item names to all the ways a customer might say them.
 *
 * IMPORTANT: Update this map to match YOUR actual menu item names exactly.
 * The keys must match the `name` field returned by your backend menu API.
 *
 * These aliases are used ONLY when the Groq LLM is unavailable.
 * Groq handles all the fuzzy matching when online.
 */
export const MENU_ALIASES = {
  // ── Dosas ──────────────────────────────────────────────
  'Masala Dosa':       ['masala dosa', 'masala dose', 'dosa', 'dose'],
  'Plain Dosa':        ['plain dosa', 'plain dose', 'sada dosa'],
  'Rava Dosa':         ['rava dosa', 'rave dose', 'rava dose'],
  'Onion Dosa':        ['onion dosa', 'onion dose', 'pyaaz dosa'],
  'Paneer Dosa':       ['paneer dosa', 'paneer dose'],
  'Mysore Masala Dosa':['mysore masala dosa', 'mysore dosa'],

  // ── Rice Dishes ────────────────────────────────────────
  'Biryani':           ['biryani', 'biriyani', 'briyani', 'biryaani', 'biryaany'],
  'Veg Biryani':       ['veg biryani', 'vegetable biryani'],
  'Chicken Biryani':   ['chicken biryani', 'murgh biryani'],
  'Fried Rice':        ['fried rice', 'fraid rice'],
  'Veg Fried Rice':    ['veg fried rice'],
  'Plain Rice':        ['plain rice', 'steamed rice', 'chawal', 'rice'],

  // ── Curries ────────────────────────────────────────────
  'Paneer Butter Masala': ['paneer butter masala', 'paneer', 'butter paneer', 'paneer makhani'],
  'Dal Tadka':         ['dal tadka', 'dal', 'daal tadka', 'daal'],
  'Dal Makhani':       ['dal makhani', 'daal makhani', 'black dal'],
  'Butter Chicken':    ['butter chicken', 'murgh makhani', 'chicken curry'],
  'Palak Paneer':      ['palak paneer', 'spinach paneer'],
  'Chana Masala':      ['chana masala', 'chole', 'chickpea'],

  // ── Breads ─────────────────────────────────────────────
  'Roti':              ['roti', 'chapati', 'chapathi', 'chapatti', 'phulka'],
  'Naan':              ['naan', 'nan', 'garlic naan'],
  'Paratha':           ['paratha', 'paranta', 'parantha'],
  'Puri':              ['puri', 'poori'],

  // ── South Indian ───────────────────────────────────────
  'Idli':              ['idli', 'idly', 'idlies'],
  'Vada':              ['vada', 'wada', 'medu vada'],
  'Sambar':            ['sambar', 'sambhar'],
  'Uttapam':           ['uttapam', 'utthapam'],
  'Pongal':            ['pongal', 'khichdi'],

  // ── Noodles ────────────────────────────────────────────
  'Noodles':           ['noodles', 'hakka noodles', 'chow mein'],
  'Veg Noodles':       ['veg noodles', 'veg hakka'],
  'Schezwan Noodles':  ['schezwan noodles', 'sichuan noodles', 'spicy noodles'],

  // ── Beverages ──────────────────────────────────────────
  'Chai':              ['chai', 'chaye', 'tea', 'cutting chai', 'cutting', 'chay'],
  'Filter Coffee':     ['filter coffee', 'kaafi', 'kaapi', 'south indian coffee', 'coffee', 'kaapee'],
  'Lassi':             ['lassi', 'lasi', 'sweet lassi'],
  'Mango Lassi':       ['mango lassi', 'aam lassi'],
  'Mango Juice':       ['mango juice', 'aam juice', 'aamras', 'juice'],
  'Coke':              ['coke', 'coca cola', 'cold drink', 'cola', 'soda'],
  'Pepsi':             ['pepsi'],
  'Sprite':            ['sprite', 'limca'],
  'Water':             ['water', 'paani', 'pani', 'mineral water', 'bottle water'],
  'Buttermilk':        ['buttermilk', 'chaas', 'chhas', 'masala chaas'],
};
