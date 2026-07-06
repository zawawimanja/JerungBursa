const fs = require('fs');
const path = require('path');

const gitignorePath = path.join(__dirname, '../../.gitignore');
if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    console.log("=== ROOT .gitignore CONTENT ===");
    console.log(content);
} else {
    console.log("Root .gitignore does not exist.");
}
