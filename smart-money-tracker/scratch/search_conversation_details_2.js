const fs = require('fs');

const file1 = `C:\\Users\\aaror\\.gemini\\antigravity-ide\\brain\\4137cd64-ed99-464b-963f-6fffb3dcbac9\\.system_generated\\logs\\transcript.jsonl`;
const file2 = `C:\\Users\\aaror\\.gemini\\antigravity-ide\\brain\\c2493d33-ad31-4651-9574-cf7ff6b597a9\\.system_generated\\logs\\transcript.jsonl`;

function getDiscussion(filePath) {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let out = '';
    lines.forEach((line, idx) => {
        if (!line) return;
        try {
            const data = JSON.parse(line);
            const text = JSON.stringify(data.content || '') + JSON.stringify(data.tool_calls || '');
            if (text.toLowerCase().includes('stratus') || text.toLowerCase().includes('mmcs') || text.toLowerCase().includes('statis')) {
                out += `\n[File: ${filePath.split('\\').slice(-3).join('\\')} | Line ${idx+1} | Type: ${data.type}]\n`;
                if (data.type === 'USER_INPUT') {
                    out += `USER: ${data.content}\n`;
                } else if (data.type === 'PLANNER_RESPONSE') {
                    out += `MODEL: ${data.content ? data.content.substring(0, 1000) : ''}\n`;
                } else {
                    out += `OTHER: ${data.type} | ${data.content ? data.content.substring(0, 200) : ''}\n`;
                }
            }
        } catch (e) {}
    });
    return out;
}

let result = '';
result += getDiscussion(file1);
result += getDiscussion(file2);

fs.writeFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\scratch\\conv_details_2.txt", result, 'utf8');
console.log('Written conv details 2');
