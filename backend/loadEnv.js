const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');

// Production/shared config first, then local overrides (not committed).
dotenv.config({ path: path.join(root, '.env') });
if (fs.existsSync(path.join(root, '.env.local'))) {
  dotenv.config({ path: path.join(root, '.env.local'), override: true });
}

module.exports = root;
